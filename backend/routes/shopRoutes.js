import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Shop from "../models/shopModel.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

// Register Shop
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, phone, address } = req.body;

    if (await Shop.findOne({ email })) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const shop = await Shop.create({ name, email, password: hashedPassword, phone, address });

    res.status(201).json({ message: "Shop registered successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
});

// Shop Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const shop = await Shop.findOne({ email });

    if (!shop || !(await bcrypt.compare(password, shop.password))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ id: shop._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.json({ token, shop: { id: shop._id, name: shop.name, email: shop.email } });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
});

// ✅ GET Shop Profile (Protected)
router.get("/profile", protect, async (req, res) => {
  try {
    const shop = await Shop.findById(req.shop.id).select("-password");
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }
    res.json(shop);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
});

export default router;
