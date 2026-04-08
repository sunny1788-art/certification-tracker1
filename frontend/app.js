const S = {
  token: localStorage.getItem("skillcert-token") || "",
  user: JSON.parse(localStorage.getItem("skillcert-user") || "null"),
  users: [],
  ownerResults: [],
  selectedOwner: null,
  learningSummary: null,
  courses: [],
  enrollments: [],
  events: [],
  selectedCourse: null,
  certifications: [],
  requests: [],
  alerts: [],
  summary: null,
  userPagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 },
  certPagination: { page: 1, pageSize: 12, total: 0, totalPages: 1 }
};
const page = document.body.dataset.page;
const pageParams = new URLSearchParams(window.location.search);
const adminPages = new Set(["admin-overview", "admin-users", "admin-certifications", "admin-learning", "admin-requests", "admin-profile"]);
const studentPages = new Set(["student-overview", "student-learning", "student-certifications", "student-requests", "student-profile"]);

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

function setupPasswordToggles(scope = document) {
  scope.querySelectorAll("[data-password-toggle]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    const input = scope.querySelector(`#${button.dataset.passwordToggle}`);
    if (!input) return;
    const sync = () => {
      const visible = input.type === "text";
      button.setAttribute("aria-label", visible ? "Hide password" : "Show password");
      button.setAttribute("title", visible ? "Hide password" : "Show password");
      button.textContent = visible ? "Hide" : "Show";
      button.textContent = visible ? "🙈" : "👁";
    };
    button.addEventListener("click", () => {
      input.type = input.type === "password" ? "text" : "password";
      sync();
    });
    sync();
  });
}

function setupFilePreview(inputSelector, previewId) {
  const input = document.querySelector(inputSelector);
  const preview = $(previewId);
  if (!input || !preview) return;
  if (input.dataset.previewBound === "true") return;
  input.dataset.previewBound = "true";
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      preview.innerHTML = `<img src="${reader.result}" alt="Preview">`;
    };
    reader.readAsDataURL(file);
  });
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
  wrap.innerHTML = S.users.length ? S.users.map((u) => `<article class="list-card"><div class="section-head"><div class="profile-header">${avatar(u)}<div><h3>${safe(u.name)}</h3><p class="muted">${safe(u.email)} | ${safe(u.department || "General")}</p></div></div><span class="status ${cls(u.role)}">${safe(u.role)}</span></div><div class="detail-grid"><p><strong>User ID:</strong> ${safe(u.userId || "Not assigned")}</p><p><strong>Phone:</strong> ${safe(u.phone || "Not provided")}</p><p><strong>Status:</strong> ${u.isActive ? "Active" : "Blocked"}</p><p><strong>Courses Completed:</strong> ${safe(u.stats?.coursesCompleted || 0)}</p><p><strong>Certifications:</strong> ${safe(u.stats?.certifications || 0)}</p><p><strong>Progress:</strong> ${safe(u.stats?.progressPercent || 0)}%</p><p><strong>Average Score:</strong> ${safe(u.stats?.averageScore || 0)}</p><p><strong>Suspicious Score:</strong> ${safe(u.suspiciousScore || 0)}</p></div>${u.blockedReason ? `<p><strong>Blocked Reason:</strong> ${safe(u.blockedReason)}</p>` : ""}${u.suspiciousReason ? `<p><strong>Flag:</strong> ${safe(u.suspiciousReason)}</p>` : ""}<div class="action-row"><a class="button secondary" href="/admin/certifications?userId=${encodeURIComponent(u.id)}&userSearch=${encodeURIComponent(u.email)}">Add Certificate</a><button class="button secondary" type="button" data-edit-user-id="${u.id}">Edit User</button><button class="button secondary" type="button" data-view-user-id="${u.id}">View Score</button>${u.isActive ? `<button class="button danger" type="button" data-block-user-id="${u.id}">Block User</button>` : `<button class="button primary" type="button" data-unblock-user-id="${u.id}">Unblock</button>`}<button class="button danger" type="button" data-delete-user-id="${u.id}">Delete User</button></div></article>`).join("") : '<p class="empty">No users found for this search.</p>';
}

function renderLearningSummary() {
  const wrap = $("learning-summary-grid");
  if (!wrap || !S.learningSummary) return;
  wrap.innerHTML = Object.entries(S.learningSummary)
    .map(([key, value]) => `<article class="mini-stat"><span>${safe(key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase()))}</span><strong>${safe(value)}</strong></article>`)
    .join("");
}

