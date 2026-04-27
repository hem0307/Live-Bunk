const express = require("express");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const requireAuth = require("../middleware/requireAuth");
const Group = require("../models/Group");
const Lecture = require("../models/Lecture");
const Status = require("../models/Status");
const User = require("../models/User");

const router = express.Router();
router.use(requireAuth);

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function todayString() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function timeToMinutes(t) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function nowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

// GET /api/groups  — my groups
router.get("/", async (req, res, next) => {
  try {
    const userId = req.session.userId;
    const groups = await Group.find({ "members.userId": userId }).lean();
    const ids = groups.map((g) => g._id);
    const lectureCounts = await Lecture.aggregate([
      { $match: { groupId: { $in: ids } } },
      { $group: { _id: "$groupId", count: { $sum: 1 } } },
    ]);
    const countMap = new Map(lectureCounts.map((c) => [String(c._id), c.count]));
    res.json(
      groups.map((g) => {
        const me = g.members.find((m) => String(m.userId) === userId);
        return {
          id: g._id,
          name: g.name,
          color: g.color,
          memberCount: g.members.length,
          lectureCount: countMap.get(String(g._id)) || 0,
          role: me ? me.role : "member",
        };
      }),
    );
  } catch (err) {
    next(err);
  }
});

// POST /api/groups  — create
router.post("/", async (req, res, next) => {
  try {
    const { name, password, displayName, phone, color } = req.body || {};
    if (!name || !password || !displayName) {
      return res
        .status(400)
        .json({ error: "Group name, password and display name are required" });
    }
    const trimmed = String(name).trim();
    const exists = await Group.findOne({ name: trimmed });
    if (exists) return res.status(409).json({ error: "A group with that name already exists" });

    const passwordHash = await bcrypt.hash(password, 10);
    const group = await Group.create({
      name: trimmed,
      passwordHash,
      ownerId: req.session.userId,
      color: color || "#22c55e",
      members: [
        {
          userId: req.session.userId,
          displayName: String(displayName).trim(),
          phone: (phone || "").trim(),
          role: "owner",
        },
      ],
    });
    res.status(201).json({ id: group._id });
  } catch (err) {
    next(err);
  }
});

// POST /api/groups/join
router.post("/join", async (req, res, next) => {
  try {
    const { name, password, displayName, phone } = req.body || {};
    if (!name || !password || !displayName) {
      return res
        .status(400)
        .json({ error: "Group name, password and display name are required" });
    }
    const group = await Group.findOne({ name: String(name).trim() });
    if (!group) return res.status(404).json({ error: "Group not found" });
    const ok = await bcrypt.compare(password, group.passwordHash);
    if (!ok) return res.status(401).json({ error: "Wrong group password" });

    const userId = req.session.userId;
    const already = group.members.find((m) => String(m.userId) === userId);
    if (already) return res.json({ id: group._id });

    group.members.push({
      userId,
      displayName: String(displayName).trim(),
      phone: (phone || "").trim(),
      role: "member",
    });
    await group.save();
    res.json({ id: group._id });
  } catch (err) {
    next(err);
  }
});

