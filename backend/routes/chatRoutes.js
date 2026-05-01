import express from "express";
import protect from "../middleware/authMiddleware.js";
import requireRoles from "../middleware/roleMiddleware.js";
import ChatMessage from "../models/chatMessageModel.js";
import Shop from "../models/shopModel.js";
import { getIO } from "../utils/socket.js";
import { canSendChat, canViewChat, getConversationKey } from "../utils/chatPolicy.js";

const router = express.Router();

const getParticipantsForRole = async (shop) => {
  const role = shop.role || "owner";
  const rootShopId = shop.parentShopId || shop._id;

  if (role === "owner") {
    const managers = await Shop.find({ parentShopId: rootShopId, role: "manager" }).select("-password");
    const employees = await Shop.find({ parentShopId: rootShopId, role: "employee" }).select("-password");

    return managers.map((member) => ({
      _id: member._id,
      name: member.name,
      role: member.role,
      email: member.email,
    })).concat(
      employees.map((member) => ({
        _id: member._id,
        name: member.name,
        role: member.role,
        email: member.email,
      }))
    );
  }

  if (role === "manager") {
    const owner = await Shop.findById(rootShopId).select("-password");
    const employees = await Shop.find({ parentShopId: rootShopId, role: "employee" }).select("-password");

    return [
      ...(owner
        ? [{ _id: owner._id, name: owner.name, role: owner.role, email: owner.email }]
        : []),
      ...employees.map((member) => ({
        _id: member._id,
        name: member.name,
        role: member.role,
        email: member.email,
      })),
    ];
  }

  if (role === "employee") {
    const owner = await Shop.findById(rootShopId).select("-password");
    const managers = await Shop.find({ parentShopId: rootShopId, role: "manager" }).select("-password");
    return [
      ...(owner
        ? [{ _id: owner._id, name: owner.name, role: owner.role, email: owner.email }]
        : []),
      ...managers.map((member) => ({
        _id: member._id,
        name: member.name,
        role: member.role,
        email: member.email,
      })),
    ];
  }

  return [];
};

router.get("/participants", protect, async (req, res) => {
  try {
    const participants = await getParticipantsForRole(req.shop);
    res.json({ participants });
  } catch (error) {
    res.status(500).json({ message: "Failed to load chat participants", error: error.message });
  }
});

router.post("/broadcast", protect, requireRoles("owner"), async (req, res) => {
  try {
    const message = req.body?.message?.trim();
    if (!message) {
      return res.status(400).json({ message: "Message is required" });
    }

    const rootShopId = req.shop.parentShopId || req.shop._id;
    const recipients = await Shop.find({
      parentShopId: rootShopId,
      role: { $in: ["manager", "employee"] },
    }).select("-password");

    if (recipients.length === 0) {
      return res.status(200).json({ count: 0, messages: [] });
    }

    const payload = recipients.map((recipient) => ({
      shopId: rootShopId,
      conversationKey: getConversationKey(req.shop._id, recipient._id),
      senderId: req.shop._id,
      senderRole: req.shop.role || "owner",
      receiverId: recipient._id,
      receiverRole: recipient.role || "employee",
      message,
    }));

    const created = await ChatMessage.insertMany(payload);
    const populated = await ChatMessage.find({ _id: { $in: created.map((item) => item._id) } })
      .populate("senderId", "name role")
      .populate("receiverId", "name role");

    const io = getIO();
    if (io) {
      populated.forEach((item) => {
        io.to(`chat_${item.conversationKey}`).emit("chat:message", item);
      });
    }

    res.status(201).json({ count: populated.length, messages: populated });
  } catch (error) {
    res.status(500).json({ message: "Failed to broadcast message", error: error.message });
  }
});

router.get("/:otherId", protect, async (req, res) => {
  try {
    const { otherId } = req.params;
    const otherUser = await Shop.findById(otherId).select("-password");

    if (!otherUser) {
      return res.status(404).json({ message: "Chat user not found" });
    }

    if (!canViewChat(req.shop.role || "owner", otherUser.role || "owner")) {
      return res.status(403).json({ message: "Chat not allowed with this user" });
    }

    const rootShopId = req.shop.parentShopId || req.shop._id;
    const conversationKey = getConversationKey(req.shop._id, otherUser._id);

    const messages = await ChatMessage.find({
      shopId: rootShopId,
      conversationKey,
    })
      .sort({ createdAt: 1 })
      .populate("senderId", "name role")
      .populate("receiverId", "name role");

    res.json({
      conversationKey,
      otherUser: {
        _id: otherUser._id,
        name: otherUser.name,
        role: otherUser.role,
        email: otherUser.email,
      },
      messages,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to load messages", error: error.message });
  }
});

router.post("/messages", protect, async (req, res) => {
  try {
    const { receiverId, message } = req.body;
    if (!receiverId || !message?.trim()) {
      return res.status(400).json({ message: "Receiver and message are required" });
    }

    const receiver = await Shop.findById(receiverId).select("-password");
    if (!receiver) {
      return res.status(404).json({ message: "Receiver not found" });
    }

    if (!canSendChat(req.shop.role || "owner", receiver.role || "owner")) {
      return res.status(403).json({ message: "Chat not allowed with this user" });
    }

    const rootShopId = req.shop.parentShopId || req.shop._id;
    const conversationKey = getConversationKey(req.shop._id, receiver._id);

    const created = await ChatMessage.create({
      shopId: rootShopId,
      conversationKey,
      senderId: req.shop._id,
      senderRole: req.shop.role || "owner",
      receiverId: receiver._id,
      receiverRole: receiver.role || "owner",
      message: message.trim(),
    });

    const populated = await ChatMessage.findById(created._id)
      .populate("senderId", "name role")
      .populate("receiverId", "name role");

    const io = getIO();
    if (io) {
      io.to(`chat_${conversationKey}`).emit("chat:message", populated);
    }

    res.status(201).json({ message: populated });
  } catch (error) {
    res.status(500).json({ message: "Failed to send message", error: error.message });
  }
});

export default router;