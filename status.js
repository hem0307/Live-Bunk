const express = require("express");
const mongoose = require("mongoose");
const requireAuth = require("../middleware/requireAuth");
const Lecture = require("../models/Lecture");
const Group = require("../models/Group");
const Status = require("../models/Status");

const router = express.Router();
router.use(requireAuth);

function todayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

// POST /api/status/:lectureId   { status: "in_class" | "bunk", bunkPlace? }
router.post("/:lectureId", async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.lectureId)) {
      return res.status(404).json({ error: "Lecture not found" });
    }
    const lecture = await Lecture.findById(req.params.lectureId);
    if (!lecture) return res.status(404).json({ error: "Lecture not found" });
    const group = await Group.findById(lecture.groupId).lean();
    if (!group) return res.status(404).json({ error: "Group not found" });
    const isMember = group.members.some(
      (m) => String(m.userId) === req.session.userId,
    );
    if (!isMember) return res.status(403).json({ error: "You're not in this group" });

    const { status, bunkPlace } = req.body || {};
    if (!["in_class", "bunk"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const date = todayString();
    await Status.findOneAndUpdate(
      { lectureId: lecture._id, userId: req.session.userId, date },
      {
        $set: {
          status,
          bunkPlace: status === "bunk" ? (bunkPlace || "").trim() : "",
        },
      },
      { upsert: true, new: true },
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
