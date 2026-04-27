const { Schema, model, Types } = require("mongoose");

const memberSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true },
    displayName: { type: String, required: true },
    phone: { type: String, default: "" },
    role: { type: String, enum: ["owner", "member"], default: "member" },
  },
  { _id: false, timestamps: true },
);

const groupSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true },
    ownerId: { type: Types.ObjectId, ref: "User", required: true },
    color: { type: String, default: "#22c55e" },
    members: { type: [memberSchema], default: [] },
  },
  { timestamps: true },
);

groupSchema.index({ "members.userId": 1 });

module.exports = model("Group", groupSchema);
