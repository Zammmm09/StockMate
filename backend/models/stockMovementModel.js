import mongoose from "mongoose";

const stockMovementSchema = new mongoose.Schema(
  {
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
      index: true,
    },
    inventoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Inventory",
      default: null,
      index: true,
    },
    warehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      default: null,
    },
    productName: {
      type: String,
      required: true,
    },
    sku: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
    },
    actorName: {
      type: String,
      required: true,
    },
    actorRole: {
      type: String,
      enum: ["owner", "manager", "employee"],
      required: true,
    },
    movementType: {
      type: String,
      enum: ["create", "increase", "decrease", "adjust", "delete", "bulk-adjust", "transfer-in", "transfer-out"],
      required: true,
    },
    oldQuantity: {
      type: Number,
      required: true,
      min: 0,
    },
    newQuantity: {
      type: Number,
      required: true,
      min: 0,
    },
    quantityChange: {
      type: Number,
      required: true,
    },
    reason: {
      type: String,
      default: "",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

stockMovementSchema.index({ shopId: 1, createdAt: -1 });
stockMovementSchema.index({ shopId: 1, sku: 1, createdAt: -1 });

const StockMovement = mongoose.model("StockMovement", stockMovementSchema);

export default StockMovement;
