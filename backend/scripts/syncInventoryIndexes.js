import dotenv from "dotenv";
import mongoose from "mongoose";
import Inventory from "../models/inventoryModel.js";

dotenv.config();

const run = async () => {
  if (!process.env.MONGO_URL) {
    throw new Error("MONGO_URL is missing. Add it to backend/.env first.");
  }

  await mongoose.connect(process.env.MONGO_URL);

  const collection = Inventory.collection;
  const indexes = await collection.indexes();
  const oldSkuIndex = indexes.find(
    (index) =>
      index.unique &&
      index.key?.shopId === 1 &&
      index.key?.sku === 1 &&
      !index.key?.warehouseId
  );

  if (oldSkuIndex) {
    await collection.dropIndex(oldSkuIndex.name);
    console.log(`Dropped old inventory index: ${oldSkuIndex.name}`);
  }

  await Inventory.syncIndexes();
  console.log("Inventory indexes synced.");
};

run()
  .catch((error) => {
    console.error("Failed to sync inventory indexes:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