function renderCourseCatalog() {
  const wrap = $("course-list");
  if (!wrap) return;
  if (!S.courses.length) {
    wrap.innerHTML = '<p class="empty">No courses available right now.</p>';
    return;
  }

  const isAdmin = S.user?.role === "admin";
  wrap.innerHTML = S.courses.map((course) => {
    const enrollment = course.enrollment;
    return `<article class="list-card"><div class="section-head"><div><h3>${safe(course.title)}</h3><p class="muted">${safe(course.skillCategory)} | ${safe(course.level)} | ${safe(course.durationHours)} hrs</p></div><span class="status ${cls(course.status)}">${safe(course.status)}</span></div><p>${safe(course.description || "No description added.")}</p><div class="detail-grid"><p><strong>Certificate:</strong> ${safe(course.certificationTitle)}</p><p><strong>Issuer:</strong> ${safe(course.issuer)}</p><p><strong>Passing Score:</strong> ${safe(course.passingScore)}%</p><p><strong>Rating:</strong> ${safe(course.ratingAverage)} / 5 (${safe(course.ratingCount)} ratings)</p>${isAdmin ? `<p><strong>Enrollments:</strong> ${safe(course.totalEnrollments || 0)}</p><p><strong>Pending Approval:</strong> ${safe(course.pendingCount || 0)}</p><p><strong>Average Learner Score:</strong> ${safe(course.averageLearnerScore || 0)}</p>` : `<p><strong>Progress:</strong> ${safe(enrollment?.progressPercent || 0)}%</p><p><strong>My Score:</strong> ${safe(enrollment?.averageScore || 0)}</p><p><strong>Status:</strong> ${safe(enrollment?.status || "not registered")}</p>`}</div><p><strong>Modules:</strong> ${safe((course.modules || []).join(", ") || "No modules listed")}</p><p><strong>Assignments:</strong> ${safe((course.assignments || []).join(", ") || "No assignments listed")}</p><div class="action-row">${isAdmin ? `<button class="button secondary" type="button" data-edit-course-id="${course.id}">Edit Course</button>` : `${enrollment ? `<button class="button secondary" type="button" data-submit-enrollment-id="${enrollment.id}">Update Progress</button>${enrollment.status === "approved" ? `<button class="button secondary" type="button" data-rate-enrollment-id="${enrollment.id}">Rate Course</button>` : ""}` : `<button class="button primary" type="button" data-register-course-id="${course.id}">Register Course</button>`}`}</div></article>`;
  }).join("");
}

function renderEnrollments() {
  const wrap = $("enrollment-list");
  if (!wrap) return;
  if (!S.enrollments.length) {
    wrap.innerHTML = '<p class="empty">No course submissions available right now.</p>';
    return;
  }

  const isAdmin = S.user?.role === "admin";
  wrap.innerHTML = S.enrollments.map((item) => `<article class="list-card"><div class="section-head"><div><h3>${safe(item.courseTitle)}</h3><p class="muted">${safe(item.userName || "")}${item.userCode ? ` (${safe(item.userCode)})` : ""}</p></div><span class="status ${cls(item.status)}">${safe(item.status)}</span></div><div class="detail-grid"><p><strong>Progress:</strong> ${safe(item.progressPercent)}%</p><p><strong>Quiz Score:</strong> ${safe(item.quizScore)}</p><p><strong>Assignment Score:</strong> ${safe(item.assignmentScore)}</p><p><strong>Average Score:</strong> ${safe(item.averageScore)}</p><p><strong>Submitted:</strong> ${safe(item.submittedAt || "Not submitted")}</p><p><strong>Approved:</strong> ${safe(item.approvedAt || "Pending")}</p></div>${item.assignmentLink ? `<p><strong>Assignment Link:</strong> <a class="inline-link" href="${item.assignmentLink}" target="_blank" rel="noreferrer">Open Submission</a></p>` : ""}${item.adminNote ? `<p><strong>Admin Note:</strong> ${safe(item.adminNote)}</p>` : ""}<div class="action-row">${isAdmin && item.status === "pending_approval" ? `<button class="button primary" type="button" data-approve-enrollment-id="${item.id}">Approve</button><button class="button danger" type="button" data-reject-enrollment-id="${item.id}">Reject</button>` : ""}</div></article>`).join("");
}

function renderEvents() {
  const wrap = $("event-list");
  if (!wrap) return;
  if (!S.events.length) {
    wrap.innerHTML = '<p class="empty">No skill events available right now.</p>';
    return;
  }

  const isAdmin = S.user?.role === "admin";
  wrap.innerHTML = S.events.map((event) => `<article class="list-card"><div class="section-head"><div><h3>${safe(event.title)}</h3><p class="muted">${safe(event.category)} | ${safe(event.mode)}</p></div><span class="status ${cls(event.status)}">${safe(event.status)}</span></div><p>${safe(event.description || "No description added.")}</p><div class="detail-grid"><p><strong>Start Date:</strong> ${safe(event.startDate)}</p><p><strong>End Date:</strong> ${safe(event.endDate)}</p><p><strong>Deadline:</strong> ${safe(event.registrationDeadline)}</p><p><strong>Location:</strong> ${safe(event.location || "TBA")}</p><p><strong>Registrations:</strong> ${safe(event.registrationCount)}</p><p><strong>Seats Left:</strong> ${safe(event.seatsLeft)}</p></div><div class="action-row">${isAdmin ? `<button class="button secondary" type="button" data-edit-event-id="${event.id}">Edit Event</button>` : `${event.isRegistered ? `<span class="badge">Registered</span>` : `<button class="button primary" type="button" data-register-event-id="${event.id}">Register Event</button>`}`}</div></article>`).join("");
}

