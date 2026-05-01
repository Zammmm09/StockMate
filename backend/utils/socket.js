import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import Shop from "../models/shopModel.js";
import { canViewChat, getConversationKey } from "./chatPolicy.js";

let io = null;

export const initSocket = (server, options = {}) => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
      methods: ["GET", "POST"],
    },
    ...options,
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Unauthorized"));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const shop = await Shop.findById(decoded.id).select("-password");
      if (!shop) return next(new Error("Unauthorized"));

      socket.shop = shop;
      next();
    } catch (error) {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    // allow clients to join a shop room
    socket.on("join", (shopId) => {
      if (shopId) socket.join(`shop_${shopId}`);
    });

    socket.on("chat:join", async (otherId) => {
      if (!socket.shop || !otherId) return;

      const otherUser = await Shop.findById(otherId).select("-password");
      if (!otherUser) return;

      if (!canViewChat(socket.shop.role || "owner", otherUser.role || "owner")) return;

      const conversationKey = getConversationKey(socket.shop._id, otherUser._id);
      socket.join(`chat_${conversationKey}`);
    });

    socket.on("leave", (shopId) => {
      if (shopId) socket.leave(`shop_${shopId}`);
    });

    socket.on("chat:leave", async (otherId) => {
      if (!socket.shop || !otherId) return;

      const conversationKey = getConversationKey(socket.shop._id, otherId);
      socket.leave(`chat_${conversationKey}`);
    });
  });

  return io;
};

// helper for activity logger
export const getIO = () => io;
