import express from "express";
import Warehouse from "../models/warehouseModel.js";
import Inventory from "../models/inventoryModel.js";
import protect from "../middleware/authMiddleware.js";
import requireRoles from "../middleware/roleMiddleware.js";
import logActivity from "../utils/activityLogger.js";

const router = express.Router();

// Create a new warehouse
router.post("/", protect, requireRoles("owner", "manager"), async (req, res) => {
  try {
    const { name, location, capacity } = req.body;
    const shopId = req.accessShopId || req.shop._id;

    const warehouse = await Warehouse.create({
      shopId,
      name,
      location,
      capacity,
    });

    await logActivity({
      req,
      action: "create",
      entityType: "warehouse",
      entityId: warehouse._id,
      summary: `Created warehouse ${name}`,
      metadata: { name, location, capacity },
    });

    res.status(201).json(warehouse);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
});

// Get all warehouses for this shop
router.get("/", protect, async (req, res) => {
  try {
    const shopId = req.accessShopId || req.shop._id;
    const warehouses = await Warehouse.find({ shopId });
    
    // Add storage usage info for each warehouse
    const warehousesWithStorage = await Promise.all(
      warehouses.map(async (warehouse) => {
        const inventoryItems = await Inventory.find({
          warehouseId: warehouse._id,
          shopId,
        });
        
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
router.delete("/:id", protect, requireRoles("owner"), async (req, res) => {
  try {
    const warehouseId = req.params.id;
    const shopId = req.accessShopId || req.shop._id;

    // Make sure this warehouse belongs to the current shop
    const warehouse = await Warehouse.findOne({
      _id: warehouseId,
      shopId: shopId,
    });

    if (!warehouse) {
      return res.status(404).json({ message: "Warehouse not found or unauthorized" });
    }

    // Don't let them delete if it still has items in it
    const inventoryCount = await Inventory.countDocuments({
      warehouseId: warehouse._id,
      shopId,
    });

    if (inventoryCount > 0) {
      return res.status(400).json({
        message: `Cannot delete warehouse. It contains ${inventoryCount} inventory item(s). Please remove all inventory items first.`,
      });
    }

    // All good, remove it
    await Warehouse.findByIdAndDelete(warehouseId);

    await logActivity({
      req,
      action: "delete",
      entityType: "warehouse",
      entityId: warehouseId,
      summary: `Deleted warehouse ${warehouse.name}`,
      metadata: { name: warehouse.name, location: warehouse.location, capacity: warehouse.capacity },
    });

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
router.put("/:id", protect, requireRoles("owner", "manager"), async (req, res) => {
  try {
    const warehouseId = req.params.id;
    const { name, location, capacity } = req.body;
    const shopId = req.accessShopId || req.shop._id;

    // Make sure this warehouse belongs to the current shop
    const warehouse = await Warehouse.findOne({
      _id: warehouseId,
      shopId,
    });

    if (!warehouse) {
      return res.status(404).json({ message: "Warehouse not found or unauthorized" });
    }

    const previousState = {
      name: warehouse.name,
      location: warehouse.location,
      capacity: warehouse.capacity,
    };

    // If they're lowering capacity, make sure they have room
    if (capacity !== undefined && capacity < warehouse.capacity) {
      const inventoryItems = await Inventory.find({
        warehouseId: warehouse._id,
        shopId,
      });
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

    await logActivity({
      req,
      action: "update",
      entityType: "warehouse",
      entityId: warehouse._id,
      summary: `Updated warehouse ${warehouse.name}`,
      metadata: { before: previousState, after: { name: warehouse.name, location: warehouse.location, capacity: warehouse.capacity } },
    });

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
