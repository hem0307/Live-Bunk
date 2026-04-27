// =========================================================================
// Bunk Tracker — front-end SPA (vanilla JS, hash-routed)
// =========================================================================

const COLORS = [
  "#22c55e","#3b82f6","#a855f7","#f59e0b",
  "#ef4444","#06b6d4","#ec4899","#0ea5e9",
];

// ---------- API ----------
async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 401) {
    location.href = "/index.html";
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    let msg = "Request failed";
    try { msg = (await res.json()).error || msg; } catch {}
    throw new Error(msg);
  }
  return res.json().catch(() => ({}));
}

// ---------- DOM helpers ----------
function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;",
  }[c]));
}
function initials(name) {
  return String(name || "?").trim().split(/\s+/).map(w => w[0]).filter(Boolean)
    .slice(0,2).join("").toUpperCase();
}

// ---------- Toast ----------
function toast(msg, type) {
  const root = document.getElementById("toast-root");
  const t = el(`<div class="toast ${type === "error" ? "error" : ""}">${escapeHtml(msg)}</div>`);
  root.appendChild(t);
  setTimeout(() => t.remove(), 2400);
}

// ---------- Modal ----------
function openModal(html, onMount) {
  const root = document.getElementById("modal-root");
  const bg = el(`<div class="modal-bg"><div class="modal"></div></div>`);
  bg.querySelector(".modal").appendChild(el(html));
  bg.addEventListener("click", (e) => { if (e.target === bg) closeModal(); });
  root.innerHTML = "";
  root.appendChild(bg);
  document.addEventListener("keydown", escListener);
  if (onMount) onMount(bg);
}
function closeModal() {
  document.getElementById("modal-root").innerHTML = "";
  document.removeEventListener("keydown", escListener);
}
function escListener(e) { if (e.key === "Escape") closeModal(); }

// =========================================================================
// Boot
// =========================================================================
let CURRENT_USER = null;

(async function boot() {
  try {
    CURRENT_USER = await api("/api/auth/me");
  } catch {
    location.href = "/index.html";
    return;
  }
  document.getElementById("user-display").textContent = CURRENT_USER.displayName || CURRENT_USER.username;
  document.getElementById("user-avatar").textContent = initials(CURRENT_USER.displayName || CURRENT_USER.username);
  document.getElementById("btn-logout").addEventListener("click", async () => {
    await api("/api/auth/logout", { method: "POST" });
    location.href = "/index.html";
  });
  window.addEventListener("hashchange", route);
  if (!location.hash) location.hash = "#/groups";
  route();
})();

// =========================================================================
// Router
// =========================================================================
function route() {
  const hash = location.hash || "#/groups";
  const m = hash.match(/^#\/groups\/([^\/]+)$/);
  if (m) return renderGroupDetail(m[1]);
  return renderGroupsHome();
}

// =========================================================================
// Page: Groups Home
// =========================================================================
async function renderGroupsHome() {
  const view = document.getElementById("view");
  view.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Your Groups</h1>
        <p class="muted">Hop into a group to see who's where.</p>
      </div>
      <button class="btn btn-primary" id="btn-new-group">+ New / Join Group</button>
    </div>
    <div id="groups-grid"><p class="muted">Loading…</p></div>
  `;
  document.getElementById("btn-new-group").addEventListener("click", openNewOrJoinModal);

  let groups;
  try {
    groups = await api("/api/groups");
  } catch (e) {
    document.getElementById("groups-grid").innerHTML =
      `<div class="empty"><p>Couldn't load groups. ${escapeHtml(e.message)}</p></div>`;
    return;
  }
  const grid = document.getElementById("groups-grid");
  if (!groups.length) {
    grid.innerHTML = `
      <div class="empty">
        <div class="avatar" style="margin:0 auto 10px;background:var(--green-soft);color:var(--green-dark);width:48px;height:48px;font-size:20px;">+</div>
        <h3>No groups yet</h3>
        <p class="muted">Create one and share its name + password with your friends, or join an existing group.</p>
        <button class="btn btn-primary" style="margin-top:12px;" onclick="openNewOrJoinModal()">+ Create or join a group</button>
      </div>`;
    return;
  }
  grid.className = "groups-grid";
  grid.innerHTML = "";
  for (const g of groups) {
    const card = el(`
      <div class="card group-card" data-id="${g.id}">
        <div style="display:flex;justify-content:space-between;align-items:start;">
          <span class="icon" style="background:${escapeHtml(g.color)};">G</span>
          ${g.role === "owner" ? `<span class="crown">★ Admin</span>` : ""}
        </div>
        <h3>${escapeHtml(g.name)}</h3>
        <p class="muted">
          ${g.memberCount} ${g.memberCount === 1 ? "member" : "members"} ·
          ${g.lectureCount} ${g.lectureCount === 1 ? "lecture" : "lectures"}
        </p>
      </div>
    `);
    card.addEventListener("click", () => { location.hash = `#/groups/${g.id}`; });
    grid.appendChild(card);
  }
}

