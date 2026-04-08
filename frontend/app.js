const S = {
  token: localStorage.getItem("skillcert-token") || "",
  user: JSON.parse(localStorage.getItem("skillcert-user") || "null"),
  users: [],
  certifications: [],
  requests: [],
  alerts: [],
  summary: null,
  userPagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 },
  certPagination: { page: 1, pageSize: 12, total: 0, totalPages: 1 }
};
const page = document.body.dataset.page;
const adminPages = new Set(["admin-overview", "admin-users", "admin-certifications", "admin-requests", "admin-profile"]);
const studentPages = new Set(["student-overview", "student-certifications", "student-requests", "student-profile"]);

const $ = (id) => document.getElementById(id);
const safe = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const cls = (v) => String(v || "").toLowerCase().replace(/\s+/g, "-");
const routeForRole = (role) => role === "admin" ? "/admin/overview" : "/student/overview";
const categoryRules = [
  { name: "Cloud", test: /aws|azure|google cloud|oracle cloud|cloud/i },
  { name: "AI", test: /ai|machine learning|ml|data science|openai/i },
  { name: "Web", test: /javascript|react|node|web|frontend|backend|full stack/i },
  { name: "Security", test: /security|ceh|fortinet|cyber|iso 27001|palo alto/i },
  { name: "Networking", test: /ccna|network|juniper|aruba|cisco/i },
  { name: "Data", test: /power bi|tableau|analytics|data/i }
];

function setMessage(id, text, error = false) {
  const el = $(id);
  if (!el) return;
  el.textContent = text;
  el.style.color = error ? "#b33a4c" : "#0d8a69";
}

function saveSession(token, user) {
  S.token = token;
  S.user = user;
  localStorage.setItem("skillcert-token", token);
  localStorage.setItem("skillcert-user", JSON.stringify(user));
}

function clearSession() {
  S.token = "";
  S.user = null;
  localStorage.removeItem("skillcert-token");
  localStorage.removeItem("skillcert-user");
}

