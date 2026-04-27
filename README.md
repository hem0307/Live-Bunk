# Bunk Tracker (standalone)

Plain HTML / CSS / JavaScript front-end with a Node.js + Express + MongoDB
back-end. No frameworks, no build step.

## Setup

1. Install dependencies
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and fill in:
   - `MONGODB_URI` — your MongoDB Atlas connection string
   - `SESSION_SECRET` — any long random string
3. Start the server
   ```bash
   npm start
   ```
4. Open http://localhost:3000

## How it works

- Sign up with username + password.
- Create a group (you become the admin) or join one with name + password.
- Admin adds lectures (name + start time, optional room).
- Members tap **In class** (green) or **Bunk** (red, with a place note).
- 5 minutes after a lecture starts, anyone who hasn't bunked is auto-counted as in-class.

## File layout

```
standalone/
├── package.json
├── .env.example
├── server.js                      # Express entry point
├── src/
│   ├── db.js                      # mongoose connection
│   ├── middleware/requireAuth.js
│   ├── models/                    # User, Group, Lecture, Status
│   └── routes/                    # auth, groups, lectures, status
└── public/
    ├── index.html                 # landing + login + signup
    ├── app.html                   # the authenticated app
    ├── css/styles.css
    └── js/
        ├── auth.js                # login + signup
        └── app.js                 # groups + group detail SPA
```