function openNewOrJoinModal() {
  openModal(`
    <h3>Join your friends</h3>
    <p class="sub">Create a brand new group or hop into one with the name + password your admin shared.</p>
    <div class="tab-toggle">
      <button id="tab-create" class="active">Create</button>
      <button id="tab-join">Join</button>
    </div>
    <div id="modal-body"></div>
  `, (bg) => {
    const body = bg.querySelector("#modal-body");
    const tabCreate = bg.querySelector("#tab-create");
    const tabJoin = bg.querySelector("#tab-join");
    function render(which) {
      tabCreate.classList.toggle("active", which === "create");
      tabJoin.classList.toggle("active", which === "join");
      body.innerHTML = "";
      body.appendChild(which === "create" ? createGroupForm() : joinGroupForm());
    }
    tabCreate.addEventListener("click", () => render("create"));
    tabJoin.addEventListener("click", () => render("join"));
    render("create");
  });
}

function createGroupForm() {
  const form = el(`
    <form>
      <div class="field"><label>Group name</label><input name="name" required placeholder="CSE-A 2026"/></div>
      <div class="field"><label>Password (share with friends)</label><input name="password" required placeholder="something easy"/></div>
      <div class="row-2">
        <div class="field"><label>Your name</label><input name="displayName" required placeholder="Aman"/></div>
        <div class="field"><label>Phone (optional)</label><input name="phone" placeholder="98xxxxxx"/></div>
      </div>
      <div class="field">
        <label>Color</label>
        <div class="color-picker"></div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Create group</button>
      </div>
    </form>
  `);
  let color = COLORS[0];
  const picker = form.querySelector(".color-picker");
  COLORS.forEach((c, i) => {
    const b = el(`<button type="button" style="background:${c};" class="${i === 0 ? "active" : ""}"></button>`);
    b.addEventListener("click", () => {
      color = c;
      picker.querySelectorAll("button").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
    });
    picker.appendChild(b);
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    try {
      await api("/api/groups", {
        method: "POST",
        body: {
          name: fd.get("name"),
          password: fd.get("password"),
          displayName: fd.get("displayName"),
          phone: fd.get("phone") || "",
          color,
        },
      });
      closeModal();
      toast("Group created");
      renderGroupsHome();
    } catch (err) {
      toast(err.message, "error");
    }
  });
  return form;
}

function joinGroupForm() {
  const form = el(`
    <form>
      <div class="field"><label>Group name</label><input name="name" required placeholder="CSE-A 2026"/></div>
      <div class="field"><label>Password</label><input name="password" required/></div>
      <div class="row-2">
        <div class="field"><label>Your name</label><input name="displayName" required placeholder="Aman"/></div>
        <div class="field"><label>Phone (optional)</label><input name="phone" placeholder="98xxxxxx"/></div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Join group</button>
      </div>
    </form>
  `);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    try {
      await api("/api/groups/join", {
        method: "POST",
        body: {
          name: fd.get("name"),
          password: fd.get("password"),
          displayName: fd.get("displayName"),
          phone: fd.get("phone") || "",
        },
      });
      closeModal();
      toast("Joined!");
      renderGroupsHome();
    } catch (err) {
      toast(err.message, "error");
    }
  });
  return form;
}

// =========================================================================
// Page: Group Detail
// =========================================================================
let CURRENT_GROUP_ID = null;
let CURRENT_TAB = "today";

