import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Shop from "../models/shopModel.js";
import protect from "../middleware/authMiddleware.js";
import requireRoles from "../middleware/roleMiddleware.js";
import logActivity from "../utils/activityLogger.js";

const router = express.Router();

// Handle new shop registration
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, phone, address, securityQuestion, securityAnswer } = req.body;
    const normalizedEmail = email?.toLowerCase();

    if (await Shop.findOne({ email: normalizedEmail })) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const hashedAnswer = await bcrypt.hash(securityAnswer.toLowerCase().trim(), 10);
    
    const shop = await Shop.create({ 
      name, 
      email: normalizedEmail, 
      password: hashedPassword, 
      role: "owner",
      parentShopId: null,
      phone, 
      address,
      securityQuestion,
      securityAnswer: hashedAnswer
    });

    res.status(201).json({ message: "Shop registered successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
});

// Handle shop login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const shop = await Shop.findOne({ email: email.toLowerCase() });

    if (!shop || !(await bcrypt.compare(password, shop.password))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ id: shop._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.json({
      token,
      shop: {
        _id: shop._id,
        id: shop._id,
        name: shop.name,
        email: shop.email,
        role: shop.role || "owner",
        parentShopId: shop.parentShopId || null,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
});

// Get shop profile data - requires authentication
router.get("/profile", protect, async (req, res) => {
  try {
    const shop = await Shop.findById(req.shop.id).select("-password");
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }
    res.json({ shop });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
});

// Update shop profile - requires authentication
router.put("/:id", protect, async (req, res) => {
  try {
    const { name, email, phone, address, securityQuestion, securityAnswer } = req.body;
    const shopId = req.params.id;

    // Make sure shops can only update their own profile
    if (req.shop.id.toString() !== shopId) {
      return res.status(403).json({ 
        success: false, 
        message: "Not authorized to update this shop" 
      });
    }

    // Get the shop from database
    const shop = await Shop.findById(shopId);
    
    if (!shop) {
      return res.status(404).json({ 
        success: false, 
        message: "Shop not found" 
      });
    }

    // Update the basic info fields
    if (name) shop.name = name;
    if (email) shop.email = email;
    if (phone !== undefined) shop.phone = phone;
    if (address !== undefined) shop.address = address;
    
    // Only update security question if they're actually changing it
    if (securityQuestion && securityQuestion.trim() !== '' && securityQuestion !== shop.securityQuestion) {
      if (!securityAnswer || securityAnswer.trim() === '') {
        return res.status(400).json({
          success: false,
          message: "Security answer is required when changing security question"
        });
      }
      shop.securityQuestion = securityQuestion;
      const hashedAnswer = await bcrypt.hash(securityAnswer.toLowerCase().trim(), 10);
      shop.securityAnswer = hashedAnswer;
    }

    const updatedShop = await shop.save();

    res.json({ 
      success: true, 
      message: "Profile updated successfully",
      shop: {
        _id: updatedShop._id,
        name: updatedShop.name,
        email: updatedShop.email,
        role: updatedShop.role,
        phone: updatedShop.phone,
        address: updatedShop.address,
        securityQuestion: updatedShop.securityQuestion
      }
    });
  } catch (error) {
    console.error("Update shop error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error while updating profile" 
    });
  }
});

// Check if email exists and send back the security question for password reset
router.post("/verify-email", async (req, res) => {
  try {
    const { email } = req.body;
    
    const shop = await Shop.findOne({ email: email.toLowerCase() });
    
    if (!shop) {
      return res.status(404).json({ 
        success: false, 
        message: "No account found with this email" 
      });
    }

    res.json({ 
      success: true, 
      securityQuestion: shop.securityQuestion 
    });
  } catch (error) {
    console.error("Verify email error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error" 
    });
  }
});

// Reset password using security question - no email needed
router.post("/reset-password", async (req, res) => {
  try {
    const { email, securityAnswer, newPassword } = req.body;
    
    const shop = await Shop.findOne({ email: email.toLowerCase() });
    
    if (!shop) {
      return res.status(404).json({ 
        success: false, 
        message: "No account found with this email" 
      });
    }

    // Check if the security answer matches
    const isAnswerCorrect = await bcrypt.compare(
      securityAnswer.toLowerCase().trim(), 
      shop.securityAnswer
    );
    
    if (!isAnswerCorrect) {
      return res.status(400).json({ 
        success: false, 
        message: "Incorrect security answer" 
      });
    }

    // Hash and save the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    shop.password = hashedPassword;
    await shop.save();

    res.json({ 
      success: true, 
      message: "Password reset successfully" 
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error while resetting password" 
    });
  }
});

// Let logged-in users change their password
router.put("/change-password", protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    const shop = await Shop.findById(req.shop.id);
    
    if (!shop) {
      return res.status(404).json({ 
        success: false, 
        message: "Shop not found" 
      });
    }

    // Make sure they know their current password
    const isPasswordCorrect = await bcrypt.compare(currentPassword, shop.password);
    
    if (!isPasswordCorrect) {
      return res.status(400).json({ 
        success: false, 
        message: "Current password is incorrect" 
      });
    }

    // All good, update to the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    shop.password = hashedPassword;
    await shop.save();

    res.json({ 
      success: true, 
      message: "Password changed successfully" 
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error while changing password" 
    });
  }
});

