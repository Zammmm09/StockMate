import express from "express";
import Inventory from "../models/inventoryModel.js";
import Warehouse from "../models/warehouseModel.js";
import protect from "../middleware/authMiddleware.js";
import requireRoles from "../middleware/roleMiddleware.js";
import logActivity from "../utils/activityLogger.js";
import logStockMovement from "../utils/stockMovementLogger.js";

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

    await logStockMovement({
      req,
      inventoryItem: inventory,
      oldQuantity: 0,
      newQuantity: inventory.quantity,
      movementType: "create",
      reason: "Product added",
      metadata: { price: inventory.price, category: inventory.category },
    });

    res.status(201).json(inventory);
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.sku) {
      return res.status(409).json({
        message: `SKU '${req.body?.sku}' already exists in this warehouse. Use a unique SKU or update the existing item.`,
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

// Transfer stock from one warehouse to another
router.post("/:id/transfer", protect, requireRoles("owner", "manager", "employee"), async (req, res) => {
  try {
    const { destinationWarehouseId, quantity, reason = "" } = req.body;
    const shopId = req.accessShopId || req.shop._id;
    const transferQuantity = Number(quantity);

    if (!destinationWarehouseId || !Number.isFinite(transferQuantity) || transferQuantity <= 0) {
      return res.status(400).json({ message: "Destination warehouse and a positive quantity are required" });
    }

    const sourceItem = await Inventory.findOne({ _id: req.params.id, shopId });
    if (!sourceItem) {
      return res.status(404).json({ message: "Source product not found or unauthorized" });
    }

    if (String(sourceItem.warehouseId) === String(destinationWarehouseId)) {
      return res.status(400).json({ message: "Choose a different destination warehouse" });
    }

    if (sourceItem.quantity < transferQuantity) {
      return res.status(400).json({ message: `Only ${sourceItem.quantity} units available to transfer` });
    }

    const destinationWarehouse = await Warehouse.findOne({
      _id: destinationWarehouseId,
      shopId,
    });

    if (!destinationWarehouse) {
      return res.status(404).json({ message: "Destination warehouse not found or unauthorized" });
    }

    const destinationUsed = await Inventory.aggregate([
      { $match: { shopId, warehouseId: destinationWarehouse._id } },
      { $group: { _id: null, total: { $sum: "$quantity" } } },
    ]);
    const usedStorage = destinationUsed[0]?.total || 0;

    if (usedStorage + transferQuantity > destinationWarehouse.capacity) {
      return res.status(400).json({
        message: `Not enough destination capacity. ${destinationWarehouse.capacity - usedStorage} units available.`,
      });
    }

    const sourceOldQuantity = sourceItem.quantity;
    let destinationItem = await Inventory.findOne({
      shopId,
      warehouseId: destinationWarehouse._id,
      sku: sourceItem.sku,
    });

    const destinationOldQuantity = destinationItem?.quantity || 0;

    sourceItem.quantity = sourceOldQuantity - transferQuantity;
    await sourceItem.save();

    if (destinationItem) {
      destinationItem.quantity = destinationOldQuantity + transferQuantity;
      destinationItem.productName = sourceItem.productName;
      destinationItem.price = sourceItem.price;
      destinationItem.category = sourceItem.category;
      await destinationItem.save();
    } else {
      destinationItem = await Inventory.create({
        shopId,
        warehouseId: destinationWarehouse._id,
        productName: sourceItem.productName,
        sku: sourceItem.sku,
        quantity: transferQuantity,
        price: sourceItem.price,
        category: sourceItem.category,
      });
    }

    await logStockMovement({
      req,
      inventoryItem: sourceItem,
      oldQuantity: sourceOldQuantity,
      newQuantity: sourceItem.quantity,
      movementType: "transfer-out",
      reason: reason || `Transferred to ${destinationWarehouse.name}`,
      metadata: {
        destinationWarehouseId: destinationWarehouse._id,
        destinationWarehouseName: destinationWarehouse.name,
        transferQuantity,
      },
    });

    await logStockMovement({
      req,
      inventoryItem: destinationItem,
      oldQuantity: destinationOldQuantity,
      newQuantity: destinationItem.quantity,
      movementType: "transfer-in",
      reason: reason || `Transferred from source warehouse`,
      metadata: {
        sourceWarehouseId: sourceItem.warehouseId,
        sourceInventoryId: sourceItem._id,
        transferQuantity,
      },
    });

    await logActivity({
      req,
      action: "transfer",
      entityType: "inventory",
      entityId: sourceItem._id,
      summary: `Transferred ${transferQuantity} units of ${sourceItem.productName}`,
      metadata: {
        sku: sourceItem.sku,
        sourceInventoryId: sourceItem._id,
        destinationInventoryId: destinationItem._id,
        destinationWarehouseId: destinationWarehouse._id,
        transferQuantity,
      },
    });

    res.json({ sourceItem, destinationItem });
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.sku) {
      return res.status(409).json({
        message: "This SKU already exists in the destination warehouse. Try again after refreshing inventory.",
      });
    }

    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid transfer data format" });
    }

    res.status(500).json({ message: "Server Error", error: error.message });
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

    await logActivity({
      req,
      action: "delete",
      entityType: "inventory",
      entityId: inventoryItem._id,
      summary: `Deleted product ${inventoryItem.productName}`,
      metadata: { productName: inventoryItem.productName, sku: inventoryItem.sku },
    });

    await logStockMovement({
      req,
      inventoryItem,
      oldQuantity: inventoryItem.quantity,
      newQuantity: 0,
      movementType: "delete",
      reason: "Product deleted",
      metadata: {
        price: inventoryItem.price,
        category: inventoryItem.category,
      },
    });

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

    const oldQuantity = Number(inventoryItem.quantity) || 0;

    // Only update the fields they actually sent
    if (quantity !== undefined) inventoryItem.quantity = Number(quantity);
    if (price !== undefined) inventoryItem.price = Number(price);
    if (productName !== undefined) inventoryItem.productName = productName;
    if (category !== undefined) inventoryItem.category = category;

    await inventoryItem.save();
    const newQuantity = Number(inventoryItem.quantity) || 0;

    await logActivity({
      req,
      action: "update",
      entityType: "inventory",
      entityId: inventoryItem._id,
      summary: `Updated inventory item ${inventoryItem.productName}`,
      metadata: { before: previousState, after: { productName: inventoryItem.productName, sku: inventoryItem.sku, quantity: inventoryItem.quantity, price: inventoryItem.price, category: inventoryItem.category } },
    });

    await logStockMovement({
      req,
      inventoryItem,
      oldQuantity,
      newQuantity,
      movementType: "adjust",
      reason:
        oldQuantity === newQuantity
          ? "Inventory details edited"
          : newQuantity > oldQuantity
            ? "Quantity increased"
            : "Quantity decreased",
      metadata: {
        before: previousState,
        after: {
          productName: inventoryItem.productName,
          sku: inventoryItem.sku,
          quantity: inventoryItem.quantity,
          price: inventoryItem.price,
          category: inventoryItem.category,
        },
      },
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
        const oldQuantity = Number(inventoryItem.quantity) || 0;
        inventoryItem.quantity = Number(quantity);
        const savedItem = await inventoryItem.save();

        await logStockMovement({
          req,
          inventoryItem: savedItem,
          oldQuantity,
          newQuantity: savedItem.quantity,
          movementType: "bulk-adjust",
          reason: "Bulk quantity update",
        });

        return savedItem;
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