function renderRequests(limit = 0) {
  const wrap = $("request-list");
  if (!wrap) return;
  const queryType = (pageParams.get("type") || "all").toLowerCase();
  const queryStatus = (pageParams.get("requestStatus") || "all").toLowerCase();
  const filtered = S.requests.filter((request) => {
    const typeOk = queryType === "all" || request.requestType === queryType;
    const statusOk = queryStatus === "all" || String(request.status || "").toLowerCase() === queryStatus;
    return typeOk && statusOk;
  });
  const items = limit ? filtered.slice(0, limit) : filtered;
  const isAdmin = S.user?.role === "admin";
  wrap.innerHTML = items.length ? items.map((r) => `<article class="list-card request-card ${cls(r.status)}"><div class="section-head"><div><h3>${r.requestType === "add" ? "New Certification Request" : "Renewal Request"}</h3><p class="muted">${safe(r.studentName)}${r.studentCode ? ` (${safe(r.studentCode)})` : ""} | ${safe(r.title || r.certificationTitle || "-")}</p></div><span class="status ${cls(r.status)}">${safe(r.status)}</span></div><div class="detail-grid"><p><strong>Provider:</strong> ${safe(r.provider || "-")}</p><p><strong>Issue Date:</strong> ${safe(r.issueDate || "-")}</p><p><strong>Expiry Date:</strong> ${safe(r.expiryDate || "-")}</p><p><strong>Code:</strong> ${safe(r.certificateCode || "-")}</p></div><div class="detail-grid"><p><strong>Requested:</strong> ${safe(r.createdAt || "-")}</p><p><strong>Proof Link:</strong> ${r.proofLink ? `<a class="inline-link" href="${r.proofLink}" target="_blank" rel="noreferrer">Open Link</a>` : "None"}</p><p><strong>Proof File:</strong> ${r.proofFile ? `<a class="inline-link" href="${r.proofFile}" target="_blank" rel="noreferrer">Open File</a>` : "None"}</p><p><strong>Reviewed:</strong> ${safe(r.reviewedAt || "Pending")}</p></div><p><strong>Student Note:</strong> ${safe(r.notes || "No note provided")}</p>${r.adminNote ? `<p><strong>Admin Note:</strong> ${safe(r.adminNote)}</p>` : ""}${isAdmin && r.status === "pending" ? `<div class="action-row"><button class="button primary" type="button" data-review-request-id="${r.id}">Review Request</button></div>` : ""}</article>`).join("") : '<p class="empty">No requests available right now.</p>';
}

function renderProfilePhoto(targetId, user = S.user) {
  const wrap = $(targetId);
  if (!wrap || !user) return;
  wrap.innerHTML = user.profilePhoto ? `<img src="${user.profilePhoto}" alt="${safe(user.name)}">` : safe(String(user.name || "U").split(/\s+/).slice(0, 2).map((p) => p[0] || "").join("").toUpperCase() || "U");
}