async function renderGroupDetail(id) {
  CURRENT_GROUP_ID = id;
  const view = document.getElementById("view");
  view.innerHTML = `<p class="muted">Loading…</p>`;

  let group;
  try {
    group = await api(`/api/groups/${encodeURIComponent(id)}`);
  } catch (e) {
    view.innerHTML = `
      <div class="card" style="text-align:center;padding:32px;">
        <p>Couldn't open this group.</p>
        <button class="btn" onclick="location.hash='#/groups'">Back to your groups</button>
      </div>`;
    return;
  }

  view.innerHTML = `
    <div style="margin-bottom:14px;">
      <a href="#/groups" class="btn btn-sm btn-ghost">← Groups</a>
    </div>
    <div class="group-header" style="background:${escapeHtml(group.color)};">
      <div class="row">
        <div>
          <div style="opacity:.85;font-size:13px;">Group</div>
          <h2>${escapeHtml(group.name)}</h2>
          <div style="opacity:.85;font-size:13px;margin-top:4px;">
            ${group.members.length} members · ${group.lectures.length} lectures
          </div>
        </div>
        ${group.myRole === "owner" ? `<span class="you-admin">★ You're the admin</span>` : ""}
      </div>
    </div>
    <div class="tabs">
      <button data-tab="today" class="${CURRENT_TAB==="today"?"active":""}">Today's Lectures</button>
      <button data-tab="members" class="${CURRENT_TAB==="members"?"active":""}">Members (${group.members.length})</button>
      <button data-tab="settings" class="${CURRENT_TAB==="settings"?"active":""}">Settings</button>
    </div>
    <div id="tab-content"></div>
  `;
  view.querySelectorAll(".tabs button").forEach(b => {
    b.addEventListener("click", () => {
      CURRENT_TAB = b.dataset.tab;
      renderGroupDetail(id);
    });
  });
  if (CURRENT_TAB === "today") renderTodayTab(group);
  else if (CURRENT_TAB === "members") renderMembersTab(group);
  else renderSettingsTab(group);
}

// ---- Today tab ----
function renderTodayTab(group) {
  const root = document.getElementById("tab-content");
  const dateStr = new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  root.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin:6px 0 12px;">
      <h2 style="margin:0;font-size:18px;">Today · ${escapeHtml(dateStr)}</h2>
      ${group.myRole === "owner" ? `<button class="btn btn-primary btn-sm" id="btn-add-lecture">+ Add lecture</button>` : ""}
    </div>
    <div id="lectures-list"></div>
  `;
  const addBtn = document.getElementById("btn-add-lecture");
  if (addBtn) addBtn.addEventListener("click", () => openAddLectureModal(group.id));

  const list = document.getElementById("lectures-list");
  if (!group.lectures.length) {
    list.innerHTML = `
      <div class="empty">
        <p>No lectures yet.${group.myRole === "owner" ? " Tap “Add lecture”." : " Wait for the admin to add lectures."}</p>
      </div>`;
    return;
  }
  for (const lec of group.lectures) {
    list.appendChild(renderLectureCard(group, lec));
  }
}

