import express from "express";
import Inventory from "../models/inventoryModel.js";
import Warehouse from "../models/warehouseModel.js";
import protect from "../middleware/authMiddleware.js";
import requireRoles from "../middleware/roleMiddleware.js";
import logActivity from "../utils/activityLogger.js";

const router = express.Router();

// Add a new product to inventory
router.post("/", protect, requireRoles("owner", "manager", "employee"), async (req, res) => {
  try {
    const { warehouseId, productName, sku, quantity, price, category } =
      req.body;
    const shopId = req.accessShopId || req.shop._id;

    if (!warehouseId || !productName || !sku || quantity === undefined || price === undefined || !category) {
      return res.status(400).json({ message: "All inventory fields are required" });
    }

    if (Number(quantity) < 0 || Number(price) < 0) {
      return res.status(400).json({ message: "Quantity and price must be 0 or greater" });
    }

    // Make sure the warehouse belongs to this shop
    const warehouse = await Warehouse.findOne({
      _id: warehouseId,
      shopId,
    });
    if (!warehouse)
      return res
        .status(403)
        .json({ message: "Unauthorized: Warehouse not found" });

    const inventory = await Inventory.create({
      shopId,
      warehouseId,
      productName,
      sku,
      quantity: Number(quantity),
      price: Number(price),
      category,
    });

    await logActivity({
      req,
      action: "create",
      entityType: "inventory",
      entityId: inventory._id,
      summary: `Added product ${productName} to inventory`,
      metadata: { warehouseId, productName, sku, quantity: Number(quantity), price: Number(price), category },
    });

    res.status(201).json(inventory);
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.sku) {
      return res.status(409).json({
        message: `SKU '${req.body?.sku}' already exists for this shop. Use a unique SKU.`,
      });
    }

    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid warehouse or inventory data format" });
    }

    if (error.name === "ValidationError") {
      const firstMessage = Object.values(error.errors)[0]?.message || "Invalid inventory data";
      return res.status(400).json({ message: firstMessage });
    }

    res.status(500).json({ message: "Server Error" });
  }
});

// Delete a product from inventory
router.delete("/:id", protect, requireRoles("owner", "manager", "employee"), async (req, res) => {
  try {
    const shopId = req.accessShopId || req.shop._id;
    const inventoryItem = await Inventory.findOne({
      _id: req.params.id,
      shopId,
    });

    if (!inventoryItem)
      return res
        .status(404)
        .json({ message: "Product not found or unauthorized" });

    await inventoryItem.deleteOne();

    await logActivity({
      req,
      action: "delete",
      entityType: "inventory",
      entityId: inventoryItem._id,
      summary: `Deleted product ${inventoryItem.productName}`,
      metadata: { productName: inventoryItem.productName, sku: inventoryItem.sku },
    });

    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
});

// Update inventory item - can change quantity, price, etc.
router.put("/:id", protect, async (req, res) => {
  try {
    const { quantity, price, productName, category } = req.body;
    const shopId = req.accessShopId || req.shop._id;

    const inventoryItem = await Inventory.findOne({
      _id: req.params.id,
      shopId,
    });
    if (!inventoryItem)
      return res
        .status(404)
        .json({ message: "Product not found or unauthorized" });

    const previousState = {
      productName: inventoryItem.productName,
      sku: inventoryItem.sku,
      quantity: inventoryItem.quantity,
      price: inventoryItem.price,
      category: inventoryItem.category,
    };

    // Only update the fields they actually sent
    if (quantity !== undefined) inventoryItem.quantity = quantity;
    if (price !== undefined) inventoryItem.price = price;
    if (productName !== undefined) inventoryItem.productName = productName;
    if (category !== undefined) inventoryItem.category = category;

    await inventoryItem.save();

    await logActivity({
      req,
      action: "update",
      entityType: "inventory",
      entityId: inventoryItem._id,
      summary: `Updated inventory item ${inventoryItem.productName}`,
      metadata: { before: previousState, after: { productName: inventoryItem.productName, sku: inventoryItem.sku, quantity: inventoryItem.quantity, price: inventoryItem.price, category: inventoryItem.category } },
    });

    res.json(inventoryItem);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
});

// Get inventory organized by warehouse - this route needs to be before the general GET route
router.get("/by-warehouse", protect, async (req, res) => {
  try {
    const shopId = req.accessShopId || req.shop._id;
    const warehouses = await Warehouse.find({ shopId });
    const inventory = await Inventory.find({ shopId });

    const warehouseGroups = warehouses.map(warehouse => {
      const products = inventory.filter(
        item => item.warehouseId.toString() === warehouse._id.toString()
      );

      const totalItems = products.reduce((sum, item) => sum + item.quantity, 0);
      const totalValue = products.reduce((sum, item) => sum + (item.quantity * item.price), 0);

      return {
        warehouse: {
          _id: warehouse._id,
          name: warehouse.name,
          location: warehouse.location,
          capacity: warehouse.capacity
        },
        products,
        stats: {
          productCount: products.length,
          totalItems,
          totalValue: totalValue.toFixed(2)
        }
      };
    });

    res.json(warehouseGroups);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
});

// Get all inventory items for this shop
router.get("/", protect, async (req, res) => {
  try {
    const shopId = req.accessShopId || req.shop._id;
    const inventory = await Inventory.find({ shopId });
    res.json(inventory);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
});

// Update multiple inventory quantities at once
router.patch("/update-quantities", protect, async (req, res) => {
  try {
    const updates = req.body.updates; // Expecting an array like [{ id, quantity }]
    const shopId = req.accessShopId || req.shop._id;

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ message: "Invalid input format" });
    }

    const updatePromises = updates.map(async ({ id, quantity }) => {
      const inventoryItem = await Inventory.findOne({
        _id: id,
        shopId,
      });
      if (inventoryItem) {
        inventoryItem.quantity = quantity;
        return inventoryItem.save();
      }
      return null;
    });

    const updatedItems = (await Promise.all(updatePromises)).filter(Boolean);

    res.json({
      message: "Inventory quantities updated successfully",
      updatedItems,
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
});

export default router;