async function api(url, options = {}) {
  const headers = new Headers(options.headers || {});
  if (!(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (S.token) headers.set("Authorization", `Bearer ${S.token}`);
  const res = await fetch(url, { ...options, headers });
  const type = res.headers.get("content-type") || "";
  const data = type.includes("application/json") ? await res.json() : { message: await res.text() };
  if (!res.ok) throw new Error(data.message || data.details || "Request failed.");
  return data;
}

function setShell() {
  if ($("session-badge") && S.user) $("session-badge").textContent = S.user.role.toUpperCase();
  if ($("sidebar-user") && S.user) $("sidebar-user").textContent = `${S.user.name} | ${S.user.email}`;
  if ($("dashboard-subtitle") && S.user) $("dashboard-subtitle").textContent = `Welcome ${S.user.name}. Department: ${S.user.department || "General"}`;
}

function renderSummary() {
  const wrap = $("summary-grid");
  if (!wrap || !S.summary) return;
  wrap.innerHTML = [["Total", S.summary.total], ["Active", S.summary.active], ["Expiring Soon", S.summary.expiringSoon], ["Expired", S.summary.expired], ["Renewals", S.summary.renewalsInProgress]].map(([k, v]) => `<article class="mini-stat"><span>${k}</span><strong>${v}</strong></article>`).join("");
}

function preview(item) {
  if (item.certificateFile && /\.(png|jpg|jpeg|webp|gif)$/i.test(item.certificateFile)) return `<div class="certificate-preview"><img src="${item.certificateFile}" alt="${safe(item.title)}"></div>`;
  if (item.certificateFile) return `<div class="certificate-preview"><span>Certificate File Available</span></div>`;
  return `<div class="certificate-preview"><span>${safe(item.provider)}</span></div>`;
}

function avatar(user, size = "") {
  if (user?.profilePhoto) {
    return `<div class="profile-avatar ${size}"><img src="${user.profilePhoto}" alt="${safe(user.name)}"></div>`;
  }
  const initials = String(user?.name || "U").split(/\s+/).slice(0, 2).map((p) => p[0] || "").join("").toUpperCase();
  return `<div class="profile-avatar ${size}">${safe(initials || "U")}</div>`;
}

function categorizeCert(item) {
  const text = `${item.title} ${item.provider}`;
  const match = categoryRules.find((rule) => rule.test.test(text));
  return match ? match.name : "General";
}

function summarizeCategories(certs) {
  return certs.reduce((acc, item) => {
    const key = categorizeCert(item);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function topEntries(mapObject, limit = 6) {
  return Object.entries(mapObject).sort((a, b) => b[1] - a[1]).slice(0, limit);
}

function renderCertifications(limit = 0) {
  const wrap = $("certification-list");
  if (!wrap) return;
  const items = limit ? S.certifications.slice(0, limit) : S.certifications;
  if ($("cert-page-info")) {
    const p = S.certPagination;
    $("cert-page-info").textContent = `Page ${p.page} of ${p.totalPages} (${p.total} records)`;
    $("cert-prev-btn")?.toggleAttribute("disabled", p.page <= 1);
    $("cert-next-btn")?.toggleAttribute("disabled", p.page >= p.totalPages);
  }
  if (!items.length) {
    wrap.innerHTML = '<p class="empty">No certifications available right now.</p>';
    return;
  }
  const isAdmin = S.user?.role === "admin";
  wrap.innerHTML = items.map((i) => `<article class="list-card cert-card ${cls(i.status)}">${preview(i)}<div class="section-head"><div><h3>${safe(i.title)}</h3><p class="muted">${safe(i.provider)} | ${safe(i.userName)}${i.userCode ? ` (${safe(i.userCode)})` : ""}</p></div><span class="status ${cls(i.status)}">${safe(i.status)}</span></div><div class="detail-grid"><p><strong>Code:</strong> ${safe(i.certificateCode)}</p><p><strong>Issue Date:</strong> ${safe(i.issueDate)}</p><p><strong>Expiry Date:</strong> ${safe(i.expiryDate)}</p><p><strong>Days Remaining:</strong> ${safe(i.daysRemaining)}</p></div><p><strong>Notes:</strong> ${safe(i.notes || "No notes added")}</p><div class="action-row">${i.certificateFile ? `<a class="button secondary" href="${i.certificateFile}" target="_blank" rel="noreferrer">View File</a>` : ""}${!isAdmin && i.certificateFile ? `<button class="button secondary" type="button" data-copy-link="${i.certificateFile}">Share Link</button>` : ""}${isAdmin ? `<button class="button secondary" type="button" data-edit-cert-id="${i.id}">Edit</button>` : ""}${page !== "student-overview" ? `<button class="button secondary" type="button" data-renew-id="${i.id}">${isAdmin ? "Renew" : "Request Renewal"}</button>` : ""}${isAdmin ? `<button class="button danger" type="button" data-delete-cert-id="${i.id}">Delete</button>` : ""}</div></article>`).join("");
}

function renderAlerts() {
  const wrap = $("alerts-list");
  if (!wrap) return;
  wrap.innerHTML = S.alerts.length ? S.alerts.map((a) => `<article class="list-card"><h3>${safe(a.title)}</h3><p class="muted">${safe(a.userName)} | ${safe(a.provider)}</p><div class="detail-grid"><p><strong>Expiry Date:</strong> ${safe(a.expiryDate)}</p><p><strong>Days Remaining:</strong> ${safe(a.daysRemaining)}</p></div></article>`).join("") : '<p class="empty">No expiring alerts right now.</p>';
}

function renderUsers() {
  const wrap = $("users-list");
  if (!wrap) return;
  if ($("user-page-info")) {
    const p = S.userPagination;
    $("user-page-info").textContent = `Page ${p.page} of ${p.totalPages} (${p.total} users)`;
    $("user-prev-btn")?.toggleAttribute("disabled", p.page <= 1);
    $("user-next-btn")?.toggleAttribute("disabled", p.page >= p.totalPages);
  }
  wrap.innerHTML = S.users.length ? S.users.map((u) => `<article class="list-card"><div class="section-head"><div class="profile-header">${avatar(u)}<div><h3>${safe(u.name)}</h3><p class="muted">${safe(u.email)} | ${safe(u.department || "General")}</p></div></div><span class="status ${cls(u.role)}">${safe(u.role)}</span></div><div class="detail-grid"><p><strong>User ID:</strong> ${safe(u.userId || "Not assigned")}</p><p><strong>Phone:</strong> ${safe(u.phone || "Not provided")}</p><p><strong>Status:</strong> ${u.isActive ? "Active" : "Inactive"}</p></div><div class="action-row"><button class="button secondary" type="button" data-edit-user-id="${u.id}">Edit User</button><button class="button danger" type="button" data-delete-user-id="${u.id}">Delete User</button></div></article>`).join("") : '<p class="empty">No users found for this search.</p>';
}

function renderRequests(limit = 0) {
  const wrap = $("request-list");
  if (!wrap) return;
  const items = limit ? S.requests.slice(0, limit) : S.requests;
  const isAdmin = S.user?.role === "admin";
  wrap.innerHTML = items.length ? items.map((r) => `<article class="list-card request-card ${cls(r.status)}"><div class="section-head"><div><h3>${r.requestType === "add" ? "New Certification Request" : "Renewal Request"}</h3><p class="muted">${safe(r.studentName)}${r.studentCode ? ` (${safe(r.studentCode)})` : ""} | ${safe(r.title || r.certificationTitle || "-")}</p></div><span class="status ${cls(r.status)}">${safe(r.status)}</span></div><div class="detail-grid"><p><strong>Provider:</strong> ${safe(r.provider || "-")}</p><p><strong>Issue Date:</strong> ${safe(r.issueDate || "-")}</p><p><strong>Expiry Date:</strong> ${safe(r.expiryDate || "-")}</p><p><strong>Code:</strong> ${safe(r.certificateCode || "-")}</p></div><div class="detail-grid"><p><strong>Requested:</strong> ${safe(r.createdAt || "-")}</p><p><strong>Proof Link:</strong> ${r.proofLink ? `<a class="inline-link" href="${r.proofLink}" target="_blank" rel="noreferrer">Open Link</a>` : "None"}</p><p><strong>Proof File:</strong> ${r.proofFile ? `<a class="inline-link" href="${r.proofFile}" target="_blank" rel="noreferrer">Open File</a>` : "None"}</p><p><strong>Reviewed:</strong> ${safe(r.reviewedAt || "Pending")}</p></div><p><strong>Student Note:</strong> ${safe(r.notes || "No note provided")}</p>${r.adminNote ? `<p><strong>Admin Note:</strong> ${safe(r.adminNote)}</p>` : ""}${isAdmin && r.status === "pending" ? `<div class="action-row"><button class="button primary" type="button" data-review-request-id="${r.id}">Review Request</button></div>` : ""}</article>`).join("") : '<p class="empty">No requests available right now.</p>';
}

function renderProfilePhoto(targetId, user = S.user) {
  const wrap = $(targetId);
  if (!wrap || !user) return;
  wrap.innerHTML = user.profilePhoto ? `<img src="${user.profilePhoto}" alt="${safe(user.name)}">` : safe(String(user.name || "U").split(/\s+/).slice(0, 2).map((p) => p[0] || "").join("").toUpperCase() || "U");
}

function showCreatedCredentials(user, password) {
  const wrap = $("created-user-credentials");
  if (!wrap || !user) return;
  wrap.classList.remove("hidden");
  wrap.innerHTML = `
    <div class="timeline-item">
      <strong>Account created successfully</strong><br>
      Name: ${safe(user.name)}<br>
      Role: ${safe(user.role)}<br>
      Email: ${safe(user.email)}<br>
      Password: ${safe(password)}<br>
      The user can log in directly with these credentials.
    </div>
  `;
}

function chartMarkup(entries) {
  const max = Math.max(1, ...entries.map(([, value]) => value));
  return `<div class="mini-chart">${entries.map(([label, value]) => `<div class="chart-row"><strong>${safe(label)}</strong><div class="chart-bar"><span style="width:${Math.max(8, (value / max) * 100)}%"></span></div><span>${value}</span></div>`).join("")}</div>`;
}

function recommendationsFor(certs) {
  const text = certs.map((c) => `${c.title} ${c.provider}`).join(" | ");
  const list = [];
  if (/aws/i.test(text) && !/azure fundamentals/i.test(text)) list.push("You completed AWS. Try Azure Fundamentals next.");
  if (/azure/i.test(text) && !/google cloud/i.test(text)) list.push("You already have Azure exposure. Google Cloud Digital Leader is a strong next step.");
  if (/security/i.test(text) && !/ccna/i.test(text)) list.push("Security skills pair well with networking. Consider CCNA or CyberOps Associate.");
  if (/javascript|react|node/i.test(text) && !/aws/i.test(text)) list.push("You have web skills. Add a cloud certification like AWS Cloud Practitioner.");
  if (!list.length) list.push("Start with a foundational certificate in Cloud, Web, or Data to build your roadmap.");
  return list.slice(0, 4);
}

function badgeList(certs) {
  const count = certs.length;
  const badges = [];
  if (count >= 3) badges.push("Achiever");
  if (count >= 5) badges.push("Specialist");
  if (count >= 10) badges.push("Expert");
  if (topEntries(summarizeCategories(certs), 1)[0]?.[1] >= 3) badges.push("Focused Learner");
  return badges.length ? badges : ["Getting Started"];
}

function renderNotifications() {
  const wrap = $("notification-list");
  if (!wrap) return;
  const notes = [];
  S.certifications.filter((c) => c.status === "Expiring Soon").slice(0, 3).forEach((c) => notes.push(`Renew ${c.title} before ${c.expiryDate}.`));
  S.requests.filter((r) => r.status === "pending").slice(0, 3).forEach((r) => notes.push(`Request pending: ${r.title || r.certificationTitle}.`));
  if (S.user?.role === "admin") {
    const exp = S.certifications.filter((c) => c.status === "Expired").length;
    notes.unshift(`${exp} certifications are already expired and need admin attention.`);
  }
  if (!notes.length) notes.push("No urgent notifications right now. Your portal is up to date.");
  wrap.innerHTML = notes.map((note) => `<div class="notification-item">${safe(note)}</div>`).join("");
}

function renderStudentAdvanced() {
  const analytics = $("student-analytics");
  const recWrap = $("recommendation-list");
  const badges = $("badge-list");
  const calendar = $("calendar-list");
  const certs = S.certifications;
  if (analytics) {
    const categoryData = topEntries(summarizeCategories(certs), 5);
    const monthly = certs.reduce((acc, item) => {
      const key = item.issueDate?.slice(0, 7) || "Unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    analytics.innerHTML = `
      <div class="metric-card">
        <h3>Skill Breakdown</h3>
        ${chartMarkup(categoryData.length ? categoryData : [["General", 0]])}
      </div>
      <div class="metric-card">
        <h3>Certifications Over Time</h3>
        ${chartMarkup(topEntries(monthly, 6).reverse())}
      </div>
      <div class="metric-card">
        <h3>Wallet Health</h3>
        <p><strong>${certs.length}</strong> total certificates stored in your digital wallet.</p>
        <p>${certs.filter((c) => c.status === "Active").length} active, ${certs.filter((c) => c.status === "Expiring Soon").length} expiring soon.</p>
      </div>
      <div class="metric-card">
        <h3>Skill Strength</h3>
        <p>Cloud: ${Math.min(100, (summarizeCategories(certs).Cloud || 0) * 20)}%</p>
        <p>Security: ${Math.min(100, (summarizeCategories(certs).Security || 0) * 20)}%</p>
        <p>Web/Data Blend: ${Math.min(100, ((summarizeCategories(certs).Web || 0) + (summarizeCategories(certs).Data || 0)) * 15)}%</p>
      </div>
    `;
  }
  if (recWrap) {
    recWrap.innerHTML = recommendationsFor(certs).map((text) => `<div class="timeline-item">${safe(text)}</div>`).join("");
  }
  if (badges) {
    badges.innerHTML = badgeList(certs).map((badge) => `<span class="feature-badge">${safe(badge)}</span>`).join("");
  }
  if (calendar) {
    const items = certs.slice().sort((a, b) => String(a.expiryDate).localeCompare(String(b.expiryDate))).slice(0, 5);
    calendar.innerHTML = items.length ? items.map((item) => `<div class="timeline-item"><strong>${safe(item.expiryDate)}</strong><br>${safe(item.title)} needs review.</div>`).join("") : `<div class="timeline-item">No upcoming expiry events.</div>`;
  }
}

function renderAdminAdvanced() {
  const analytics = $("admin-analytics");
  if (!analytics) return;
  const categoryData = topEntries(summarizeCategories(S.certifications), 6);
  const popular = topEntries(S.certifications.reduce((acc, item) => {
    acc[item.title] = (acc[item.title] || 0) + 1;
    return acc;
  }, {}), 5);
  const roleData = topEntries(S.users.reduce((acc, user) => {
    acc[user.role] = (acc[user.role] || 0) + 1;
    return acc;
  }, {}), 4);
  const expiryData = [["Active", S.certifications.filter((c) => c.status === "Active").length], ["Expiring Soon", S.certifications.filter((c) => c.status === "Expiring Soon").length], ["Expired", S.certifications.filter((c) => c.status === "Expired").length]];
  analytics.innerHTML = `
    <div class="metric-card">
      <h3>Popular Certifications</h3>
      ${chartMarkup(popular.length ? popular : [["No data", 0]])}
    </div>
    <div class="metric-card">
      <h3>Skill Category Trends</h3>
      ${chartMarkup(categoryData.length ? categoryData : [["General", 0]])}
    </div>
    <div class="metric-card">
      <h3>User Role Mix</h3>
      ${chartMarkup(roleData.length ? roleData : [["student", 0]])}
    </div>
    <div class="metric-card">
      <h3>Expiry Trend</h3>
      ${chartMarkup(expiryData)}
    </div>
  `;
}

function fillProfile() {
  const form = $("profile-form");
  if (!form || !S.user) return;
  form.elements.name.value = S.user.name || "";
  form.elements.department.value = S.user.department || "";
  form.elements.phone.value = S.user.phone || "";
  form.elements.password.value = "";
  if (form.elements.profilePhoto) form.elements.profilePhoto.value = "";
  renderProfilePhoto("profile-photo-preview");
}

function fillOwners() {
  const sel = $("cert-user-select");
  if (!sel) return;
  const list = S.user?.role === "admin" ? S.users : [S.user];
  sel.innerHTML = list.map((u) => `<option value="${u.id}">${safe(u.name)}${u.userId ? ` - ${safe(u.userId)}` : ""}</option>`).join("");
}

async function loadMe() {
  const data = await api("/api/auth/me");
  S.user = data.user;
  localStorage.setItem("skillcert-user", JSON.stringify(data.user));
}

async function loadUsers() {
  if (S.user?.role !== "admin") return;
  const params = new URLSearchParams({ page: S.userPagination.page, pageSize: S.userPagination.pageSize, search: $("user-search")?.value || "" });
  const data = await api(`/api/users?${params}`);
  S.users = data.users;
  S.userPagination = data.pagination || S.userPagination;
  renderUsers();
  fillOwners();
  renderAdminAdvanced();
}

async function loadCerts() {
  const params = new URLSearchParams({
    status: $("status-filter")?.value || "All",
    renewalStatus: $("renewal-filter")?.value || "All",
    search: $("cert-search")?.value || "",
    page: S.certPagination.page,
    pageSize: S.certPagination.pageSize
  });
  const data = await api(`/api/certifications?${params}`);
  S.certifications = data.certifications;
  S.summary = data.summary;
  S.certPagination = data.pagination || S.certPagination;
  renderSummary();
  renderCertifications(page === "student-overview" ? 3 : 0);
  renderStudentAdvanced();
  renderAdminAdvanced();
  renderNotifications();
}

async function loadAlerts() {
  if (S.user?.role !== "admin") return;
  const data = await api("/api/alerts/expiring?days=45");
  S.alerts = data.alerts;
  renderAlerts();
  renderNotifications();
}

async function loadRequests() {
  const data = await api("/api/requests");
  S.requests = data.requests;
  renderRequests(page === "admin-overview" || page === "student-overview" ? 4 : 0);
  renderNotifications();
}

function openUser(id) {
  const item = S.users.find((u) => u.id === id);
  const form = $("user-edit-form");
  if (!item || !form) return;
  form.elements.id.value = item.id;
  form.elements.name.value = item.name;
  form.elements.department.value = item.department || "";
  form.elements.phone.value = item.phone || "";
  form.elements.role.value = item.role;
  form.elements.isActive.value = String(item.isActive);
  form.elements.password.value = "";
  if (form.elements.profilePhoto) form.elements.profilePhoto.value = "";
  setMessage("user-edit-message", "");
  renderProfilePhoto("user-edit-photo-preview", item);
  $("user-modal")?.showModal?.();
}

function openCert(id) {
  const item = S.certifications.find((c) => c.id === id);
  const form = $("cert-edit-form");
  if (!item || !form) return;
  form.elements.id.value = item.id;
  form.elements.title.value = item.title;
  form.elements.provider.value = item.provider;
  form.elements.issueDate.value = item.issueDate;
  form.elements.expiryDate.value = item.expiryDate;
  form.elements.renewalStatus.value = item.renewalStatus;
  form.elements.reminderDays.value = item.reminderDays;
  form.elements.certificateCode.value = item.certificateCode;
  form.elements.notes.value = item.notes || "";
  form.elements.certificateFile.value = "";
  setMessage("cert-edit-message", "");
  $("cert-modal")?.showModal?.();
}

function openRenew(id) {
  const item = S.certifications.find((c) => c.id === id);
  const form = $("renew-form");
  if (!item || !form) return;
  form.elements.id.value = item.id;
  form.elements.expiryDate.value = item.expiryDate;
  form.elements.proofLink.value = "";
  form.elements.proofFile.value = "";
  form.elements.notes.value = "";
  setMessage("renew-message", "");
  $("renew-modal")?.showModal?.();
}

function openRequest(id) {
  const item = S.requests.find((r) => r.id === id);
  const form = $("request-review-form");
  if (!item || !form) return;
  form.elements.id.value = item.id;
  form.elements.decision.value = "approve";
  form.elements.adminNote.value = item.adminNote || "";
  setMessage("request-review-message", "");
  $("request-modal")?.showModal?.();
}

async function removeCert(id) {
  if (!window.confirm("Delete this certification?")) return;
  await api(`/api/certifications/${id}`, { method: "DELETE" });
  await loadCerts();
}

async function removeUser(id) {
  if (!window.confirm("Delete this user and related certifications?")) return;
  await api(`/api/users/${id}`, { method: "DELETE" });
  await loadUsers();
}

function wireDynamic() {
  document.querySelectorAll("[data-edit-user-id]").forEach((b) => b.onclick = () => openUser(b.dataset.editUserId));
  document.querySelectorAll("[data-delete-user-id]").forEach((b) => b.onclick = () => removeUser(b.dataset.deleteUserId).catch((e) => window.alert(e.message)));
  document.querySelectorAll("[data-edit-cert-id]").forEach((b) => b.onclick = () => openCert(b.dataset.editCertId));
  document.querySelectorAll("[data-delete-cert-id]").forEach((b) => b.onclick = () => removeCert(b.dataset.deleteCertId).catch((e) => window.alert(e.message)));
  document.querySelectorAll("[data-renew-id]").forEach((b) => b.onclick = () => openRenew(b.dataset.renewId));
  document.querySelectorAll("[data-review-request-id]").forEach((b) => b.onclick = () => openRequest(b.dataset.reviewRequestId));
  document.querySelectorAll("[data-copy-link]").forEach((b) => {
    b.onclick = async () => {
      try {
        await navigator.clipboard.writeText(`${window.location.origin}${b.dataset.copyLink}`);
        b.textContent = "Link Copied";
      } catch {
        window.alert("Copy failed.");
      }
    };
  });
}

function download(path, filename) {
  fetch(path, { headers: { Authorization: `Bearer ${S.token}` } }).then((r) => r.blob()).then((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  });
}

function requestData(form) {
  const d = new FormData();
  ["title", "provider", "issueDate", "expiryDate", "renewalStatus", "reminderDays", "certificateCode", "proofLink", "notes"].forEach((k) => d.set(k, form.elements[k].value));
  const file = form.elements.certificateFile?.files?.[0];
  if (file) d.set("proofFile", file);
  return d;
}

function initLogin() {
  $("show-signup-btn")?.addEventListener("click", () => $("signup-drawer")?.classList.add("open"));
  $("hide-signup-btn")?.addEventListener("click", () => $("signup-drawer")?.classList.remove("open"));
  $("open-forgot-btn")?.addEventListener("click", () => $("forgot-drawer")?.classList.add("open"));
  $("close-forgot-btn")?.addEventListener("click", () => $("forgot-drawer")?.classList.remove("open"));
  $("signup-role")?.addEventListener("change", () => $("admin-code-field")?.classList.toggle("hidden", $("signup-role").value !== "admin"));

  $("login-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      const data = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email: f.get("email"), password: f.get("password") }) });
      saveSession(data.token, data.user);
      window.location.href = routeForRole(data.user.role);
    } catch (err) {
      setMessage("login-message", err.message, true);
    }
  });

  $("signup-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      const data = await api("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          name: f.get("name"),
          email: f.get("email"),
          password: f.get("password"),
          department: f.get("department"),
          phone: f.get("phone"),
          role: f.get("role"),
          adminCode: f.get("adminCode")
        })
      });
      saveSession(data.token, data.user);
      window.location.href = routeForRole(data.user.role);
    } catch (err) {
      setMessage("signup-message", err.message, true);
    }
  });

  $("forgot-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      const data = await api("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email: f.get("email") }) });
      document.querySelector('#reset-form input[name="email"]').value = f.get("email");
      setMessage("forgot-message", data.message);
    } catch (err) {
      setMessage("forgot-message", err.message, true);
    }
  });

  $("reset-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      const data = await api("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ email: f.get("email"), otp: f.get("otp"), newPassword: f.get("newPassword") })
      });
      setMessage("forgot-message", data.message);
      e.currentTarget.reset();
    } catch (err) {
      setMessage("forgot-message", err.message, true);
    }
  });
}

async function initPortal() {
  if ((adminPages.has(page) || studentPages.has(page) || page === "dashboard") && !S.token) {
    window.location.href = "/login";
    return;
  }
  try {
    await loadMe();
  } catch {
    clearSession();
    window.location.href = "/login";
    return;
  }
  if (page === "dashboard") {
    window.location.href = routeForRole(S.user.role);
    return;
  }
  if (adminPages.has(page) && S.user.role !== "admin") {
    window.location.href = routeForRole(S.user.role);
    return;
  }
  if (studentPages.has(page) && S.user.role !== "student") {
    window.location.href = routeForRole(S.user.role);
    return;
  }

  setShell();
  renderProfilePhoto("new-user-photo-preview", { name: "U" });
  $("logout-btn")?.addEventListener("click", () => {
    clearSession();
    window.location.href = "/login";
  });
  document.querySelectorAll("[data-close-modal]").forEach((b) => b.onclick = () => $(b.dataset.closeModal)?.close?.());
  $("request-reject-btn")?.addEventListener("click", () => {
    $("request-review-form").elements.decision.value = "reject";
    $("request-review-form").requestSubmit();
  });

  if ($("profile-form")) {
    fillProfile();
    $("profile-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      try {
        const data = await api(`/api/users/${S.user.id}`, { method: "PUT", body: f });
        S.user = data.user;
        localStorage.setItem("skillcert-user", JSON.stringify(data.user));
        setShell();
        fillProfile();
        setMessage("profile-message", "Profile updated successfully.");
      } catch (err) {
        setMessage("profile-message", err.message, true);
      }
    });
  }

  if (S.user.role === "admin" && ($("users-list") || $("cert-user-select") || $("admin-analytics"))) await loadUsers();
  if ($("certification-list") || $("summary-grid") || $("student-analytics") || $("admin-analytics") || $("notification-list") || $("calendar-list") || $("recommendation-list")) await loadCerts();
  if ($("alerts-list") || (S.user.role === "admin" && $("notification-list"))) await loadAlerts();
  if ($("request-list") || $("notification-list")) await loadRequests();
  renderNotifications();
  renderStudentAdvanced();
  renderAdminAdvanced();
  wireDynamic();

  $("refresh-alerts-btn")?.addEventListener("click", loadAlerts);
  $("refresh-requests-btn")?.addEventListener("click", async () => { await loadRequests(); wireDynamic(); });
  $("refresh-users-btn")?.addEventListener("click", async () => { await loadUsers(); wireDynamic(); });
  $("export-users-btn")?.addEventListener("click", () => download("/api/exports/users", "users-export.csv"));
  $("export-certifications-btn")?.addEventListener("click", () => download("/api/exports/certifications", "certifications-export.csv"));

  $("user-search")?.addEventListener("input", async () => { S.userPagination.page = 1; await loadUsers(); wireDynamic(); });
  $("cert-search")?.addEventListener("input", async () => { S.certPagination.page = 1; await loadCerts(); wireDynamic(); });
  $("status-filter")?.addEventListener("change", async () => { S.certPagination.page = 1; await loadCerts(); wireDynamic(); });
  $("renewal-filter")?.addEventListener("change", async () => { S.certPagination.page = 1; await loadCerts(); wireDynamic(); });
  $("user-prev-btn")?.addEventListener("click", async () => { if (S.userPagination.page > 1) { S.userPagination.page -= 1; await loadUsers(); wireDynamic(); } });
  $("user-next-btn")?.addEventListener("click", async () => { if (S.userPagination.page < S.userPagination.totalPages) { S.userPagination.page += 1; await loadUsers(); wireDynamic(); } });
  $("cert-prev-btn")?.addEventListener("click", async () => { if (S.certPagination.page > 1) { S.certPagination.page -= 1; await loadCerts(); wireDynamic(); } });
  $("cert-next-btn")?.addEventListener("click", async () => { if (S.certPagination.page < S.certPagination.totalPages) { S.certPagination.page += 1; await loadCerts(); wireDynamic(); } });

  $("user-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      const createdPassword = String(f.get("password") || "");
      const data = await api("/api/users", { method: "POST", body: f });
      e.currentTarget.reset();
      renderProfilePhoto("new-user-photo-preview", { name: "U" });
      setMessage("user-message", "User created successfully.");
      showCreatedCredentials(data.user, createdPassword);
      S.userPagination.page = 1;
      await loadUsers();
      wireDynamic();
    } catch (err) {
      setMessage("user-message", err.message, true);
    }
  });

  $("user-edit-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await api(`/api/users/${f.get("id")}`, { method: "PUT", body: f });
      $("user-modal")?.close?.();
      await loadUsers();
      wireDynamic();
    } catch (err) {
      setMessage("user-edit-message", err.message, true);
    }
  });

  $("cert-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    try {
      if (S.user.role === "admin") {
        const d = new FormData(form);
        d.set("userId", $("cert-user-select").value);
        await api("/api/certifications", { method: "POST", body: d });
        setMessage("cert-message", "Certification saved successfully.");
      } else {
        await api("/api/requests/add", { method: "POST", body: requestData(form) });
        setMessage("cert-message", "Certification request submitted for admin approval.");
      }
      form.reset();
      fillOwners();
      S.certPagination.page = 1;
      await loadCerts();
      if ($("request-list")) await loadRequests();
      wireDynamic();
    } catch (err) {
      setMessage("cert-message", err.message, true);
    }
  });

  $("cert-edit-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await api(`/api/certifications/${f.get("id")}`, { method: "PUT", body: f });
      $("cert-modal")?.close?.();
      await loadCerts();
      wireDynamic();
    } catch (err) {
      setMessage("cert-edit-message", err.message, true);
    }
  });

  $("renew-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      if (S.user.role === "admin") {
        await api(`/api/certifications/${f.get("id")}/renew`, { method: "POST", body: JSON.stringify({ expiryDate: f.get("expiryDate"), notes: f.get("notes"), renewalStatus: "Renewed" }) });
        await loadCerts();
      } else {
        await api(`/api/requests/renew/${f.get("id")}`, { method: "POST", body: f });
        if ($("request-list")) await loadRequests();
      }
      $("renew-modal")?.close?.();
      wireDynamic();
    } catch (err) {
      setMessage("renew-message", err.message, true);
    }
  });

  $("request-review-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const endpoint = (f.get("decision") || "approve") === "reject" ? "reject" : "approve";
    try {
      await api(`/api/requests/${f.get("id")}/${endpoint}`, { method: "POST", body: JSON.stringify({ adminNote: f.get("adminNote") }) });
      $("request-modal")?.close?.();
      await loadRequests();
      if ($("certification-list") || $("summary-grid")) await loadCerts();
      if ($("alerts-list")) await loadAlerts();
      wireDynamic();
    } catch (err) {
      setMessage("request-review-message", err.message, true);
    }
  });
}

if (page === "login") initLogin();
if (page === "dashboard" || adminPages.has(page) || studentPages.has(page)) initPortal();
