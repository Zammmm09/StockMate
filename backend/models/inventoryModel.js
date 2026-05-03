import mongoose from "mongoose";

const inventorySchema = new mongoose.Schema(
  {
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: "Shop", required: true },
    warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: "Warehouse", required: true },
    productName: { type: String, required: true, trim: true },
    sku: { type: String, required: true, uppercase: true, trim: true },
    quantity: { type: Number, required: true, min: 0 },
    price: { type: Number, required: true, min: 0 },
    category: { type: String, required: true },
  },
  { timestamps: true }
);

// Enforce SKU uniqueness within each warehouse for a shop.
// The same SKU can exist in multiple warehouses so stock can be transferred.
inventorySchema.index({ shopId: 1, warehouseId: 1, sku: 1 }, { unique: true });

const Inventory = mongoose.model("Inventory", inventorySchema);
export default Inventory;