function renderLectureCard(group, lec) {
  const inClass = lec.memberStatuses.filter(m => m.status === "in_class").length;
  const bunked = lec.memberStatuses.filter(m => m.status === "bunk").length;
  const me = lec.memberStatuses.find(m => String(m.userId) === String(group.myUserId));

  const myStatusLabel = (() => {
    if (me?.status === "in_class") return "You marked: in class";
    if (me?.status === "bunk") return "You bunked" + (me.bunkPlace ? ` — ${me.bunkPlace}` : "");
    const startMins = parseTime(lec.startTime);
    const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
    if (startMins == null) return "Pending";
    const diff = startMins + 5 - nowMins;
    if (diff > 0) return `Auto-marks in-class in ${diff} min`;
    return "Counted as in-class (default after start)";
  })();

  const card = el(`
    <div class="card lecture-card">
      <div class="head">
        <div>
          <h3 style="margin:0;">${escapeHtml(lec.name)}</h3>
          <div class="meta">
            <span>⏰ ${escapeHtml(formatTime(lec.startTime))}</span>
            ${lec.room ? `<span>📍 ${escapeHtml(lec.room)}</span>` : ""}
            <span class="ok">✔ ${inClass} in class</span>
            <span class="bunk">✖ ${bunked} bunked</span>
          </div>
        </div>
        ${group.myRole === "owner" ? `<button class="btn btn-sm btn-ghost" data-del="${lec.id}" title="Remove">🗑</button>` : ""}
      </div>

      <div class="status-row">
        <div>
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--slate-500);">Your status</div>
          <div style="font-weight:600;color:var(--slate-700);font-size:14px;margin-top:2px;">${escapeHtml(myStatusLabel)}</div>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn ${me?.status==="in_class"?"btn-primary":"btn-soft-green"}" data-action="in_class">✔ In class</button>
          <button class="btn ${me?.status==="bunk"?"btn-danger":"btn-soft-red"}" data-action="bunk">✖ Bunk</button>
        </div>
      </div>

      <div class="pills" id="pills-${lec.id}"></div>
    </div>
  `);

  // Member pills
  const pillsRoot = card.querySelector(`#pills-${lec.id}`);
  for (const m of lec.memberStatuses) {
    const pill = el(`
      <span class="pill ${m.status}">
        <span class="avatar" style="width:22px;height:22px;font-size:10px;">${initials(m.displayName)}</span>
        ${escapeHtml(m.displayName)}
        <span class="dot-status"></span>
        ${m.status === "bunk" && m.bunkPlace ? `<span class="place">@ ${escapeHtml(m.bunkPlace)}</span>` : ""}
      </span>
    `);
    pillsRoot.appendChild(pill);
  }

  card.querySelector(`[data-action="in_class"]`).addEventListener("click", async () => {
    try {
      await api(`/api/status/${lec.id}`, { method: "POST", body: { status: "in_class" } });
      renderGroupDetail(group.id);
    } catch (e) { toast(e.message, "error"); }
  });
  card.querySelector(`[data-action="bunk"]`).addEventListener("click", () => openBunkModal(group.id, lec.id, me?.bunkPlace || ""));

  const delBtn = card.querySelector(`[data-del]`);
  if (delBtn) {
    delBtn.addEventListener("click", async () => {
      if (!confirm(`Remove "${lec.name}"?`)) return;
      try {
        await api(`/api/groups/${group.id}/lectures/${lec.id}`, { method: "DELETE" });
        toast("Lecture removed");
        renderGroupDetail(group.id);
      } catch (e) { toast(e.message, "error"); }
    });
  }
  return card;
}

function openBunkModal(groupId, lectureId, currentPlace) {
  openModal(`
    <h3>Where you at?</h3>
    <p class="sub">Drop a hint so your friends know where to find you.</p>
    <div class="field"><input id="bunk-place" placeholder="Canteen, library, home…" value="${escapeHtml(currentPlace)}"/></div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger" id="bunk-confirm">I bunked</button>
    </div>
  `, (bg) => {
    const input = bg.querySelector("#bunk-place");
    input.focus();
    bg.querySelector("#bunk-confirm").addEventListener("click", async () => {
      try {
        await api(`/api/status/${lectureId}`, {
          method: "POST",
          body: { status: "bunk", bunkPlace: input.value.trim() },
        });
        closeModal();
        renderGroupDetail(groupId);
      } catch (e) { toast(e.message, "error"); }
    });
  });
}

function openAddLectureModal(groupId) {
  openModal(`
    <h3>New lecture</h3>
    <p class="sub">Friends will mark themselves in-class or bunked.</p>
    <form id="add-lec-form">
      <div class="field"><label>Subject / lecture name</label><input name="name" required placeholder="DBMS"/></div>
      <div class="row-2">
        <div class="field"><label>Start time</label><input name="startTime" type="time" required value="09:00"/></div>
        <div class="field"><label>Room (optional)</label><input name="room" placeholder="A-203"/></div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Add lecture</button>
      </div>
    </form>
  `, (bg) => {
    bg.querySelector("#add-lec-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await api(`/api/groups/${groupId}/lectures`, {
          method: "POST",
          body: {
            name: fd.get("name"),
            startTime: fd.get("startTime"),
            room: fd.get("room") || "",
          },
        });
        closeModal();
        toast("Lecture added");
        renderGroupDetail(groupId);
      } catch (err) { toast(err.message, "error"); }
    });
  });
}

