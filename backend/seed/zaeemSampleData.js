import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import mongoose from "mongoose";
import Inventory from "../models/inventoryModel.js";
import Shop from "../models/shopModel.js";
import Warehouse from "../models/warehouseModel.js";

dotenv.config();

const ownerEmail = "zaeem.ansari@stockmate.test";
const defaultPassword = "Zaeem@123";
const securityQuestion = "What was the name of your first school?";
const securityAnswer = "stockmate";

const warehouses = [
  {
    name: "Main Grocery Warehouse",
    location: "Mumbai Central",
    capacity: 1200,
  },
  {
    name: "Daily Essentials Store Room",
    location: "Andheri West",
    capacity: 800,
  },
  {
    name: "Electronics & Stationery Rack",
    location: "Bandra",
    capacity: 450,
  },
];

const inventoryByWarehouse = {
  "Main Grocery Warehouse": [
    {
      productName: "Parle-G 100g",
      sku: "PARLE-G-100",
      quantity: 180,
      price: 10,
      category: "Snacks/Biscuits",
    },
    {
      productName: "Oreo Chocolate Cookies",
      sku: "OREO-CHOCO-120",
      quantity: 95,
      price: 35,
      category: "Snacks/Biscuits",
    },
    {
      productName: "Basmati Rice 5kg",
      sku: "BASMATI-RICE-5KG",
      quantity: 64,
      price: 620,
      category: "Grains/Rice",
    },
    {
      productName: "Toor Dal 1kg",
      sku: "TOOR-DAL-1KG",
      quantity: 88,
      price: 145,
      category: "Grains/Rice",
    },
  ],
  "Daily Essentials Store Room": [
    {
      productName: "Amul Butter 500g",
      sku: "AMUL-BUTTER-500",
      quantity: 42,
      price: 275,
      category: "Dairy",
    },
    {
      productName: "Tata Tea Premium 1kg",
      sku: "TATA-TEA-1KG",
      quantity: 56,
      price: 520,
      category: "Beverages",
    },
    {
      productName: "Surf Excel Detergent 1kg",
      sku: "SURF-EXCEL-1KG",
      quantity: 73,
      price: 235,
      category: "Household/Cleaning",
    },
    {
      productName: "Colgate Toothpaste 200g",
      sku: "COLGATE-PASTE-200",
      quantity: 110,
      price: 115,
      category: "Personal Care",
    },
  ],
  "Electronics & Stationery Rack": [
    {
      productName: "USB-C Fast Charger",
      sku: "USBC-CHARGER-25W",
      quantity: 34,
      price: 799,
      category: "Electronics",
    },
    {
      productName: "Bluetooth Speaker Mini",
      sku: "BT-SPEAKER-MINI",
      quantity: 18,
      price: 1299,
      category: "Electronics",
    },
    {
      productName: "Classmate Notebook 200 Pages",
      sku: "CLASSMATE-NB-200",
      quantity: 140,
      price: 65,
      category: "Stationery",
    },
    {
      productName: "Dolo 650 Tablet Strip",
      sku: "DOLO-650-STRIP",
      quantity: 27,
      price: 32,
      category: "Medicines/Health",
    },
  ],
};

const connect = async () => {
  if (!process.env.MONGO_URL) {
    throw new Error("MONGO_URL is missing. Add it to backend/.env before seeding.");
  }

  await mongoose.connect(process.env.MONGO_URL);
};

const upsertShop = async () => {
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);
  const hashedAnswer = await bcrypt.hash(securityAnswer, 10);

  return Shop.findOneAndUpdate(
    { email: ownerEmail },
    {
      name: "Zaeem Ansari",
      email: ownerEmail,
      password: hashedPassword,
      role: "owner",
      parentShopId: null,
      phone: "9876543210",
      address: "StockMate Demo Shop, Mumbai",
      securityQuestion,
      securityAnswer: hashedAnswer,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

const upsertStaff = async (ownerId) => {
  const staffPassword = await bcrypt.hash(defaultPassword, 10);
  const hashedAnswer = await bcrypt.hash(securityAnswer, 10);

  const staff = [
    {
      name: "Ayesha Khan",
      email: "ayesha.manager@stockmate.test",
      role: "manager",
      phone: "9876543211",
      address: "Mumbai",
    },
    {
      name: "Rahul Sharma",
      email: "rahul.employee@stockmate.test",
      role: "employee",
      phone: "9876543212",
      address: "Mumbai",
    },
  ];

  await Promise.all(
    staff.map((member) =>
      Shop.findOneAndUpdate(
        { email: member.email },
        {
          ...member,
          password: staffPassword,
          parentShopId: ownerId,
          securityQuestion,
          securityAnswer: hashedAnswer,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )
    )
  );
};

const seedWarehousesAndInventory = async (shopId) => {
  const savedWarehouses = {};

  for (const warehouse of warehouses) {
    savedWarehouses[warehouse.name] = await Warehouse.findOneAndUpdate(
      { shopId, name: warehouse.name },
      { ...warehouse, shopId },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  for (const [warehouseName, items] of Object.entries(inventoryByWarehouse)) {
    const warehouse = savedWarehouses[warehouseName];

    for (const item of items) {
      await Inventory.findOneAndUpdate(
        { shopId, sku: item.sku },
        {
          ...item,
          shopId,
          warehouseId: warehouse._id,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
  }
};

const run = async () => {
  try {
    await connect();
    const owner = await upsertShop();
    await upsertStaff(owner._id);
    await seedWarehousesAndInventory(owner._id);

    console.log("Sample data added for Zaeem Ansari.");
    console.log(`Login email: ${ownerEmail}`);
    console.log(`Password: ${defaultPassword}`);
  } catch (error) {
    console.error("Failed to seed sample data:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

run();
