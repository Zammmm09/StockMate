import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/db.js";
import shopRoutes from "./routes/shopRoutes.js";
import activityRoutes from "./routes/activityRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import warehouseRoutes from "./routes/warehouseRoutes.js";
import inventoryRoutes from "./routes/inventoryRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import { initSocket } from "./utils/socket.js";

dotenv.config();
const app = express();

// Setup middleware for handling requests
app.use(cors());
app.use(express.json()); // So we can read JSON from request bodies

// Routes
app.use("/api/shop", shopRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/warehouse", warehouseRoutes);
app.use("/api/inventory", inventoryRoutes);

// These handle user registration and login
app.use("/api", authRoutes);

// Server will run on this port
const PORT = process.env.PORT || 5000;

// Connect to MongoDB then start listening
connectDB()
  .then(() => {
    const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    // Initialize Socket.IO
    try {
      const io = initSocket(server);
      console.log("Socket.IO initialized");
      io.on("connection", (socket) => {
        // optional: log connection
      });
    } catch (err) {
      console.warn("Socket.IO initialization failed:", err.message || err);
    }

    server.on("error", (err) => {
      console.error("Server error:", err);
      process.exit(1);
    });
  })
  .catch((err) => {
    console.error("DB connection error:", err);
    process.exit(1);
  });
