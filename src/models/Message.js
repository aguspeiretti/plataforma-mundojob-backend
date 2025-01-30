const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["room", "direct", "system"],
    default: "room",
  },
  room: String,
  username: String,
  text: String,
  from: String,
  to: String,
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Message", messageSchema);