function syncPageFilters() {
  const status = pageParams.get("status");
  const renewal = pageParams.get("renewalStatus");
  const search = pageParams.get("search");
  const userSearch = pageParams.get("userSearch");
  if ($("status-filter") && status) $("status-filter").value = status;
  if ($("renewal-filter") && renewal) $("renewal-filter").value = renewal;
  if ($("cert-search") && search) $("cert-search").value = search;
  if ($("user-search") && (userSearch || search)) $("user-search").value = userSearch || search;
  if ($("cert-owner-search") && (userSearch || search)) $("cert-owner-search").value = userSearch || search;
  if ($("course-search") && search) $("course-search").value = search;
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
  S.enrollments.filter((item) => item.status === "pending_approval").slice(0, 3).forEach((item) => notes.push(`Course approval pending: ${item.courseTitle}.`));
  S.events.filter((item) => item.isRegistered).slice(0, 2).forEach((item) => notes.push(`Registered event: ${item.title} on ${item.startDate}.`));
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

function renderOwnerSelection() {
  const selectedWrap = $("cert-owner-selected");
  const resultsWrap = $("cert-owner-results");
  const hidden = $("cert-user-id");
  if (hidden) hidden.value = S.selectedOwner?.id || "";

  if (selectedWrap) {
    if (!S.selectedOwner) {
      selectedWrap.classList.add("hidden");
      selectedWrap.innerHTML = "";
    } else {
      selectedWrap.classList.remove("hidden");
      selectedWrap.innerHTML = `
        <div class="picker-selected-card">
          <strong>${safe(S.selectedOwner.name)}</strong>
          <span>${safe(S.selectedOwner.email)}</span>
          <span>${safe(S.selectedOwner.userId || "No User ID")} | ${safe(S.selectedOwner.department || "General")}</span>
        </div>
      `;
    }
  }

  if (resultsWrap) {
    resultsWrap.innerHTML = S.ownerResults.length
      ? S.ownerResults.map((user) => `<button class="picker-result" type="button" data-owner-id="${user.id}"><strong>${safe(user.name)}</strong><span>${safe(user.email)}</span><span>${safe(user.userId || "No User ID")} | ${safe(user.department || "General")}</span></button>`).join("")
      : "";
  }
}

function setSelectedOwner(user) {
  S.selectedOwner = user || null;
  renderOwnerSelection();
}

async function searchOwners(term) {
  const query = String(term || "").trim();
  if (!query) {
    S.ownerResults = [];
    renderOwnerSelection();
    return;
  }
  const data = await api(`/api/users?${new URLSearchParams({ search: query, page: 1, pageSize: 8 })}`);
  S.ownerResults = data.users || [];
  renderOwnerSelection();
}

async function initOwnerPicker() {
  const searchInput = $("cert-owner-search");
  if (!searchInput || S.user?.role !== "admin") return;

  const clearSelection = () => {
    searchInput.value = "";
    S.ownerResults = [];
    setSelectedOwner(null);
    setMessage("cert-message", "");
  };

  $("clear-owner-btn")?.addEventListener("click", clearSelection);

  searchInput.addEventListener("input", async () => {
    const value = searchInput.value.trim();
    if (S.selectedOwner && value !== `${S.selectedOwner.name} | ${S.selectedOwner.email}`) {
      setSelectedOwner(null);
    }
    if (value.length < 2) {
      S.ownerResults = [];
      renderOwnerSelection();
      return;
    }
    try {
      await searchOwners(value);
    } catch (error) {
      setMessage("cert-message", error.message, true);
    }
  });

  $("cert-owner-results")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-owner-id]");
    if (!button) return;
    const owner = S.ownerResults.find((item) => item.id === button.dataset.ownerId);
    if (!owner) return;
    searchInput.value = `${owner.name} | ${owner.email}`;
    S.ownerResults = [];
    setSelectedOwner(owner);
    setMessage("cert-message", `Certificate will be added for ${owner.name}.`);
  });

  const queryId = pageParams.get("userId");
  const querySearch = (pageParams.get("userSearch") || "").trim();
  if (queryId || querySearch) {
    try {
      const data = await api(`/api/users?${new URLSearchParams({ search: querySearch || queryId, page: 1, pageSize: 8 })}`);
      const matched = (data.users || []).find((user) => user.id === queryId) || data.users?.[0];
      if (matched) {
        searchInput.value = `${matched.name} | ${matched.email}`;
        setSelectedOwner(matched);
      }
    } catch (error) {
      setMessage("cert-message", error.message, true);
    }
  }
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

async function loadLearningSummary() {
  const data = await api("/api/learning/summary");
  S.learningSummary = data.summary;
  renderLearningSummary();
}

async function loadCourses() {
  const search = $("course-search")?.value || "";
  const data = await api(`/api/learning/courses?${new URLSearchParams({ search })}`);
  S.courses = data.courses;
  renderCourseCatalog();
}

async function loadEnrollments() {
  const status = $("enrollment-status-filter")?.value || "";
  const query = status ? `?${new URLSearchParams({ status })}` : "";
  const data = await api(`/api/learning/enrollments${query}`);
  S.enrollments = data.enrollments;
  renderEnrollments();
}

