import express from "express";
import Inventory from "../models/inventoryModel.js";
import Warehouse from "../models/warehouseModel.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

// Add a new product to inventory
router.post("/", protect, async (req, res) => {
  try {
    const { warehouseId, productName, sku, quantity, price, category } =
      req.body;

    // Make sure the warehouse belongs to this shop
    const warehouse = await Warehouse.findOne({
      _id: warehouseId,
      shopId: req.shop._id,
    });
    if (!warehouse)
      return res
        .status(403)
        .json({ message: "Unauthorized: Warehouse not found" });

    const inventory = await Inventory.create({
      shopId: req.shop._id,
      warehouseId,
      productName,
      sku,
      quantity,
      price,
      category,
    });

    res.status(201).json(inventory);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
});

// Delete a product from inventory
router.delete("/:id", protect, async (req, res) => {
  try {
    const inventoryItem = await Inventory.findOne({
      _id: req.params.id,
      shopId: req.shop._id,
    });

    if (!inventoryItem)
      return res
        .status(404)
        .json({ message: "Product not found or unauthorized" });

    await inventoryItem.deleteOne();
    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
});

// Update inventory item - can change quantity, price, etc.
router.put("/:id", protect, async (req, res) => {
  try {
    const { quantity, price, productName, category } = req.body;

    const inventoryItem = await Inventory.findOne({
      _id: req.params.id,
      shopId: req.shop._id,
    });
    if (!inventoryItem)
      return res
        .status(404)
        .json({ message: "Product not found or unauthorized" });

    // Only update the fields they actually sent
    if (quantity !== undefined) inventoryItem.quantity = quantity;
    if (price !== undefined) inventoryItem.price = price;
    if (productName !== undefined) inventoryItem.productName = productName;
    if (category !== undefined) inventoryItem.category = category;

    await inventoryItem.save();

    res.json(inventoryItem);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
});

// Get inventory organized by warehouse - this route needs to be before the general GET route
router.get("/by-warehouse", protect, async (req, res) => {
  try {
    const warehouses = await Warehouse.find({ shopId: req.shop._id });
    const inventory = await Inventory.find({ shopId: req.shop._id });

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
    const inventory = await Inventory.find({ shopId: req.shop._id }).populate('warehouseId');
    res.json(inventory);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
});

// Update multiple inventory quantities at once
router.patch("/update-quantities", protect, async (req, res) => {
  try {
    const updates = req.body.updates; // Expecting an array like [{ id, quantity }]

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ message: "Invalid input format" });
    }

    const updatePromises = updates.map(async ({ id, quantity }) => {
      const inventoryItem = await Inventory.findOne({
        _id: id,
        shopId: req.shop._id,
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
