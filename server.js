require("dotenv").config();

const path = require("path");
const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo");

const { connectDB } = require("./src/db");
const authRoutes = require("./src/routes/auth");
const groupRoutes = require("./src/routes/groups");
const lectureRoutes = require("./src/routes/lectures");
const statusRoutes = require("./src/routes/status");

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-secret-change-me";

if (!MONGODB_URI) {
  console.warn(
    "[bunk-tracker] WARNING: MONGODB_URI is not set. " +
      "Add it to your .env before running.",
  );
}

const app = express();

app.use(express.json({ limit: "200kb" }));
app.use(
  session({
    name: "bunk.sid",
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
      sameSite: "lax",
    },
    store: MongoStore.create({
      mongoUrl: MONGODB_URI,
      collectionName: "sessions",
      ttl: 60 * 60 * 24 * 30,
    }),
  }),
);

// Static frontend
app.use(express.static(path.join(__dirname, "public")));

// API
app.use("/api/auth", authRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/lectures", lectureRoutes);
app.use("/api/status", statusRoutes);

// Generic error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res
    .status(err.status || 500)
    .json({ error: err.publicMessage || "Something went wrong" });
});

(async () => {
  if (MONGODB_URI) {
    await connectDB(MONGODB_URI);
    console.log("[bunk-tracker] MongoDB connected");
  }
  app.listen(PORT, () => {
    console.log(`[bunk-tracker] listening on http://localhost:${PORT}`);
  });
})();