// Delete shop account - need password to confirm
router.delete("/:id", protect, async (req, res) => {
  try {
    const shopId = req.params.id;
    const { password } = req.body;

    // Make sure they're deleting their own account only
    if (req.shop.id.toString() !== shopId) {
      return res.status(403).json({ 
        success: false, 
        message: "Not authorized to delete this shop" 
      });
    }

    // Password is required for this action
    if (!password) {
      return res.status(400).json({ 
        success: false, 
        message: "Password is required to delete account" 
      });
    }

    // Get the shop to verify password
    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({ 
        success: false, 
        message: "Shop not found" 
      });
    }

    if ((req.shop.role || "owner") === "owner") {
      const childStaffCount = await Shop.countDocuments({ parentShopId: shopId });
      if (childStaffCount > 0) {
        return res.status(400).json({
          success: false,
          message: "Remove team members before deleting the owner account",
        });
      }
    }

    // Check if password is correct
    const isPasswordCorrect = await bcrypt.compare(password, shop.password);
    if (!isPasswordCorrect) {
      return res.status(400).json({ 
        success: false, 
        message: "Incorrect password" 
      });
    }

    // Delete the shop and all related data
    await Shop.findByIdAndDelete(shopId);

    res.json({ 
      success: true, 
      message: "Shop account deleted successfully" 
    });
  } catch (error) {
    console.error("Delete shop error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error while deleting shop" 
    });
  }
});

// Owner creates manager/employee accounts under the same shop
router.post("/staff", protect, requireRoles("owner", "manager"), async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role,
      phone,
      address,
      securityQuestion,
      securityAnswer,
    } = req.body;

    const normalizedEmail = email?.toLowerCase();

    if (!["manager", "employee"].includes(role)) {
      return res.status(400).json({ message: "Invalid staff role" });
    }

    // Managers can only create employees, not managers
    const requesterRole = req.shopRole;
    if (requesterRole === "manager" && role === "manager") {
      return res.status(403).json({ message: "Managers can only create employee accounts" });
    }

    console.log("POST /staff - Creating staff with role:", role, "requesterRole:", requesterRole);


    if (await Shop.findOne({ email: normalizedEmail })) {
      return res.status(400).json({ message: "Email already exists" });
    }

    if (!securityQuestion || !securityAnswer) {
      return res.status(400).json({ message: "Security question and answer are required" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const hashedAnswer = await bcrypt.hash(securityAnswer.toLowerCase().trim(), 10);

    // For manager: use their parentShopId (owner's ID); for owner: use their own ID
    const parentId = req.shop.parentShopId || req.shop._id;

    const staff = await Shop.create({
      name,
      email: normalizedEmail,
      password: hashedPassword,
      role,
      parentShopId: parentId,
      phone,
      address,
      securityQuestion,
      securityAnswer: hashedAnswer,
    });

    await logActivity({
      req,
      action: "create",
      entityType: "staff",
      entityId: staff._id,
      summary: `Created ${role} account for ${name}`,
      metadata: { name, email: normalizedEmail, role, phone, address },
    });

    res.status(201).json({
      success: true,
      message: "Staff account created successfully",
      staff: {
        _id: staff._id,
        name: staff.name,
        email: staff.email,
        role: staff.role,
        parentShopId: staff.parentShopId,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
});

// Owner or manager can list team members
router.get("/staff", protect, requireRoles("owner", "manager"), async (req, res) => {
  try {
    // For manager: use their parentShopId (owner's ID); for owner: use their own ID
    const shopId = req.shop.parentShopId || req.shop._id;
    const requesterRole = req.shopRole;
    
    let query = { parentShopId: shopId };
    // Managers can only see employees, not other managers
    if (requesterRole === "manager") {
      query.role = "employee";
    }
    
    console.log("GET /staff - shopId:", shopId, "requesterRole:", requesterRole, "query:", query);
    const staff = await Shop.find(query).select("-password");
    console.log("Found staff:", staff.length, "items");
    res.json(staff);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
});

// Owner or manager can delete staff
router.delete("/staff/:id", protect, requireRoles("owner", "manager"), async (req, res) => {
  try {
    const shopId = req.shop.parentShopId || req.shop._id;
    const requesterRole = req.shopRole || req.shop?.role || "owner";
    
    let query = {
      _id: req.params.id,
      parentShopId: shopId,
    };
    
    // Managers can only delete employees
    if (requesterRole === "manager") {
      query.role = "employee";
    }
    
    const staff = await Shop.findOne(query);

    if (!staff) {
      return res.status(404).json({ message: "Staff account not found" });
    }

    await staff.deleteOne();

    await logActivity({
      req,
      action: "delete",
      entityType: "staff",
      entityId: staff._id,
      summary: `Removed staff account ${staff.name}`,
      metadata: { name: staff.name, email: staff.email, role: staff.role },
    });

    res.json({ success: true, message: "Staff account deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
});

export default router;
