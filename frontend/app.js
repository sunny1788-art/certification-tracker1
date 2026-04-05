const state = {
  session: JSON.parse(localStorage.getItem("skilltrack-session") || "null"),
  users: [],
  certifications: [],
  summary: null
};

const page = document.body.dataset.page;

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json"
    },
    ...options
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Request failed.");
  }

  return data;
}

function setMessage(elementId, text, isError = false) {
  const element = document.getElementById(elementId);
  if (!element) {
    return;
  }

  element.textContent = text;
  element.style.color = isError ? "#ffb3b3" : "#9ff8d3";
}

function requireSession() {
  if (!state.session && page === "dashboard") {
    window.location.href = "/login";
  }
}

async function initLogin() {
  const form = document.getElementById("login-form");
  if (!form) {
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);

    try {
      const payload = {
        email: formData.get("email"),
        password: formData.get("password")
      };

      const data = await request("/api/login", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      state.session = data.user;
      state.users = data.availableUsers || [];
      localStorage.setItem("skilltrack-session", JSON.stringify(data.user));
      window.location.href = "/dashboard";
    } catch (error) {
      setMessage("login-message", error.message, true);
    }
  });
}

function getScopedUserOptions() {
  if (!state.session) {
    return [];
  }

  if (state.session.role === "admin") {
    return state.users;
  }

  return [state.session];
}

async function loadUsers() {
  const data = await request("/api/users");
  state.users = data.users.filter((user) => user.role === "user");
}

function renderSummary() {
  const grid = document.getElementById("summary-grid");
  if (!grid || !state.summary) {
    return;
  }

  const cards = [
    ["Total Certifications", state.summary.total],
    ["Active", state.summary.active],
    ["Expiring Soon", state.summary.expiringSoon],
    ["Expired", state.summary.expired],
    ["Renewals In Progress", state.summary.renewalsInProgress]
  ];

  grid.innerHTML = cards
    .map(
      ([label, value]) => `
        <article class="summary-card">
          <span>${label}</span>
          <strong>${value}</strong>
        </article>
      `
    )
    .join("");
}

function renderCertifications() {
  const list = document.getElementById("certification-list");
  const template = document.getElementById("certification-card-template");

  if (!list || !template) {
    return;
  }

  list.innerHTML = "";

  if (!state.certifications.length) {
    list.innerHTML = '<p class="empty-state">No certifications found for this filter.</p>';
    return;
  }

  state.certifications.forEach((certification) => {
    const node = template.content.cloneNode(true);
    const card = node.querySelector(".cert-card");
    const title = node.querySelector("h3");
    const owner = node.querySelector(".cert-owner");
    const provider = node.querySelector(".provider");
    const status = node.querySelector(".status-pill");
    const metrics = node.querySelector(".cert-metrics");
    const notes = node.querySelector(".notes");
    const links = node.querySelector(".cert-links");
    const renewForm = node.querySelector(".renew-form");

    title.textContent = certification.title;
    owner.textContent = certification.userName;
    provider.textContent = `${certification.provider} - Issued ${certification.issueDate} - Expires ${certification.expiryDate}`;
    status.textContent = certification.status;
    status.dataset.status = certification.status;
    metrics.innerHTML = `
      <span>${certification.daysRemaining} days remaining</span>
      <span>Renewal: ${certification.renewalStatus}</span>
      <span>Reminder: ${certification.reminderDays} days</span>
      <span>Code: ${certification.certificateCode}</span>
    `;
    notes.textContent = certification.notes || "No notes added.";
    links.innerHTML = certification.certificateUrl
      ? `<a href="${certification.certificateUrl}" target="_blank" rel="noreferrer">Open certificate</a>`
      : "<span>No certificate link available.</span>";

    renewForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(renewForm);

      try {
        await request(`/api/certifications/${certification.id}/renew`, {
          method: "POST",
          body: JSON.stringify({
            expiryDate: formData.get("expiryDate"),
            notes: formData.get("notes"),
            renewalStatus: "Renewed"
          })
        });

        await loadDashboardData();
      } catch (error) {
        alert(error.message);
      }
    });

    if (state.session.role !== "admin" && certification.status === "Active") {
      renewForm.classList.add("hidden");
    }

    list.appendChild(card);
  });
}

function populateFormUsers() {
  const select = document.querySelector('select[name="userId"]');
  const label = document.getElementById("user-select-label");

  if (!select || !state.session) {
    return;
  }

  const options = getScopedUserOptions();
  select.innerHTML = options
    .map((user) => `<option value="${user.id}" data-name="${user.name}">${user.name}</option>`)
    .join("");

  if (state.session.role === "user") {
    select.value = state.session.id;
    select.setAttribute("disabled", "disabled");
    label.classList.add("disabled-field");
  } else {
    select.removeAttribute("disabled");
    label.classList.remove("disabled-field");
  }
}

async function loadDashboardData() {
  const status = document.getElementById("status-filter")?.value || "All";
  const query = new URLSearchParams({
    role: state.session.role,
    userId: state.session.role === "user" ? state.session.id : "",
    status
  });

  const data = await request(`/api/certifications?${query.toString()}`);
  state.certifications = data.certifications;
  state.summary = data.summary;
  renderSummary();
  renderCertifications();
}

async function initDashboard() {
  requireSession();
  if (!state.session) {
    return;
  }

  document.getElementById("dashboard-title").textContent =
    state.session.role === "admin"
      ? `Admin Console for ${state.session.name}`
      : `${state.session.name}'s Certification Dashboard`;

  document.getElementById("session-badge").textContent =
    `${state.session.role.toUpperCase()} - ${state.session.department}`;

  await loadUsers();
  populateFormUsers();
  await loadDashboardData();

  document.getElementById("status-filter").addEventListener("change", loadDashboardData);

  document.getElementById("logout-btn").addEventListener("click", () => {
    localStorage.removeItem("skilltrack-session");
    window.location.href = "/login";
  });

  document.getElementById("cert-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const selectedOption = form.querySelector('select[name="userId"] option:checked');

    try {
      const payload = {
        userId: state.session.role === "user" ? state.session.id : formData.get("userId"),
        userName: state.session.role === "user" ? state.session.name : selectedOption.dataset.name,
        title: formData.get("title"),
        provider: formData.get("provider"),
        issueDate: formData.get("issueDate"),
        expiryDate: formData.get("expiryDate"),
        renewalStatus: formData.get("renewalStatus"),
        reminderDays: formData.get("reminderDays"),
        certificateCode: formData.get("certificateCode"),
        certificateUrl: formData.get("certificateUrl"),
        notes: formData.get("notes")
      };

      await request("/api/certifications", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      form.reset();
      populateFormUsers();
      setMessage("form-message", "Certification saved successfully.");
      await loadDashboardData();
    } catch (error) {
      setMessage("form-message", error.message, true);
    }
  });
}

if (page === "login") {
  initLogin();
}

if (page === "dashboard") {
  initDashboard();
}
