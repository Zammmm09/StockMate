import express from "express";
import Warehouse from "../models/warehouseModel.js";
import Inventory from "../models/inventoryModel.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

// Create a new warehouse
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

// Get all warehouses for this shop
router.get("/", protect, async (req, res) => {
  try {
    const warehouses = await Warehouse.find({ shopId: req.shop._id });
    
    // Add storage usage info for each warehouse
    const warehousesWithStorage = await Promise.all(
      warehouses.map(async (warehouse) => {
        const inventoryItems = await Inventory.find({ warehouseId: warehouse._id });
        
        // Sum up all the quantities
        const usedStorage = inventoryItems.reduce((total, item) => total + item.quantity, 0);
        const remainingStorage = warehouse.capacity - usedStorage;
        const usagePercentage = warehouse.capacity > 0 
          ? Math.round((usedStorage / warehouse.capacity) * 100) 
          : 0;
        
        return {
          ...warehouse.toObject(),
          storageInfo: {
            used: usedStorage,
            remaining: remainingStorage,
            total: warehouse.capacity,
            usagePercentage,
            itemCount: inventoryItems.length
          }
        };
      })
    );
    
    res.json(warehousesWithStorage);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
});

// Delete a warehouse
router.delete("/:id", protect, async (req, res) => {
  try {
    const warehouseId = req.params.id;
    const shopId = req.shop._id;

    // Make sure this warehouse belongs to the current shop
    const warehouse = await Warehouse.findOne({
      _id: warehouseId,
      shopId: shopId,
    });

    if (!warehouse) {
      return res.status(404).json({ message: "Warehouse not found or unauthorized" });
    }

    // Don't let them delete if it still has items in it
    const inventoryCount = await Inventory.countDocuments({ warehouseId: warehouse._id });

    if (inventoryCount > 0) {
      return res.status(400).json({
        message: `Cannot delete warehouse. It contains ${inventoryCount} inventory item(s). Please remove all inventory items first.`,
      });
    }

    // All good, remove it
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

// Update warehouse details
router.put("/:id", protect, async (req, res) => {
  try {
    const warehouseId = req.params.id;
    const { name, location, capacity } = req.body;

    // Make sure this warehouse belongs to the current shop
    const warehouse = await Warehouse.findOne({
      _id: warehouseId,
      shopId: req.shop._id,
    });

    if (!warehouse) {
      return res.status(404).json({ message: "Warehouse not found or unauthorized" });
    }

    // If they're lowering capacity, make sure they have room
    if (capacity !== undefined && capacity < warehouse.capacity) {
      const inventoryItems = await Inventory.find({ warehouseId: warehouse._id });
      const usedStorage = inventoryItems.reduce((total, item) => total + item.quantity, 0);
      
      if (usedStorage > capacity) {
        return res.status(400).json({
          message: `Cannot reduce capacity to ${capacity}. Current storage usage is ${usedStorage} units. Please remove items first.`,
        });
      }
    }

    // Apply the updates
    if (name !== undefined) warehouse.name = name;
    if (location !== undefined) warehouse.location = location;
    if (capacity !== undefined) warehouse.capacity = capacity;

    await warehouse.save();
    res.json(warehouse);
  } catch (error) {
    console.error("Error updating warehouse:", error);
    res.status(500).json({ 
      message: "Server Error", 
      error: error.message
    });
  }
});

export default router;