// ---- Members tab ----
function renderMembersTab(group) {
  const root = document.getElementById("tab-content");
  root.innerHTML = "";
  for (const m of group.members) {
    const isMe = String(m.userId) === String(group.myUserId);
    const isOwner = String(m.userId) === String(group.ownerId);
    const row = el(`
      <div class="member-row">
        <div class="who">
          <span class="avatar">${initials(m.displayName)}</span>
          <div>
            <div style="font-weight:600;">${escapeHtml(m.displayName)}${isMe ? ' <span class="muted" style="font-weight:400;font-size:12px;">(you)</span>' : ""}</div>
            <div class="muted" style="font-size:13px;">
              ${isOwner ? '<span style="color:var(--amber-700);">★ Admin</span>' : "Member"}
              ${m.phone ? ` · ${escapeHtml(m.phone)}` : ""}
              ${m.username ? ` · @${escapeHtml(m.username)}` : ""}
            </div>
          </div>
        </div>
        ${group.myRole === "owner" && !isOwner ? `<button class="btn btn-sm" data-remove="${m.userId}" style="color:var(--red-dark);">Remove</button>` : ""}
      </div>
    `);
    const rm = row.querySelector("[data-remove]");
    if (rm) {
      rm.addEventListener("click", async () => {
        if (!confirm(`Remove ${m.displayName}?`)) return;
        try {
          await api(`/api/groups/${group.id}/members/${m.userId}`, { method: "DELETE" });
          toast("Member removed");
          renderGroupDetail(group.id);
        } catch (e) { toast(e.message, "error"); }
      });
    }
    root.appendChild(row);
  }
}

// ---- Settings tab ----
function renderSettingsTab(group) {
  const root = document.getElementById("tab-content");
  const me = group.members.find(m => String(m.userId) === String(group.myUserId));
  root.innerHTML = `
    <div class="card">
      <h3 style="margin-top:0;">Your profile in this group</h3>
      <form id="profile-form">
        <div class="row-2">
          <div class="field"><label>Display name</label><input name="displayName" value="${escapeHtml(me?.displayName || "")}"/></div>
          <div class="field"><label>Phone (optional)</label><input name="phone" value="${escapeHtml(me?.phone || "")}" placeholder="98xxxxxx"/></div>
        </div>
        <button class="btn btn-primary" type="submit">Save</button>
      </form>
    </div>
    <div class="spacer"></div>
    ${group.myRole === "owner"
      ? `<div class="card" style="border-color:#fecaca;">
           <h3 style="margin-top:0;color:var(--red-dark);">Danger zone</h3>
           <p class="muted">Deleting the group removes all lectures, members and history. This can't be undone.</p>
           <button class="btn btn-danger" id="btn-delete">Delete this group</button>
         </div>`
      : `<div class="card">
           <h3 style="margin-top:0;">Leave group</h3>
           <p class="muted">You can rejoin later with the group name and password.</p>
           <button class="btn" id="btn-leave" style="color:var(--red-dark);">Leave group</button>
         </div>`
    }
  `;
  document.getElementById("profile-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api(`/api/groups/${group.id}/me`, {
        method: "PATCH",
        body: { displayName: fd.get("displayName"), phone: fd.get("phone") },
      });
      toast("Saved");
    } catch (err) { toast(err.message, "error"); }
  });
  const del = document.getElementById("btn-delete");
  if (del) del.addEventListener("click", async () => {
    if (!confirm(`Delete "${group.name}"? This can't be undone.`)) return;
    try {
      await api(`/api/groups/${group.id}`, { method: "DELETE" });
      toast("Group deleted");
      location.hash = "#/groups";
    } catch (e) { toast(e.message, "error"); }
  });
  const leave = document.getElementById("btn-leave");
  if (leave) leave.addEventListener("click", async () => {
    if (!confirm("Leave this group?")) return;
    try {
      await api(`/api/groups/${group.id}/leave`, { method: "POST" });
      location.hash = "#/groups";
    } catch (e) { toast(e.message, "error"); }
  });
}

// ---- utils ----
function parseTime(t) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t || "");
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}
function formatTime(t) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t || "");
  if (!m) return t;
  const h = parseInt(m[1], 10);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m[2]} ${period}`;
}
