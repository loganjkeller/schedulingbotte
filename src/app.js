import {
  createAppsScriptExample,
  fetchRemoteState,
  pingAppsScript,
  syncRemoteState,
} from "./googleAppsAdapter.js";
import { cloneState, getWeekDates, loadState, resetState, saveState } from "./data.js";

const state = {
  appData: loadState(),
  currentUserId: null,
  currentView: "schedule",
  isSyncing: false,
  lastSyncMessage: "Local demo mode active",
  filters: {
    locationId: "all",
    roleId: "all",
  },
};

const pages = {
  schedule: {
    title: "Weekly Schedule",
    subtitle: "Build the roster, review coverage, and keep each location staffed without leaving the browser.",
    roles: ["admin", "manager"],
  },
  team: {
    title: "Team Directory",
    subtitle: "Track cross-location employees, availability, labor targets, and future Botte Employees sync IDs.",
    roles: ["admin", "manager"],
  },
  templates: {
    title: "Shift Templates",
    subtitle: "Capture repeatable staffing patterns so managers can generate schedules faster across all restaurants.",
    roles: ["admin", "manager"],
  },
  settings: {
    title: "Admin Backend",
    subtitle: "Control locations, labor rules, backend connectivity, and manager permissions in one place.",
    roles: ["admin"],
  },
};

const el = {
  userSelect: document.querySelector("#userSelect"),
  navTabs: document.querySelector("#navTabs"),
  roleSummary: document.querySelector("#roleSummary"),
  pageTitle: document.querySelector("#pageTitle"),
  pageSubtitle: document.querySelector("#pageSubtitle"),
  statsGrid: document.querySelector("#statsGrid"),
  alerts: document.querySelector("#alerts"),
  viewRoot: document.querySelector("#viewRoot"),
  seedButton: document.querySelector("#seedButton"),
  exportButton: document.querySelector("#exportButton"),
};

init().catch((error) => {
  state.lastSyncMessage = `Startup fallback: ${error.message}`;
  render();
});

async function init() {
  state.currentUserId = state.appData.users[0]?.id ?? null;
  await maybeHydrateFromRemote();
  wireEvents();
  render();
}

