import express from "express";
import protect from "../middleware/authMiddleware.js";
import StockMovement from "../models/stockMovementModel.js";

const router = express.Router();

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildMovementQuery = (req) => {
  const shopId = req.accessShopId || req.shop._id;
  const query = { shopId };

  if (req.query.sku) query.sku = String(req.query.sku).trim().toUpperCase();
  if (req.query.movementType) query.movementType = req.query.movementType;
  if (req.query.actorId) query.actorId = req.query.actorId;
  if (req.query.inventoryId) query.inventoryId = req.query.inventoryId;

  if (req.query.search) {
    const search = escapeRegex(String(req.query.search).trim());
    query.$or = [
      { productName: new RegExp(search, "i") },
      { sku: new RegExp(search, "i") },
      { actorName: new RegExp(search, "i") },
    ];
  }

  if (req.query.dateFrom || req.query.dateTo) {
    query.createdAt = {};
    if (req.query.dateFrom) query.createdAt.$gte = new Date(req.query.dateFrom);
    if (req.query.dateTo) query.createdAt.$lte = new Date(req.query.dateTo);
  }

  return query;
};

router.get("/", protect, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const movements = await StockMovement.find(buildMovementQuery(req))
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json(movements);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

router.get("/export", protect, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 5000, 10000);
    const movements = await StockMovement.find(buildMovementQuery(req))
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const header = [
      "createdAt",
      "movementType",
      "productName",
      "sku",
      "oldQuantity",
      "newQuantity",
      "quantityChange",
      "actorName",
      "actorRole",
      "reason",
    ];

    const escape = (value) => {
      if (value === null || value === undefined) return "";
      return `"${String(value).replace(/"/g, '""')}"`;
    };

    const rows = movements.map((item) =>
      [
        item.createdAt,
        item.movementType,
        item.productName,
        item.sku,
        item.oldQuantity,
        item.newQuantity,
        item.quantityChange,
        item.actorName,
        item.actorRole,
        item.reason,
      ]
        .map(escape)
        .join(",")
    );

    const csv = [header.map(escape).join(","), ...rows].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="stock_movements_${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ message: "Export failed", error: error.message });
  }
});

export default router;
