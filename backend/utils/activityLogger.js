import ActivityLog from "../models/activityLogModel.js";
import { getIO } from "./socket.js";

const logActivity = async ({ req, action, entityType, entityId = null, summary, metadata = {} }) => {
  try {
    if (!req?.shop) {
      return;
    }

    const entry = await ActivityLog.create({
      shopId: req.accessShopId || req.shop._id,
      actorId: req.shop._id,
      actorName: req.shop.name,
      actorRole: req.shopRole || req.shop.role || "owner",
      action,
      entityType,
      entityId: entityId ? String(entityId) : null,
      summary,
      metadata,
    });

    // emit real-time event to shop room if socket initialized
    try {
      const io = getIO();
      if (io) {
        const room = `shop_${String(entry.shopId)}`;
        io.to(room).emit("activity:created", entry);
      }
    } catch (err) {
      // non-fatal
      console.warn("Socket emit failed:", err.message || err);
    }

    return entry;
  } catch (error) {
    console.error("Failed to write activity log:", error.message);
  }
};

export default logActivity;