function wireEvents() {
  el.userSelect.addEventListener("change", (event) => {
    state.currentUserId = event.target.value;
    const availablePages = getVisiblePages();
    if (!availablePages[state.currentView]) {
      state.currentView = Object.keys(availablePages)[0];
    }
    render();
  });

  el.seedButton.addEventListener("click", () => {
    state.appData = resetState();
    state.currentUserId = state.appData.users[0]?.id ?? null;
    render();
  });

  el.exportButton.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state.appData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `botte-scheduling-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  });
}

function render() {
  renderUserSelect();
  renderNav();
  renderHero();
  renderStats();
  renderAlerts();
  renderView();
}

function renderUserSelect() {
  const currentUser = getCurrentUser();
  el.userSelect.innerHTML = state.appData.users
    .map(
      (user) =>
        `<option value="${user.id}" ${user.id === state.currentUserId ? "selected" : ""}>${user.name} · ${capitalize(user.role)}</option>`
    )
    .join("");

  const managedNames = currentUser.managedLocationIds.map(getLocationName).join(", ");
  el.roleSummary.textContent = `${capitalize(currentUser.role)} access for ${managedNames}`;
}

function renderNav() {
  const visiblePages = getVisiblePages();
  el.navTabs.innerHTML = Object.entries(visiblePages)
    .map(
      ([key, page]) =>
        `<button type="button" class="nav-tab ${key === state.currentView ? "is-active" : ""}" data-page="${key}">
          <strong>${page.title}</strong><br />
          <span class="muted">${page.subtitle}</span>
        </button>`
    )
    .join("");

  el.navTabs.querySelectorAll("[data-page]").forEach((button) => {
    button.addEventListener("click", () => {
      state.currentView = button.dataset.page;
      render();
    });
  });
}

function renderHero() {
  const page = pages[state.currentView];
  el.pageTitle.textContent = page.title;
  el.pageSubtitle.textContent = page.subtitle;
}

function renderStats() {
  const user = getCurrentUser();
  const managedLocationIds = user.managedLocationIds;
  const employees = state.appData.employees.filter((employee) =>
    employee.locations.some((locationId) => managedLocationIds.includes(locationId))
  );
  const shifts = state.appData.shifts.filter((shift) => managedLocationIds.includes(shift.locationId));
  const published = shifts.filter((shift) => shift.status === "published").length;
  const draft = shifts.length - published;
  const laborHours = shifts.reduce((total, shift) => total + calculateHours(shift.start, shift.end), 0);

  const stats = [
    { label: "Managed locations", value: managedLocationIds.length, note: managedLocationIds.map(getLocationName).join(", ") },
    { label: "Scheduled employees", value: employees.length, note: "Cross-location staff included" },
    { label: "Published shifts", value: published, note: `${draft} still in draft` },
    { label: "Weekly labor hours", value: laborHours.toFixed(1), note: "Demo calculation from assigned shifts" },
  ];

  el.statsGrid.innerHTML = stats
    .map(
      (item) => `<article class="stat-card">
        <p class="muted">${item.label}</p>
        <p class="stat-value">${item.value}</p>
        <p class="kpi-note">${item.note}</p>
      </article>`
    )
    .join("");
}

function renderAlerts() {
  const alerts = buildAlerts();
  el.alerts.innerHTML = alerts
    .map(
      (alert) => `<article class="alert-card ${alert.type}">
        <strong>${alert.title}</strong>
        <p class="muted">${alert.body}</p>
      </article>`
    )
    .join("");
}

function renderView() {
  switch (state.currentView) {
    case "schedule":
      renderScheduleView();
      break;
    case "team":
      renderTeamView();
      break;
    case "templates":
      renderTemplatesView();
      break;
    case "settings":
      renderSettingsView();
      break;
    default:
      renderEmpty();
  }
}

function renderScheduleView() {
  const user = getCurrentUser();
  const weekDates = getWeekDates();
  const locationOptions = getUserLocationOptions(user);
  const roleOptions = state.appData.roles;
  const employeeOptions = state.appData.employees.filter((employee) =>
    employee.locations.some((locationId) => user.managedLocationIds.includes(locationId))
  );

  el.viewRoot.innerHTML = `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h3>Coverage board</h3>
          <p class="muted">Review staffing by day, location, and role. Managers only see their assigned restaurants.</p>
        </div>
        <button type="button" class="small-button" id="quickPublish">Publish all draft shifts in view</button>
      </div>
      <div class="filter-bar">
        <div class="form-field">
          <label for="locationFilter">Location</label>
          <select id="locationFilter">
            <option value="all">All managed locations</option>
            ${locationOptions
              .map(
                (location) =>
                  `<option value="${location.id}" ${location.id === state.filters.locationId ? "selected" : ""}>${location.name}</option>`
              )
              .join("")}
          </select>
        </div>
        <div class="form-field">
          <label for="roleFilter">Role</label>
          <select id="roleFilter">
            <option value="all">All roles</option>
            ${roleOptions
              .map((role) => `<option value="${role.id}" ${role.id === state.filters.roleId ? "selected" : ""}>${role.name}</option>`)
              .join("")}
          </select>
        </div>
      </div>
      <div class="schedule-board">
        ${weekDates.map((date) => renderDayColumn(date, user)).join("")}
      </div>
    </section>
    <section class="panel">
      <div class="panel-header">
        <div>
          <h3>Create a shift</h3>
          <p class="muted">This saves to the local demo store now, and later the same payload can post to Google Apps Script.</p>
        </div>
      </div>
      <form id="shiftForm" class="form-grid">
        <div class="form-field">
          <label for="shiftDate">Date</label>
          <select id="shiftDate">${weekDates.map((date) => `<option value="${date}">${formatDate(date).weekday} · ${date}</option>`).join("")}</select>
        </div>
        <div class="form-field">
          <label for="shiftLocation">Location</label>
          <select id="shiftLocation">${locationOptions.map((location) => `<option value="${location.id}">${location.name}</option>`).join("")}</select>
        </div>
        <div class="form-field">
          <label for="shiftEmployee">Employee</label>
          <select id="shiftEmployee">${employeeOptions.map((employee) => `<option value="${employee.id}">${employee.name}</option>`).join("")}</select>
        </div>
        <div class="form-field">
          <label for="shiftRole">Role</label>
          <select id="shiftRole">${roleOptions.map((role) => `<option value="${role.id}">${role.name}</option>`).join("")}</select>
        </div>
        <div class="form-field">
          <label for="shiftStart">Start</label>
          <input id="shiftStart" type="time" value="16:00" />
        </div>
        <div class="form-field">
          <label for="shiftEnd">End</label>
          <input id="shiftEnd" type="time" value="22:00" />
        </div>
        <div class="form-field" style="grid-column: 1 / -1;">
          <label for="shiftNotes">Notes</label>
          <textarea id="shiftNotes" placeholder="Service notes, event prep, station, or coverage details"></textarea>
        </div>
        <div class="inline-form" style="grid-column: 1 / -1;">
          <button type="submit" class="primary-button">Add shift</button>
        </div>
      </form>
    </section>
    <section class="summary-grid">
      ${renderScheduleSummaryCards(user)}
    </section>
  `;

  document.querySelector("#locationFilter").addEventListener("change", (event) => {
    state.filters.locationId = event.target.value;
    renderScheduleView();
  });

  document.querySelector("#roleFilter").addEventListener("change", (event) => {
    state.filters.roleId = event.target.value;
    renderScheduleView();
  });

  document.querySelector("#quickPublish").addEventListener("click", () => {
    const shifts = getVisibleShifts(user).map((shift) => ({
      ...shift,
      status: "published",
    }));
    state.appData.shifts = state.appData.shifts.map((existing) => shifts.find((shift) => shift.id === existing.id) ?? existing);
    saveState(state.appData);
    render();
  });

  document.querySelector("#shiftForm").addEventListener("submit", (event) => {
    event.preventDefault();

    const newShift = {
      id: `shift-${crypto.randomUUID()}`,
      date: document.querySelector("#shiftDate").value,
      locationId: document.querySelector("#shiftLocation").value,
      employeeId: document.querySelector("#shiftEmployee").value,
      roleId: document.querySelector("#shiftRole").value,
      start: document.querySelector("#shiftStart").value,
      end: document.querySelector("#shiftEnd").value,
      status: "draft",
      notes: document.querySelector("#shiftNotes").value.trim() || "Added from the scheduler workspace",
    };

    state.appData.shifts = [...state.appData.shifts, newShift];
    saveState(state.appData);
    render();
  });
}

function renderTeamView() {
  const user = getCurrentUser();
  const employees = state.appData.employees.filter((employee) =>
    employee.locations.some((locationId) => user.managedLocationIds.includes(locationId))
  );

  el.viewRoot.innerHTML = `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h3>Employee roster</h3>
          <p class="muted">Each profile includes location assignments, labor targets, availability, and Botte Employees sync IDs.</p>
        </div>
      </div>
      <div class="employees-grid">
        ${employees.map(renderEmployeeCard).join("")}
      </div>
    </section>
  `;
}

function renderTemplatesView() {
  const user = getCurrentUser();
  const templates = state.appData.templates.filter((template) =>
    template.locationIds.some((locationId) => user.managedLocationIds.includes(locationId))
  );

  el.viewRoot.innerHTML = `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h3>Reusable staffing templates</h3>
          <p class="muted">Use these to standardize lunch, dinner, event, and brunch coverage by location group.</p>
        </div>
      </div>
      <div class="templates-grid">
        ${templates
          .map(
            (template) => `<article class="summary-card">
              <p class="eyebrow">${template.demandLevel} demand</p>
              <h3>${template.name}</h3>
              <p class="muted">${template.locationIds.map(getLocationName).join(", ")}</p>
              <ul class="mini-list">${template.roles.map((role) => `<li>${role}</li>`).join("")}</ul>
            </article>`
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderSettingsView() {
  const backend = state.appData.meta.backend;

  el.viewRoot.innerHTML = `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h3>Admin configuration</h3>
          <p class="muted">This is the future real-time backend control area for locations, rules, managers, and Google Sheets connectivity.</p>
        </div>
        <button type="button" class="small-button" id="healthcheckButton">Test Apps Script endpoint</button>
      </div>
      <div class="settings-grid">
        ${state.appData.locationSettings.map(renderLocationSettingCard).join("")}
      </div>
    </section>
    <section class="panel">
      <div class="panel-header">
        <div>
          <h3>Location and manager access</h3>
          <p class="muted">Admins can add locations and review which managers control each restaurant.</p>
        </div>
      </div>
      <form id="locationForm" class="form-grid">
        <div class="form-field">
          <label for="locationName">Location name</label>
          <input id="locationName" placeholder="Upper East Side" />
        </div>
        <div class="form-field">
          <label for="locationCity">City</label>
          <input id="locationCity" placeholder="New York" />
        </div>
        <div class="form-field">
          <label for="locationTarget">Labor target</label>
          <input id="locationTarget" type="number" min="0" max="1" step="0.01" value="0.30" />
        </div>
        <div class="inline-form" style="grid-column: 1 / -1;">
          <button type="submit" class="primary-button">Add location</button>
        </div>
      </form>
      <div class="summary-grid" style="margin-top: 16px;">
        ${state.appData.users
          .filter((user) => user.role === "manager")
          .map(
            (user) => `<article class="summary-card">
              <p class="eyebrow">Manager access</p>
              <h3>${user.name}</h3>
              <p class="muted">${user.managedLocationIds.map(getLocationName).join(", ")}</p>
            </article>`
          )
          .join("")}
      </div>
    </section>
    <section class="panel">
      <div class="panel-header">
        <div>
          <h3>Backend connector</h3>
          <p class="muted">GitHub Pages can host the app UI, but Google Apps Script should own live writes to Google Sheets.</p>
        </div>
      </div>
      <div class="form-grid">
        <div class="form-field">
          <label for="backendProvider">Backend mode</label>
          <select id="backendProvider">
            <option value="localStorage" ${backend.provider === "localStorage" ? "selected" : ""}>Local demo storage</option>
            <option value="appsScript" ${backend.provider === "appsScript" ? "selected" : ""}>Google Apps Script + Sheets</option>
          </select>
        </div>
        <div class="form-field">
          <label for="appsScriptUrl">Apps Script Web App URL</label>
          <input id="appsScriptUrl" value="${backend.appsScriptUrl}" placeholder="https://script.google.com/macros/s/..." />
        </div>
        <div class="form-field">
          <label for="sheetId">Google Sheet ID</label>
          <input id="sheetId" value="${backend.sheetId}" placeholder="1abc..." />
        </div>
      </div>
      <div class="inline-form" style="margin-top: 14px;">
        <button type="button" class="primary-button" id="saveBackendButton">Save backend settings</button>
        <button type="button" class="ghost-button" id="loadRemoteButton">Load remote data</button>
        <button type="button" class="ghost-button" id="syncRemoteButton">Sync local to remote</button>
        <button type="button" class="ghost-button" id="copyPayloadButton">Copy sync payload</button>
      </div>
      <div class="summary-grid" style="margin-top: 16px;">
        <article class="summary-card">
          <p class="eyebrow">Suggested auth</p>
          <h3>Email allowlist</h3>
          <p class="muted">Store admin and manager email/role mappings in Sheets, validate in Apps Script, and return only allowed data per user.</p>
        </article>
        <article class="summary-card">
          <p class="eyebrow">Suggested integration</p>
          <h3>Botte Employees ready</h3>
          <p class="muted">Each employee already carries an external ID so the scheduler can later sync profiles, PTO, and shift confirmations.</p>
        </article>
        <article class="summary-card">
          <p class="eyebrow">Apps Script starter</p>
          <h3>Server example</h3>
          <pre class="muted">${escapeHtml(createAppsScriptExample())}</pre>
        </article>
      </div>
    </section>
  `;

  document.querySelector("#saveBackendButton").addEventListener("click", () => {
    state.appData.meta.backend.appsScriptUrl = document.querySelector("#appsScriptUrl").value.trim();
    state.appData.meta.backend.sheetId = document.querySelector("#sheetId").value.trim();
    state.appData.meta.backend.provider = document.querySelector("#backendProvider").value;
    saveState(state.appData);
    state.lastSyncMessage = `Saved backend mode: ${state.appData.meta.backend.provider}`;
    render();
  });

  document.querySelector("#copyPayloadButton").addEventListener("click", async () => {
    await navigator.clipboard.writeText(JSON.stringify(createSyncPayload(), null, 2));
  });

  document.querySelector("#healthcheckButton").addEventListener("click", async () => {
    const url = document.querySelector("#appsScriptUrl").value.trim();
    if (!url) {
      window.alert("Add your Apps Script URL first.");
      return;
    }

    try {
      const result = await pingAppsScript(url);
      window.alert(`Apps Script is reachable: ${JSON.stringify(result)}`);
    } catch (error) {
      window.alert(`Healthcheck failed: ${error.message}`);
    }
  });

  document.querySelector("#loadRemoteButton").addEventListener("click", async () => {
    await loadFromRemote();
  });

  document.querySelector("#syncRemoteButton").addEventListener("click", async () => {
    await pushToRemote();
  });

  document.querySelector("#locationForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const locationName = document.querySelector("#locationName").value.trim();
    const locationCity = document.querySelector("#locationCity").value.trim();
    const laborTarget = Number(document.querySelector("#locationTarget").value);

    if (!locationName || !locationCity || Number.isNaN(laborTarget)) {
      window.alert("Fill in the location details first.");
      return;
    }

    const slug = slugify(locationName);
    const locationId = `loc-${slug}`;

    state.appData.locations = [
      ...state.appData.locations,
      {
        id: locationId,
        name: locationName,
        city: locationCity,
        timezone: "America/New_York",
        laborTarget,
      },
    ];

    state.appData.locationSettings = [
      ...state.appData.locationSettings,
      {
        locationId,
        weekStartsOn: "Monday",
        publishCutoffHours: 48,
        overtimeWarningHours: 40,
        approvalRequired: true,
      },
    ];

    state.appData.users = state.appData.users.map((user) =>
      user.role === "admin"
        ? { ...user, managedLocationIds: [...new Set([...user.managedLocationIds, locationId])] }
        : user
    );

    saveState(state.appData);
    render();
  });
}

function renderLocationSettingCard(setting) {
  const location = state.appData.locations.find((item) => item.id === setting.locationId);
  return `<article class="settings-card">
    <p class="eyebrow">${location.city}</p>
    <h3>${location.name}</h3>
    <div class="pill-row">
      <span class="pill accent">Week starts ${setting.weekStartsOn}</span>
      <span class="pill">Publish ${setting.publishCutoffHours}h before</span>
      <span class="pill warning">OT warning ${setting.overtimeWarningHours}h</span>
    </div>
    <p class="kpi-note">Labor target ${(location.laborTarget * 100).toFixed(0)}% · Approval ${setting.approvalRequired ? "required" : "optional"}</p>
  </article>`;
}

function renderScheduleSummaryCards(user) {
  const shifts = getVisibleShifts(user);
  const perLocation = user.managedLocationIds.map((locationId) => {
    const locationShifts = shifts.filter((shift) => shift.locationId === locationId);
    const hours = locationShifts.reduce((total, shift) => total + calculateHours(shift.start, shift.end), 0);
    return `<article class="summary-card">
      <p class="eyebrow">${getLocationName(locationId)}</p>
      <h3>${locationShifts.length} shifts</h3>
      <p class="muted">${hours.toFixed(1)} labor hours this week</p>
    </article>`;
  });

  return perLocation.join("");
}

function renderDayColumn(date, user) {
  const shifts = getVisibleShifts(user).filter((shift) => shift.date === date);
  const label = formatDate(date);
  const totalHours = shifts.reduce((total, shift) => total + calculateHours(shift.start, shift.end), 0);

  return `<article class="schedule-card">
    <header>
      <h3>${label.weekday}</h3>
      <p class="muted">${label.fullDate}</p>
      <div class="badge-row">
        <span class="badge">${shifts.length} shifts</span>
        <span class="badge">${totalHours.toFixed(1)} hours</span>
      </div>
    </header>
    <div class="shift-stack">
      ${shifts.length ? shifts.map(renderShiftCard).join("") : `<p class="muted">No shifts assigned.</p>`}
    </div>
  </article>`;
}

function renderShiftCard(shift) {
  const employee = state.appData.employees.find((item) => item.id === shift.employeeId);
  const role = state.appData.roles.find((item) => item.id === shift.roleId);
  return `<article class="shift-card">
    <strong>${employee.name}</strong>
    <p class="muted">${getLocationName(shift.locationId)} · ${role.name}</p>
    <div class="pill-row">
      <span class="pill">${shift.start} - ${shift.end}</span>
      <span class="pill ${shift.status === "draft" ? "warning" : "accent"}">${capitalize(shift.status)}</span>
    </div>
    <p class="kpi-note">${shift.notes}</p>
  </article>`;
}

function renderEmployeeCard(employee) {
  const role = state.appData.roles.find((item) => item.id === employee.roleId);
  return `<article class="employee-card">
    <p class="eyebrow">${role.name}</p>
    <h4>${employee.name}</h4>
    <p class="muted">${employee.locations.map(getLocationName).join(", ")}</p>
    <div class="tag-row">
      <span class="tag">$${employee.hourlyRate}/hr</span>
      <span class="tag">${employee.weeklyHoursTarget}h target</span>
      <span class="tag">${employee.externalEmployeeId}</span>
    </div>
    <p class="kpi-note">Availability: ${employee.availability.join(", ")}</p>
    <div class="tag-row">
      ${employee.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}
    </div>
  </article>`;
}

function renderEmpty() {
  const template = document.querySelector("#emptyStateTemplate");
  el.viewRoot.innerHTML = "";
  el.viewRoot.append(template.content.cloneNode(true));
}

function buildAlerts() {
  const user = getCurrentUser();
  const visibleShifts = getVisibleShifts(user);
  const draftCount = visibleShifts.filter((shift) => shift.status === "draft").length;
  const unassignedLocations = user.managedLocationIds.filter(
    (locationId) => !visibleShifts.some((shift) => shift.locationId === locationId)
  );

  const alerts = [];

  if (draftCount) {
    alerts.push({
      type: "warning",
      title: `${draftCount} shifts are still drafts`,
      body: "Use the publish action once your managers finish reviewing labor coverage and staffing notes.",
    });
  }

  if (unassignedLocations.length) {
    alerts.push({
      type: "warning",
      title: "Some managed locations have no shifts this week",
      body: `${unassignedLocations.map(getLocationName).join(", ")} still need schedule coverage.`,
    });
  }

  alerts.push({
    type: "success",
    title: "Botte Employees integration path is already modeled",
    body: "Employee records include external IDs so we can later sync people, PTO balances, and confirmations from your other app.",
  });

  alerts.push({
    type: "success",
    title: "Backend status",
    body: state.lastSyncMessage,
  });

  return alerts;
}

function getVisiblePages() {
  const user = getCurrentUser();
  return Object.fromEntries(Object.entries(pages).filter(([, page]) => page.roles.includes(user.role)));
}

function getVisibleShifts(user) {
  return state.appData.shifts.filter((shift) => {
    const inManagedLocation = user.managedLocationIds.includes(shift.locationId);
    const locationMatch = state.filters.locationId === "all" || shift.locationId === state.filters.locationId;
    const roleMatch = state.filters.roleId === "all" || shift.roleId === state.filters.roleId;
    return inManagedLocation && locationMatch && roleMatch;
  });
}

function getCurrentUser() {
  return state.appData.users.find((user) => user.id === state.currentUserId) ?? state.appData.users[0];
}

function getUserLocationOptions(user) {
  return state.appData.locations.filter((location) => user.managedLocationIds.includes(location.id));
}

function getLocationName(locationId) {
  return state.appData.locations.find((location) => location.id === locationId)?.name ?? locationId;
}

function calculateHours(start, end) {
  const [startHours, startMinutes] = start.split(":").map(Number);
  const [endHours, endMinutes] = end.split(":").map(Number);
  let total = endHours + endMinutes / 60 - (startHours + startMinutes / 60);
  if (total < 0) {
    total += 24;
  }
  return total;
}

function formatDate(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  return {
    weekday: new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(date),
    fullDate: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date),
  };
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function maybeHydrateFromRemote() {
  const backend = state.appData.meta.backend;
  const currentUser = getCurrentUser();

  if (backend.provider !== "appsScript" || !backend.appsScriptUrl || !currentUser?.email) {
    return;
  }

  const remoteData = await fetchRemoteState(backend.appsScriptUrl, currentUser.email);
  state.appData = mergeBackendConfig(remoteData, backend);
  saveState(state.appData);
  state.currentUserId = state.appData.users.find((user) => user.email === currentUser.email)?.id ?? state.appData.users[0]?.id ?? null;
  state.lastSyncMessage = `Loaded remote data for ${currentUser.email}`;
}

async function loadFromRemote() {
  const backend = state.appData.meta.backend;
  const currentUser = getCurrentUser();

  if (!backend.appsScriptUrl) {
    window.alert("Add your Apps Script URL first.");
    return;
  }

  if (!currentUser?.email) {
    window.alert("Current user is missing an email.");
    return;
  }

  state.isSyncing = true;
  renderAlerts();

  try {
    const remoteData = await fetchRemoteState(backend.appsScriptUrl, currentUser.email);
    state.appData = mergeBackendConfig(remoteData, backend);
    saveState(state.appData);
    state.currentUserId = state.appData.users.find((user) => user.email === currentUser.email)?.id ?? state.appData.users[0]?.id ?? null;
    state.lastSyncMessage = `Loaded remote data for ${currentUser.email}`;
    render();
  } catch (error) {
    state.lastSyncMessage = `Remote load failed: ${error.message}`;
    renderAlerts();
  } finally {
    state.isSyncing = false;
  }
}

async function pushToRemote() {
  const backend = state.appData.meta.backend;
  const currentUser = getCurrentUser();

  if (!backend.appsScriptUrl) {
    window.alert("Add your Apps Script URL first.");
    return;
  }

  if (!currentUser?.email) {
    window.alert("Current user is missing an email.");
    return;
  }

  state.isSyncing = true;
  renderAlerts();

  try {
    await syncRemoteState(backend.appsScriptUrl, state.appData, currentUser.email);
    state.lastSyncMessage = `Synced local data to Google Apps Script as ${currentUser.email}`;
    renderAlerts();
  } catch (error) {
    state.lastSyncMessage = `Remote sync failed: ${error.message}`;
    renderAlerts();
  } finally {
    state.isSyncing = false;
  }
}

function mergeBackendConfig(remoteData, backend) {
  const next = cloneState(remoteData);
  next.meta = next.meta || {};
  next.meta.backend = {
    provider: backend.provider,
    appsScriptUrl: backend.appsScriptUrl,
    sheetId: backend.sheetId,
  };
  return next;
}

function createSyncPayload() {
  const cloned = cloneState(state.appData);
  return {
    action: "syncAll",
    userEmail: getCurrentUser()?.email ?? "",
    payload: {
      meta: cloned.meta,
      locations: cloned.locations,
      roles: cloned.roles,
      employees: cloned.employees,
      shifts: cloned.shifts,
      templates: cloned.templates,
      locationSettings: cloned.locationSettings,
      users: cloned.users,
    },
  };
}