// GET /api/groups/:id  — detail with today's lectures + statuses
router.get("/:id", async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return res.status(404).json({ error: "Not found" });
    const group = await Group.findById(req.params.id).lean();
    if (!group) return res.status(404).json({ error: "Not found" });

    const userId = req.session.userId;
    const myMembership = group.members.find((m) => String(m.userId) === userId);
    if (!myMembership) return res.status(403).json({ error: "You're not a member" });

    const memberUserIds = group.members.map((m) => m.userId);
    const users = await User.find({ _id: { $in: memberUserIds } })
      .select("_id username")
      .lean();
    const userMap = new Map(users.map((u) => [String(u._id), u]));

    const lectures = await Lecture.find({ groupId: group._id }).sort({ startTime: 1 }).lean();
    const today = todayString();
    const statuses = await Status.find({
      lectureId: { $in: lectures.map((l) => l._id) },
      date: today,
    }).lean();
    const statusMap = new Map(
      statuses.map((s) => [`${s.lectureId}:${s.userId}`, s]),
    );

    const now = nowMinutes();

    const lectureView = lectures.map((l) => {
      const startMins = timeToMinutes(l.startTime);
      const defaultActive = startMins !== null && now >= startMins + 5;
      const memberStatuses = group.members.map((m) => {
        const explicit = statusMap.get(`${l._id}:${m.userId}`);
        if (explicit) {
          return {
            userId: m.userId,
            displayName: m.displayName,
            username: userMap.get(String(m.userId))?.username || "",
            status: explicit.status,
            bunkPlace: explicit.bunkPlace || "",
          };
        }
        return {
          userId: m.userId,
          displayName: m.displayName,
          username: userMap.get(String(m.userId))?.username || "",
          status: defaultActive ? "in_class" : "pending",
          bunkPlace: "",
        };
      });
      return {
        id: l._id,
        name: l.name,
        startTime: l.startTime,
        room: l.room,
        memberStatuses,
      };
    });

    res.json({
      id: group._id,
      name: group.name,
      color: group.color,
      ownerId: group.ownerId,
      myRole: myMembership.role,
      myUserId: userId,
      members: group.members.map((m) => ({
        userId: m.userId,
        displayName: m.displayName,
        phone: m.phone,
        role: m.role,
        username: userMap.get(String(m.userId))?.username || "",
      })),
      lectures: lectureView,
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/groups/:id/me  — update my display name / phone in this group
router.patch("/:id/me", async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ error: "Not found" });
    const me = group.members.find((m) => String(m.userId) === req.session.userId);
    if (!me) return res.status(403).json({ error: "You're not a member" });
    const { displayName, phone } = req.body || {};
    if (displayName !== undefined) me.displayName = String(displayName).trim();
    if (phone !== undefined) me.phone = String(phone).trim();
    await group.save();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/groups/:id/leave
router.post("/:id/leave", async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ error: "Not found" });
    if (String(group.ownerId) === req.session.userId) {
      return res
        .status(400)
        .json({ error: "Owner can't leave; delete the group instead" });
    }
    group.members = group.members.filter(
      (m) => String(m.userId) !== req.session.userId,
    );
    await group.save();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/groups/:id  — owner only
router.delete("/:id", async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ error: "Not found" });
    if (String(group.ownerId) !== req.session.userId) {
      return res.status(403).json({ error: "Only the owner can delete this group" });
    }
    const lectures = await Lecture.find({ groupId: group._id }).select("_id").lean();
    await Status.deleteMany({ lectureId: { $in: lectures.map((l) => l._id) } });
    await Lecture.deleteMany({ groupId: group._id });
    await group.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/groups/:id/members/:userId  — owner removes a member
router.delete("/:id/members/:userId", async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ error: "Not found" });
    if (String(group.ownerId) !== req.session.userId) {
      return res.status(403).json({ error: "Only the owner can remove members" });
    }
    if (req.params.userId === String(group.ownerId)) {
      return res.status(400).json({ error: "Owner can't be removed" });
    }
    group.members = group.members.filter(
      (m) => String(m.userId) !== req.params.userId,
    );
    await group.save();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ----- Lectures nested under groups -----

// POST /api/groups/:id/lectures
router.post("/:id/lectures", async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ error: "Not found" });
    if (String(group.ownerId) !== req.session.userId) {
      return res.status(403).json({ error: "Only the owner can add lectures" });
    }
    const { name, startTime, room } = req.body || {};
    if (!name || !startTime) {
      return res.status(400).json({ error: "Name and start time are required" });
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) {
      return res.status(400).json({ error: "Start time must be HH:MM (24h)" });
    }
    const lecture = await Lecture.create({
      groupId: group._id,
      name: String(name).trim(),
      startTime,
      room: (room || "").trim(),
    });
    res.status(201).json({ id: lecture._id });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/groups/:id/lectures/:lectureId
router.delete("/:id/lectures/:lectureId", async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ error: "Not found" });
    if (String(group.ownerId) !== req.session.userId) {
      return res.status(403).json({ error: "Only the owner can delete lectures" });
    }
    if (!isValidId(req.params.lectureId))
      return res.status(404).json({ error: "Not found" });
    await Status.deleteMany({ lectureId: req.params.lectureId });
    await Lecture.deleteOne({ _id: req.params.lectureId, groupId: group._id });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
