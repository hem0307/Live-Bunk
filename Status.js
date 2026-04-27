const { Schema, model, Types } = require("mongoose");

const statusSchema = new Schema(
  {
    lectureId: { type: Types.ObjectId, ref: "Lecture", required: true, index: true },
    userId: { type: Types.ObjectId, ref: "User", required: true },
    // YYYY-MM-DD (server-local date string)
    date: { type: String, required: true },
    status: { type: String, enum: ["in_class", "bunk"], required: true },
    bunkPlace: { type: String, default: "" },
  },
  { timestamps: true },
);

statusSchema.index({ lectureId: 1, userId: 1, date: 1 }, { unique: true });

module.exports = model("Status", statusSchema);