async function loadEvents() {
  const data = await api("/api/events");
  S.events = data.events;
  renderEvents();
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

function openCourse(id) {
  const item = S.courses.find((course) => course.id === id);
  const form = $("course-edit-form");
  if (!item || !form) return;
  form.elements.id.value = item.id;
  form.elements.title.value = item.title;
  form.elements.description.value = item.description || "";
  form.elements.skillCategory.value = item.skillCategory || "General";
  form.elements.level.value = item.level || "Beginner";
  form.elements.durationHours.value = item.durationHours || 6;
  form.elements.certificationTitle.value = item.certificationTitle || item.title;
  form.elements.issuer.value = item.issuer || "";
  form.elements.passingScore.value = item.passingScore || 70;
  form.elements.expiryMonths.value = item.expiryMonths || 24;
  form.elements.status.value = item.status || "active";
  form.elements.modules.value = (item.modules || []).join("\n");
  form.elements.assignments.value = (item.assignments || []).join("\n");
  setMessage("course-edit-message", "");
  $("course-modal")?.showModal?.();
}

function openEvent(id) {
  const item = S.events.find((event) => event.id === id);
  const form = $("event-edit-form");
  if (!item || !form) return;
  form.elements.id.value = item.id;
  form.elements.title.value = item.title;
  form.elements.description.value = item.description || "";
  form.elements.category.value = item.category || "Skill Event";
  form.elements.mode.value = item.mode || "online";
  form.elements.location.value = item.location || "";
  form.elements.startDate.value = item.startDate;
  form.elements.endDate.value = item.endDate;
  form.elements.registrationDeadline.value = item.registrationDeadline;
  form.elements.capacity.value = item.capacity || 100;
  form.elements.status.value = item.status || "open";
  setMessage("event-edit-message", "");
  $("event-modal")?.showModal?.();
}

function openProgress(id) {
  const item = S.enrollments.find((enrollment) => enrollment.id === id) || S.courses.map((course) => course.enrollment).find((enrollment) => enrollment?.id === id);
  const form = $("progress-form");
  if (!item || !form) return;
  form.elements.id.value = item.id;
  form.elements.progressPercent.value = item.progressPercent || 0;
  form.elements.quizScore.value = item.quizScore || 0;
  form.elements.assignmentScore.value = item.assignmentScore || 0;
  form.elements.assignmentLink.value = item.assignmentLink || "";
  form.elements.assignmentNotes.value = item.assignmentNotes || "";
  setMessage("progress-message", "");
  $("progress-modal")?.showModal?.();
}

function openRating(id) {
  const item = S.enrollments.find((enrollment) => enrollment.id === id) || S.courses.map((course) => course.enrollment).find((enrollment) => enrollment?.id === id);
  const form = $("rating-form");
  if (!item || !form) return;
  form.elements.id.value = item.id;
  form.elements.stars.value = item.stars || 5;
  setMessage("rating-message", "");
  $("rating-modal")?.showModal?.();
}

async function registerCourse(id) {
  await api(`/api/learning/courses/${id}/register`, { method: "POST" });
  await loadCourses();
  await loadEnrollments();
  await loadLearningSummary();
}

async function registerEvent(id) {
  await api(`/api/events/${id}/register`, { method: "POST" });
  await loadEvents();
  await loadLearningSummary();
}

async function approveEnrollment(id) {
  const adminNote = window.prompt("Optional admin note for approval:", "") || "";
  await api(`/api/learning/enrollments/${id}/approve`, {
    method: "POST",
    body: JSON.stringify({ adminNote })
  });
  await loadEnrollments();
  await loadCourses();
  await loadCerts();
  await loadLearningSummary();
}

async function rejectEnrollment(id) {
  const adminNote = window.prompt("Reason for rejection:", "Please improve the submission.") || "Please improve the submission.";
  await api(`/api/learning/enrollments/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ adminNote })
  });
  await loadEnrollments();
  await loadCourses();
}

async function blockUser(id) {
  const reason = window.prompt("Why are you blocking this user?", "Blocked by admin due to suspicious activity.") || "Blocked by admin due to suspicious activity.";
  await api(`/api/users/${id}/block`, {
    method: "POST",
    body: JSON.stringify({ reason })
  });
  await loadUsers();
  wireDynamic();
}

async function unblockUser(id) {
  await api(`/api/users/${id}/unblock`, { method: "POST" });
  await loadUsers();
  wireDynamic();
}

async function viewUserInsights(id) {
  const data = await api(`/api/users/${id}/insights`);
  const wrap = $("user-insights-content");
  if (!wrap) return;
  wrap.innerHTML = `
    <div class="timeline-item"><strong>${safe(data.user.name)}</strong><br>${safe(data.user.email)}${data.user.userId ? ` | ${safe(data.user.userId)}` : ""}</div>
    <div class="detail-grid">
      <p><strong>Certifications:</strong> ${safe(data.insights.certifications)}</p>
      <p><strong>Courses Completed:</strong> ${safe(data.insights.coursesCompleted)}</p>
      <p><strong>Pending Courses:</strong> ${safe(data.insights.pendingCourses)}</p>
      <p><strong>Progress:</strong> ${safe(data.insights.progressPercent)}%</p>
      <p><strong>Average Score:</strong> ${safe(data.insights.averageScore)}</p>
      <p><strong>Suspicious Score:</strong> ${safe(data.user.suspiciousScore || 0)}</p>
    </div>
    <div class="timeline-list">
      ${data.insights.recentEnrollments.length ? data.insights.recentEnrollments.map((item) => `<div class="timeline-item"><strong>${safe(item.courseTitle)}</strong><br>Status: ${safe(item.status)} | Score: ${safe(item.averageScore)} | Progress: ${safe(item.progressPercent)}%</div>`).join("") : '<div class="timeline-item">No course data available for this user.</div>'}
    </div>
  `;
  $("user-insights-modal")?.showModal?.();
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
  document.querySelectorAll("[data-view-user-id]").forEach((b) => b.onclick = () => viewUserInsights(b.dataset.viewUserId).catch((e) => window.alert(e.message)));
  document.querySelectorAll("[data-block-user-id]").forEach((b) => b.onclick = () => blockUser(b.dataset.blockUserId).catch((e) => window.alert(e.message)));
  document.querySelectorAll("[data-unblock-user-id]").forEach((b) => b.onclick = () => unblockUser(b.dataset.unblockUserId).catch((e) => window.alert(e.message)));
  document.querySelectorAll("[data-delete-user-id]").forEach((b) => b.onclick = () => removeUser(b.dataset.deleteUserId).catch((e) => window.alert(e.message)));
  document.querySelectorAll("[data-edit-cert-id]").forEach((b) => b.onclick = () => openCert(b.dataset.editCertId));
  document.querySelectorAll("[data-delete-cert-id]").forEach((b) => b.onclick = () => removeCert(b.dataset.deleteCertId).catch((e) => window.alert(e.message)));
  document.querySelectorAll("[data-renew-id]").forEach((b) => b.onclick = () => openRenew(b.dataset.renewId));
  document.querySelectorAll("[data-review-request-id]").forEach((b) => b.onclick = () => openRequest(b.dataset.reviewRequestId));
  document.querySelectorAll("[data-register-course-id]").forEach((b) => b.onclick = () => registerCourse(b.dataset.registerCourseId).catch((e) => window.alert(e.message)));
  document.querySelectorAll("[data-submit-enrollment-id]").forEach((b) => b.onclick = () => openProgress(b.dataset.submitEnrollmentId));
  document.querySelectorAll("[data-rate-enrollment-id]").forEach((b) => b.onclick = () => openRating(b.dataset.rateEnrollmentId));
  document.querySelectorAll("[data-approve-enrollment-id]").forEach((b) => b.onclick = () => approveEnrollment(b.dataset.approveEnrollmentId).catch((e) => window.alert(e.message)));
  document.querySelectorAll("[data-reject-enrollment-id]").forEach((b) => b.onclick = () => rejectEnrollment(b.dataset.rejectEnrollmentId).catch((e) => window.alert(e.message)));
  document.querySelectorAll("[data-edit-course-id]").forEach((b) => b.onclick = () => openCourse(b.dataset.editCourseId));
  document.querySelectorAll("[data-register-event-id]").forEach((b) => b.onclick = () => registerEvent(b.dataset.registerEventId).catch((e) => window.alert(e.message)));
  document.querySelectorAll("[data-edit-event-id]").forEach((b) => b.onclick = () => openEvent(b.dataset.editEventId));
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
  fetch(path, { headers: { Authorization: `Bearer ${S.token}` } }).then((r) => {
    if (!r.ok) throw new Error("Export failed.");
    return r.blob();
  }).then((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }).catch((error) => {
    window.alert(error.message || "Download failed.");
  });
}

function requestData(form) {
  const d = new FormData();
  ["title", "provider", "issueDate", "expiryDate", "renewalStatus", "reminderDays", "certificateCode", "proofLink", "notes"].forEach((k) => d.set(k, form.elements[k].value));
  const file = form.elements.certificateFile?.files?.[0];
  if (file) d.set("proofFile", file);
  return d;
}

function profileFormData(form) {
  const d = new FormData();
  d.set("name", form.elements.name.value);
  d.set("department", form.elements.department.value);
  d.set("phone", form.elements.phone.value);
  if (form.elements.password?.value) d.set("password", form.elements.password.value);
  const photo = form.elements.profilePhoto?.files?.[0];
  if (photo) d.set("profilePhoto", photo);
  return d;
}

function userFormData(form) {
  const d = new FormData();
  d.set("name", form.elements.name.value);
  d.set("email", form.elements.email.value);
  d.set("password", form.elements.password.value);
  d.set("role", form.elements.role.value);
  d.set("department", form.elements.department.value);
  d.set("phone", form.elements.phone.value);
  const photo = form.elements.profilePhoto?.files?.[0];
  if (photo) d.set("profilePhoto", photo);
  return d;
}

function userEditFormData(form) {
  const d = new FormData();
  d.set("name", form.elements.name.value);
  d.set("department", form.elements.department.value);
  d.set("phone", form.elements.phone.value);
  d.set("role", form.elements.role.value);
  d.set("isActive", form.elements.isActive.value);
  if (form.elements.password?.value) d.set("password", form.elements.password.value);
  const photo = form.elements.profilePhoto?.files?.[0];
  if (photo) d.set("profilePhoto", photo);
  return d;
}

function initLogin() {
  setupPasswordToggles();
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
      $("signup-verify-form").classList.remove("hidden");
      $("signup-verify-form").elements.email.value = data.email || f.get("email");
      $("signup-phone-otp-field")?.classList.toggle("hidden", !data.requiresPhoneOtp);
      setMessage("signup-message", data.message);
      setMessage("signup-verify-message", "Enter the OTP values to activate the account.");
    } catch (err) {
      setMessage("signup-message", err.message, true);
    }
  });

  $("resend-signup-otp-btn")?.addEventListener("click", async () => {
    try {
      const email = $("signup-verify-form")?.elements.email.value;
      const data = await api("/api/auth/signup/resend-otp", {
        method: "POST",
        body: JSON.stringify({ email, channel: "all" })
      });
      $("signup-phone-otp-field")?.classList.toggle("hidden", !data.requiresPhoneOtp);
      setMessage("signup-verify-message", data.message);
    } catch (err) {
      setMessage("signup-verify-message", err.message, true);
    }
  });

  $("signup-verify-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      const data = await api("/api/auth/signup/verify", {
        method: "POST",
        body: JSON.stringify({
          email: f.get("email"),
          emailOtp: f.get("emailOtp"),
          phoneOtp: f.get("phoneOtp")
        })
      });
      saveSession(data.token, data.user);
      window.location.href = routeForRole(data.user.role);
    } catch (err) {
      setMessage("signup-verify-message", err.message, true);
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
  syncPageFilters();
  setupPasswordToggles();
  setupFilePreview('#profile-form input[name="profilePhoto"]', "profile-photo-preview");
  setupFilePreview('#user-form input[name="profilePhoto"]', "new-user-photo-preview");
  setupFilePreview('#user-edit-form input[name="profilePhoto"]', "user-edit-photo-preview");
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
      try {
        const data = await api(`/api/users/${S.user.id}`, { method: "PUT", body: profileFormData(e.currentTarget) });
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

  const loadTasks = [];
  if (S.user.role === "admin" && ($("users-list") || $("cert-user-select") || $("admin-analytics"))) loadTasks.push(loadUsers());
  if ($("certification-list") || $("summary-grid") || $("student-analytics") || $("admin-analytics") || $("notification-list") || $("calendar-list") || $("recommendation-list")) loadTasks.push(loadCerts());
  if ($("alerts-list") || (S.user.role === "admin" && $("notification-list"))) loadTasks.push(loadAlerts());
  if ($("request-list") || $("notification-list")) loadTasks.push(loadRequests());
  if ($("learning-summary-grid")) loadTasks.push(loadLearningSummary());
  if ($("course-list")) loadTasks.push(loadCourses());
  if ($("enrollment-list")) loadTasks.push(loadEnrollments());
  if ($("event-list")) loadTasks.push(loadEvents());
  const settled = await Promise.allSettled(loadTasks);
  const firstFailure = settled.find((item) => item.status === "rejected");
  if (firstFailure) {
    const message = firstFailure.reason?.message || "Some dashboard data could not load.";
    setMessage("profile-message", message, true);
    setMessage("user-message", message, true);
    setMessage("cert-message", message, true);
    setMessage("renew-message", message, true);
    setMessage("request-review-message", message, true);
  }
  renderNotifications();
  renderStudentAdvanced();
  renderAdminAdvanced();
  await initOwnerPicker();
  wireDynamic();

  $("refresh-alerts-btn")?.addEventListener("click", loadAlerts);
  $("refresh-requests-btn")?.addEventListener("click", async () => { await loadRequests(); wireDynamic(); });
  $("refresh-users-btn")?.addEventListener("click", async () => { await loadUsers(); wireDynamic(); });
  $("refresh-learning-btn")?.addEventListener("click", async () => {
    await loadLearningSummary();
    await loadCourses();
    await loadEnrollments();
    await loadEvents();
    wireDynamic();
  });
  $("export-users-btn")?.addEventListener("click", () => download("/api/exports/users", "users-export.csv"));
  $("export-certifications-btn")?.addEventListener("click", () => download("/api/exports/certifications", "certifications-export.csv"));

  $("user-search")?.addEventListener("input", async () => { S.userPagination.page = 1; await loadUsers(); wireDynamic(); });
  $("cert-search")?.addEventListener("input", async () => { S.certPagination.page = 1; await loadCerts(); wireDynamic(); });
  $("course-search")?.addEventListener("input", async () => { await loadCourses(); wireDynamic(); });
  $("enrollment-status-filter")?.addEventListener("change", async () => { await loadEnrollments(); wireDynamic(); });
  $("status-filter")?.addEventListener("change", async () => { S.certPagination.page = 1; await loadCerts(); wireDynamic(); });
  $("renewal-filter")?.addEventListener("change", async () => { S.certPagination.page = 1; await loadCerts(); wireDynamic(); });
  $("user-prev-btn")?.addEventListener("click", async () => { if (S.userPagination.page > 1) { S.userPagination.page -= 1; await loadUsers(); wireDynamic(); } });
  $("user-next-btn")?.addEventListener("click", async () => { if (S.userPagination.page < S.userPagination.totalPages) { S.userPagination.page += 1; await loadUsers(); wireDynamic(); } });
  $("cert-prev-btn")?.addEventListener("click", async () => { if (S.certPagination.page > 1) { S.certPagination.page -= 1; await loadCerts(); wireDynamic(); } });
  $("cert-next-btn")?.addEventListener("click", async () => { if (S.certPagination.page < S.certPagination.totalPages) { S.certPagination.page += 1; await loadCerts(); wireDynamic(); } });

  $("user-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const createdPassword = e.currentTarget.elements.password.value;
    try {
      const data = await api("/api/users", { method: "POST", body: userFormData(e.currentTarget) });
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
    try {
      await api(`/api/users/${e.currentTarget.elements.id.value}`, { method: "PUT", body: userEditFormData(e.currentTarget) });
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
        const selectedUserId = $("cert-user-id")?.value || $("cert-user-select")?.value || "";
        if (!selectedUserId) {
          setMessage("cert-message", "Search and select a specific user before saving the certificate.", true);
          return;
        }
        d.set("userId", selectedUserId);
        await api("/api/certifications", { method: "POST", body: d });
        setMessage("cert-message", `Certification saved successfully for ${S.selectedOwner?.name || "the selected user"}.`);
      } else {
        await api("/api/requests/add", { method: "POST", body: requestData(form) });
        setMessage("cert-message", "Certification request submitted for admin approval.");
      }
      form.reset();
      fillOwners();
      if (S.user.role === "admin") {
        $("cert-owner-search") && ($("cert-owner-search").value = "");
        S.ownerResults = [];
        setSelectedOwner(null);
      }
      S.certPagination.page = 1;
      await loadCerts();
      if ($("request-list")) await loadRequests();
      wireDynamic();
    } catch (err) {
      setMessage("cert-message", err.message, true);
    }
  });

  $("course-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    try {
      const payload = {
        title: form.elements.title.value,
        description: form.elements.description.value,
        skillCategory: form.elements.skillCategory.value,
        level: form.elements.level.value,
        durationHours: form.elements.durationHours.value,
        certificationTitle: form.elements.certificationTitle.value,
        issuer: form.elements.issuer.value,
        passingScore: form.elements.passingScore.value,
        expiryMonths: form.elements.expiryMonths.value,
        status: form.elements.status.value,
        modules: form.elements.modules.value,
        assignments: form.elements.assignments.value
      };
      await api("/api/learning/courses", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      form.reset();
      setMessage("course-message", "Course created successfully.");
      await loadCourses();
      await loadLearningSummary();
      wireDynamic();
    } catch (err) {
      setMessage("course-message", err.message, true);
    }
  });

  $("course-edit-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    try {
      const payload = {
        title: form.elements.title.value,
        description: form.elements.description.value,
        skillCategory: form.elements.skillCategory.value,
        level: form.elements.level.value,
        durationHours: form.elements.durationHours.value,
        certificationTitle: form.elements.certificationTitle.value,
        issuer: form.elements.issuer.value,
        passingScore: form.elements.passingScore.value,
        expiryMonths: form.elements.expiryMonths.value,
        status: form.elements.status.value,
        modules: form.elements.modules.value,
        assignments: form.elements.assignments.value
      };
      await api(`/api/learning/courses/${form.elements.id.value}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      $("course-modal")?.close?.();
      await loadCourses();
      await loadLearningSummary();
      wireDynamic();
    } catch (err) {
      setMessage("course-edit-message", err.message, true);
    }
  });

  $("event-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    try {
      await api("/api/events", {
        method: "POST",
        body: JSON.stringify({
          title: form.elements.title.value,
          description: form.elements.description.value,
          category: form.elements.category.value,
          mode: form.elements.mode.value,
          location: form.elements.location.value,
          startDate: form.elements.startDate.value,
          endDate: form.elements.endDate.value,
          registrationDeadline: form.elements.registrationDeadline.value,
          capacity: form.elements.capacity.value,
          status: form.elements.status.value
        })
      });
      form.reset();
      setMessage("event-message", "Event created successfully.");
      await loadEvents();
      await loadLearningSummary();
      wireDynamic();
    } catch (err) {
      setMessage("event-message", err.message, true);
    }
  });

  $("event-edit-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    try {
      await api(`/api/events/${form.elements.id.value}`, {
        method: "PUT",
        body: JSON.stringify({
          title: form.elements.title.value,
          description: form.elements.description.value,
          category: form.elements.category.value,
          mode: form.elements.mode.value,
          location: form.elements.location.value,
          startDate: form.elements.startDate.value,
          endDate: form.elements.endDate.value,
          registrationDeadline: form.elements.registrationDeadline.value,
          capacity: form.elements.capacity.value,
          status: form.elements.status.value
        })
      });
      $("event-modal")?.close?.();
      await loadEvents();
      await loadLearningSummary();
      wireDynamic();
    } catch (err) {
      setMessage("event-edit-message", err.message, true);
    }
  });

  $("progress-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    try {
      await api(`/api/learning/enrollments/${form.elements.id.value}/submit`, {
        method: "POST",
        body: JSON.stringify({
          progressPercent: form.elements.progressPercent.value,
          quizScore: form.elements.quizScore.value,
          assignmentScore: form.elements.assignmentScore.value,
          assignmentLink: form.elements.assignmentLink.value,
          assignmentNotes: form.elements.assignmentNotes.value
        })
      });
      $("progress-modal")?.close?.();
      await loadCourses();
      await loadEnrollments();
      await loadLearningSummary();
      wireDynamic();
    } catch (err) {
      setMessage("progress-message", err.message, true);
    }
  });

  $("rating-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    try {
      await api(`/api/learning/enrollments/${form.elements.id.value}/rate`, {
        method: "POST",
        body: JSON.stringify({
          stars: form.elements.stars.value
        })
      });
      $("rating-modal")?.close?.();
      await loadCourses();
      await loadEnrollments();
      wireDynamic();
    } catch (err) {
      setMessage("rating-message", err.message, true);
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
