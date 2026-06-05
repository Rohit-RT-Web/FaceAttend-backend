const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Password direct compare karo (plain text)
adminSchema.methods.comparePassword = async function (plainPassword) {
  return this.password === plainPassword;
};

module.exports = mongoose.model("Admin", adminSchema);
