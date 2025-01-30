// User.js - Model
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, required: true, default: "user" },
});

// Middleware para hashear la contraseña antes de guardar
userSchema.pre("save", async function (next) {
  try {
    console.log("Pre-save hook triggered");
    if (!this.isModified("password")) {
      console.log("Password not modified, skipping hash");
      return next();
    }

    console.log("Hashing password...");
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    console.log("Password hashed successfully");
    next();
  } catch (error) {
    console.error("Error in pre-save hook:", error);
    next(error);
  }
});

const User = mongoose.model("User", userSchema);

module.exports = User;
