const { Schema, model, Types } = require("mongoose");

const lectureSchema = new Schema(
  {
    groupId: { type: Types.ObjectId, ref: "Group", required: true, index: true },
    name: { type: String, required: true },
    // "HH:MM" 24h
    startTime: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):[0-5]\d$/,
    },
    room: { type: String, default: "" },
  },
  { timestamps: true },
);

module.exports = model("Lecture", lectureSchema);
