// ---------- tiny helpers ----------
async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    let msg = "Request failed";
    try {
      const j = await res.json();
      msg = j.error || msg;
    } catch {}
    throw new Error(msg);
  }
  return res.json().catch(() => ({}));
}

function showError(message) {
  alert(message);
}

// ---------- view switching ----------
function show(id) {
  for (const el of document.querySelectorAll("#landing, #auth")) {
    el.classList.toggle("hidden", el.id !== id);
  }
}

function goAuth(tab) {
  show("auth");
  switchTab(tab);
}

function switchTab(tab) {
  document.getElementById("tab-login").classList.toggle("active", tab === "login");
  document.getElementById("tab-signup").classList.toggle("active", tab === "signup");
  document.getElementById("form-login").classList.toggle("hidden", tab !== "login");
  document.getElementById("form-signup").classList.toggle("hidden", tab !== "signup");
}

// ---------- form handlers ----------
document.getElementById("form-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api("/api/auth/login", {
      method: "POST",
      body: {
        username: document.getElementById("login-username").value,
        password: document.getElementById("login-password").value,
      },
    });
    location.href = "/app.html";
  } catch (err) {
    showError(err.message);
  }
});

document.getElementById("form-signup").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api("/api/auth/signup", {
      method: "POST",
      body: {
        username: document.getElementById("signup-username").value,
        displayName: document.getElementById("signup-displayname").value,
        password: document.getElementById("signup-password").value,
      },
    });
    location.href = "/app.html";
  } catch (err) {
    showError(err.message);
  }
});

// ---------- bounce signed-in users to the app ----------
(async () => {
  try {
    await api("/api/auth/me");
    location.href = "/app.html";
  } catch {
    /* not signed in — stay on landing */
  }
})();
