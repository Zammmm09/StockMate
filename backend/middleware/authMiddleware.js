import jwt from "jsonwebtoken";
import Shop from "../models/shopModel.js";

const protect = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.shop = await Shop.findById(decoded.id).select("-password");
    if (!req.shop) return res.status(401).json({ message: "Shop not found" });

    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid Token" });
  }
};

export default protect;