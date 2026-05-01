import express from "express";
import protect from "../middleware/authMiddleware.js";
import requireRoles from "../middleware/roleMiddleware.js";
import ActivityLog from "../models/activityLogModel.js";

const router = express.Router();

router.get("/", protect, requireRoles("owner"), async (req, res) => {
  try {
    const shopId = req.accessShopId || req.shop._id;
    const limit = Math.min(Number(req.query.limit) || 50, 200);

    const logs = await ActivityLog.find({ shopId })
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// Export endpoint - supports CSV and JSON exports with optional filters
router.get(
  "/export",
  protect,
  requireRoles("owner"),
  async (req, res) => {
    try {
      const shopId = req.accessShopId || req.shop._id;

      // Build query from optional filters
      const query = { shopId };
      if (req.query.actorId) query.actorId = req.query.actorId;
      if (req.query.action) query.action = req.query.action;
      if (req.query.entityType) query.entityType = req.query.entityType;

      // Date range filtering
      if (req.query.dateFrom || req.query.dateTo) {
        query.createdAt = {};
        if (req.query.dateFrom) query.createdAt.$gte = new Date(req.query.dateFrom);
        if (req.query.dateTo) query.createdAt.$lte = new Date(req.query.dateTo);
      }

      const cap = 10000; // safety cap for exports
      const limit = Math.min(Number(req.query.limit) || 1000, cap);

      const logs = await ActivityLog.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      const format = (req.query.format || "csv").toLowerCase();

      if (format === "json") {
        const filename = `activity_${shopId}_${Date.now()}.json`;
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        return res.send(JSON.stringify(logs, null, 2));
      }

      // Default CSV
      const header = [
        "createdAt",
        "actorId",
        "actorName",
        "actorRole",
        "action",
        "entityType",
        "entityId",
        "summary",
        "metadata",
      ];

      const escape = (val) => {
        if (val === null || val === undefined) return "";
        let s = typeof val === "string" ? val : JSON.stringify(val);
        s = s.replace(/"/g, '""');
        return `"${s}"`;
      };

      const rows = logs.map((l) =>
        [
          l.createdAt,
          l.actorId || "",
          l.actorName || "",
          l.actorRole || "",
          l.action || "",
          l.entityType || "",
          l.entityId || "",
          l.summary || "",
          l.metadata ? JSON.stringify(l.metadata) : "",
        ].map(escape).join(",")
      );

      const csv = [header.map(escape).join(","), ...rows].join("\n");
      const filename = `activity_${shopId}_${Date.now()}.csv`;
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (error) {
      res.status(500).json({ message: "Export failed", error: error.message });
    }
  }
);

export default router;
