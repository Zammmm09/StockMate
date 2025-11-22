import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/db.js";
import shopRoutes from "./routes/shopRoutes.js";
import warehouseRoutes from "./routes/warehouseRoutes.js";
import inventoryRoutes from "./routes/inventoryRoutes.js";
import authRoutes from "./routes/authRoutes.js";

dotenv.config();
const app = express();

// Middleware
app.use(cors());
app.use(express.json()); // parse JSON bodies

// Routes
app.use("/api/shop", shopRoutes);
app.use("/api/warehouse", warehouseRoutes);
app.use("/api/inventory", inventoryRoutes);

// Authentication routes (register / login)
app.use("/api", authRoutes);

// Define the port
const PORT = process.env.PORT || 5000;

// Start the server
connectDB()
  .then(() => {
    const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    server.on("error", (err) => {
      console.error("Server error:", err);
      process.exit(1);
    });
  })
  .catch((err) => {
    console.error("DB connection error:", err);
    process.exit(1);
  });
