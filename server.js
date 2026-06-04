require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || "";

// ── CORS — Netlify frontend allow karo ──────────────────────
app.use(
  cors({
    origin: [
      "https://face-attendancee.netlify.app",
      "http://localhost:3000",
      "http://localhost:5500",
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ── Static files ─────────────────────────────────────────────
app.use(
  express.static(path.join(__dirname, "public"), {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".js"))
        res.setHeader("Content-Type", "application/javascript");
      if (filePath.endsWith(".css")) res.setHeader("Content-Type", "text/css");
    },
  }),
);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

if (!fs.existsSync("uploads")) fs.mkdirSync("uploads", { recursive: true });

// ── MongoDB ───────────────────────────────────────────────────
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Error:", err.message));

mongoose.connection.on("error", (err) => console.error("MongoDB Error:", err));
mongoose.connection.on("disconnected", () =>
  console.log("MongoDB Disconnected"),
);

// ── API Routes ────────────────────────────────────────────────
app.use("/api/students", require("./routes/students"));
app.use("/api/attendance", require("./routes/attendance"));

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    mongodb:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
});

// ── Catch-all — sirf HTML routes ke liye, JS/CSS nahi ────────
app.get("*", (req, res) => {
  const ext = path.extname(req.path);
  if (ext && ext !== ".html") {
    return res.status(404).json({ error: "Not found" });
  }
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ── Error Handler ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res
    .status(500)
    .json({ success: false, message: err.message || "Internal Server Error" });
});

app.listen(PORT, () => {
  console.log(`🚀 Server: http://localhost:${PORT}`);
});

module.exports = app;
