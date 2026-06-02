require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/attendance_system";

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Create uploads directory if not exists
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads", { recursive: true });

// MongoDB Connection
mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("✅ MongoDB Connected:", MONGODB_URI);
  })
  .catch((err) => {
    console.error("❌ MongoDB Connection Error:", err.message);
    console.log(
      "⚠️  Server running without database - some features may not work",
    );
  });

mongoose.connection.on("error", (err) => console.error("MongoDB Error:", err));
mongoose.connection.on("disconnected", () =>
  console.log("MongoDB Disconnected"),
);

// API Routes
app.use("/api/students", require("./routes/students"));
app.use("/api/attendance", require("./routes/attendance"));

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    mongodb:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
});

// Serve frontend
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res
    .status(500)
    .json({ success: false, message: err.message || "Internal Server Error" });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
});

module.exports = app;
