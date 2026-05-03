import StockMovement from "../models/stockMovementModel.js";

const getMovementType = (oldQuantity, newQuantity, fallback = "adjust") => {
  if (
    fallback === "create" ||
    fallback === "delete" ||
    fallback === "bulk-adjust" ||
    fallback === "transfer-in" ||
    fallback === "transfer-out"
  ) {
    return fallback;
  }

  if (newQuantity > oldQuantity) return "increase";
  if (newQuantity < oldQuantity) return "decrease";
  return "adjust";
};

const logStockMovement = async ({
  req,
  inventoryItem,
  oldQuantity,
  newQuantity,
  movementType = "adjust",
  reason = "",
  metadata = {},
}) => {
  try {
    if (!req?.shop || !inventoryItem) return null;

    const previousQuantity = Number(oldQuantity) || 0;
    const nextQuantity = Number(newQuantity) || 0;

    return StockMovement.create({
      shopId: req.accessShopId || req.shop._id,
      inventoryId: inventoryItem._id || null,
      warehouseId: inventoryItem.warehouseId || null,
      productName: inventoryItem.productName,
      sku: inventoryItem.sku,
      actorId: req.shop._id,
      actorName: req.shop.name,
      actorRole: req.shopRole || req.shop.role || "owner",
      movementType: getMovementType(previousQuantity, nextQuantity, movementType),
      oldQuantity: previousQuantity,
      newQuantity: nextQuantity,
      quantityChange: nextQuantity - previousQuantity,
      reason,
      metadata,
    });
  } catch (error) {
    console.error("Failed to write stock movement:", error.message);
    return null;
  }
};

export default logStockMovement;
