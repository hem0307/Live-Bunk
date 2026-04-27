const { Schema, model } = require("mongoose");

const userSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    displayName: { type: String, default: "" },
  },
  { timestamps: true },
);

module.exports = model("User", userSchema);
