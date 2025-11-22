import express from "express";
import Warehouse from "../models/warehouseModel.js";
import Inventory from "../models/inventoryModel.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

// Add Warehouse (Protected)
router.post("/", protect, async (req, res) => {
  try {
    const { name, location, capacity } = req.body;

    const warehouse = await Warehouse.create({
      shopId: req.shop._id,
      name,
      location,
      capacity,
    });

    res.status(201).json(warehouse);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
});

// Get All Warehouses for a Shop (Protected)
router.get("/", protect, async (req, res) => {
  try {
    const warehouses = await Warehouse.find({ shopId: req.shop._id });
    res.json(warehouses);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
});

// Delete Warehouse (Protected)
router.delete("/:id", protect, async (req, res) => {
  try {
    const warehouseId = req.params.id;
    const shopId = req.shop._id;

    // Find warehouse and verify it belongs to the shop
    const warehouse = await Warehouse.findOne({
      _id: warehouseId,
      shopId: shopId,
    });

    if (!warehouse) {
      return res.status(404).json({ message: "Warehouse not found or unauthorized" });
    }

    // Check if warehouse has inventory items
    const inventoryCount = await Inventory.countDocuments({ warehouseId: warehouse._id });

    if (inventoryCount > 0) {
      return res.status(400).json({
        message: `Cannot delete warehouse. It contains ${inventoryCount} inventory item(s). Please remove all inventory items first.`,
      });
    }

    // Delete the warehouse
    await Warehouse.findByIdAndDelete(warehouseId);
    res.json({ message: "Warehouse deleted successfully" });
  } catch (error) {
    console.error("Error deleting warehouse:", error);
    res.status(500).json({ 
      message: "Server Error", 
      error: error.message
    });
  }
});

export default router;
