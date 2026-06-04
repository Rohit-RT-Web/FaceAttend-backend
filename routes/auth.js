const express = require("express");
const router = express.Router();
const Admin = require("../models/Admin");

// ── Admin seed — pehli baar default admin banao ──────────────
async function seedAdmin() {
  try {
    const exists = await Admin.findOne({});
    if (!exists) {
      await Admin.create({
        email: "admin@faceattend.com",
        password: "admin@123",
      });
      console.log("✅ Default admin created");
    }
  } catch (err) {
    console.error("Seed error:", err.message);
  }
}
seedAdmin();

// ── POST /api/auth/login ──────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res
        .status(400)
        .json({
          success: false,
          message: "Email aur password dono zaroori hain",
        });

    const admin = await Admin.findOne({ email: email.toLowerCase() });
    if (!admin)
      return res
        .status(401)
        .json({ success: false, message: "Email ya password galat hai" });

    const isMatch = await admin.comparePassword(password);
    if (!isMatch)
      return res
        .status(401)
        .json({ success: false, message: "Email ya password galat hai" });

    res.json({ success: true, email: admin.email });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── POST /api/auth/verify-email ───────────────────────────────
router.post("/verify-email", async (req, res) => {
  try {
    const { email } = req.body;
    const admin = await Admin.findOne({ email: email.toLowerCase() });
    if (!admin)
      return res
        .status(404)
        .json({ success: false, message: "Yeh email registered nahi hai" });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── POST /api/auth/reset-password ────────────────────────────
router.post("/reset-password", async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword)
      return res
        .status(400)
        .json({
          success: false,
          message: "Email aur naya password zaroori hai",
        });

    const admin = await Admin.findOne({ email: email.toLowerCase() });
    if (!admin)
      return res
        .status(404)
        .json({ success: false, message: "Admin nahi mila" });

    admin.password = newPassword;
    await admin.save();

    res.json({
      success: true,
      message: "Password successfully update ho gaya",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
