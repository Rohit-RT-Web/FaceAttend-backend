require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || "";

// ================= MIDDLEWARE & CORS CONFIGURATION =================
// Netlify se aane waale requests ko allow karne ke liye CORS setup kiya hai
app.use(
  cors({
    origin: [
      "https://your-netlify-site-name.netlify.app", // 👈 YAHAN APNE ASLI NETLIFY SITE KA URL PRECISELY PASTE KAREIN (bina aakhiri '/' ke)
      "http://localhost:5173", // Vite (React) local development ke liye
      "http://localhost:3000", // Normal local development ke liye
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Static files and uploads setup
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Create uploads directory if it does not exist
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads", { recursive: true });
}

// ================= MONGOOSE DATABASE CONNECTION =================
mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("✅ MongoDB Connected Successfully");
  })
  .catch((err) => {
    console.error("❌ MongoDB Connection Error:", err.message);
    console.log(
      "⚠️ Server running without database - some features may not work",
    );
  });

mongoose.connection.on("error", (err) => console.error("MongoDB Error:", err));
mongoose.connection.on("disconnected", () =>
  console.log("MongoDB Disconnected"),
);

// ================= API ROUTES =================
app.use("/api/students", require("./routes/students"));
app.use("/api/attendance", require("./routes/attendance"));

// ================= HEALTH CHECK ROUTE =================
// Frontend (.js file) isi route ko hit karke database check karta hai
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    mongodb:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
});

// ================= ROOT & FALLBACK ROUTES =================
// Jab Frontend Netlify par alag chal raha ho, to backend ke main URL par yeh message dikhega
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Face Attendance System API is running smoothly!",
  });
});

// Galat API paths ke liye 404 handler
app.get("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Requested API route not found on this server.",
  });
});

// ================= GLOBAL ERROR HANDLER =================
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

// ================= SERVER START =================
app.listen(PORT, () => {
  console.log(`🚀 Server running successfully on port: ${PORT}`);
});

module.exports = app;
