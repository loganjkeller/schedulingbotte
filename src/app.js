import {
  authenticateRemoteUser,
  createAppsScriptExample,
  fetchRemoteState,
  pingAppsScript,
  syncRemoteState,
} from "./googleAppsAdapter.js";
import { cloneState, getWeekDates, loadState, saveState } from "./data.js";

const SESSION_KEY = "botte-scheduling-session-v1";

const state = {
  appData: loadState(),
  session: loadSession(),
  currentUserId: null,
  currentView: "dashboard",
  weekStartDate: getWeekDates()[0],
  lastSyncMessage: "",
  filters: {
    locationId: "all",
    roleId: "all",
  },
};

const pages = {
  dashboard: {
    title: "Dashboard",
    subtitle: "See today’s staffing picture, open requests, and labor pressure in one place.",
    roles: ["admin", "manager", "employee"],
  },
  schedule: {
    title: "Scheduling",
    subtitle: "Build the week, copy last week, publish shifts, and keep each location covered.",
    roles: ["admin", "manager"],
  },
  people: {
    title: "Team Management",
    subtitle: "Add or remove employees, update profiles and positions, and manage location assignments.",
    roles: ["admin", "manager"],
  },
  requests: {
    title: "Requests",
    subtitle: "Track time-off, availability changes, and employee messages to managers and admin.",
    roles: ["admin", "manager", "employee"],
  },
  profile: {
    title: "My Profile",
    subtitle: "Review your details, upcoming shifts, and update profile information.",
    roles: ["employee"],
  },
  settings: {
    title: "Admin Backend",
    subtitle: "Control permissions, locations, and Google Sheets connection settings.",
    roles: ["admin"],
  },
};

const el = {
  accessGate: document.querySelector("#accessGate"),
  appShell: document.querySelector(".app-shell"),
  accountName: document.querySelector("#accountName"),
  navTabs: document.querySelector("#navTabs"),
  roleSummary: document.querySelector("#roleSummary"),
  pageTitle: document.querySelector("#pageTitle"),
  pageSubtitle: document.querySelector("#pageSubtitle"),
  statsGrid: document.querySelector("#statsGrid"),
  alerts: document.querySelector("#alerts"),
  viewRoot: document.querySelector("#viewRoot"),
  logoutButton: document.querySelector("#logoutButton"),
};

init().catch((error) => {
  state.lastSyncMessage = `Startup fallback: ${error.message}`;
  render();
});

async function init() {
  state.currentUserId = state.session?.userId ?? null;
  await maybeHydrateFromRemoteWithSession();
  wireEvents();
  render();
}

function wireEvents() {
  el.logoutButton.addEventListener("click", () => {
    clearSession();
    render();
  });
}

function render() {
  if (!state.session) {
    renderAccessGate();
    return;
  }
  showAppShell();
  ensureVisibleView();
  renderAccountSummary();
  renderNav();
  renderHero();
  renderStats();
  renderAlerts();
  renderView();
}

function ensureVisibleView() {
  const visiblePages = getVisiblePages();
  if (!visiblePages[state.currentView]) {
    state.currentView = Object.keys(visiblePages)[0];
  }
}

function renderAccountSummary() {
  const currentUser = getCurrentUser();
  el.accountName.textContent = currentUser.name;
  const scope = currentUser.role === "employee"
    ? getEmployeeByUser(currentUser)?.locations.map(getLocationName).join(", ") || "No locations"
    : currentUser.managedLocationIds.map(getLocationName).join(", ");
  el.roleSummary.textContent = `${capitalize(currentUser.role)} access · ${scope}`;
}

function renderAccessGate() {
  hideAppShell();
  el.accessGate.innerHTML = `
    <div class="access-card">
      <div class="access-brand">
        <div class="access-logo">B</div>
        <div>
          <p class="eyebrow">Botte access</p>
          <h1>Botte Scheduling</h1>
        </div>
      </div>
      <p class="access-title">Enter with last name and PIN</p>
      <form id="accessForm" class="access-form">
        <div class="form-field">
          <label for="accessLastName">Last name</label>
          <input id="accessLastName" autocomplete="family-name" placeholder="Romano" />
        </div>
        <div class="form-field">
          <label for="accessPin">PIN</label>
          <input id="accessPin" type="password" inputmode="numeric" placeholder="••••" />
        </div>
        <button type="submit" class="primary-button access-submit">Access workspace</button>
      </form>
      <div class="access-inline-help">
        <span class="muted">Need help?</span>
        <button type="button" class="help-button" data-help="Use the last name and PIN assigned to you by admin. Your role and access level are set automatically after login.">?</button>
      </div>
      <p id="accessMessage" class="access-message">${escapeHtml(state.lastSyncMessage || "")}</p>
    </div>
  `;

  document.querySelector("#accessForm").addEventListener("submit", handleAccessLogin);
  bindHelpButtons();
}

function showAppShell() {
  el.accessGate.style.display = "none";
  el.appShell.style.display = "grid";
}

function hideAppShell() {
  el.accessGate.style.display = "grid";
  el.appShell.style.display = "none";
}

function renderNav() {
  const visiblePages = getVisiblePages();
  el.navTabs.innerHTML = Object.entries(visiblePages)
    .map(
      ([key, page]) =>
        `<button type="button" class="nav-tab ${key === state.currentView ? "is-active" : ""}" data-page="${key}">
          <strong>${page.title}</strong>
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
  const stats = buildStatsForUser(getCurrentUser());
  el.statsGrid.innerHTML = stats
    .map(
      (item) => `<article class="stat-card">
        <p class="stat-label">${item.label}</p>
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
    case "dashboard":
      renderDashboardView();
      break;
    case "schedule":
      renderScheduleView();
      break;
    case "people":
      renderPeopleView();
      break;
    case "requests":
      renderRequestsView();
      break;
    case "profile":
      renderProfileView();
      break;
    case "settings":
      renderSettingsView();
      break;
    default:
      renderEmpty();
  }
}

function renderDashboardView() {
  const user = getCurrentUser();

  if (user.role === "employee") {
    const employee = getEmployeeByUser(user);
    const upcomingShifts = getEmployeeShifts(employee.id).slice(0, 4);
    const requests = getEmployeeRequests(employee.id);
    el.viewRoot.innerHTML = `
      <section class="panel">
        <div class="panel-header">
          <div>
            <h3>My week</h3>
            <p class="muted">A simple view of where you work, when you work, and what still needs approval.</p>
          </div>
          ${renderHelpButton("Employees can review upcoming shifts, track requests, and update their profile without needing manager access.")}
        </div>
        <div class="summary-grid">
          <article class="summary-card">
            <p class="eyebrow">Primary position</p>
            <h3>${getRoleName(employee.roleId)}</h3>
            <p class="muted">${employee.locations.map(getLocationName).join(", ")}</p>
          </article>
          <article class="summary-card">
            <p class="eyebrow">Upcoming shifts</p>
            <h3>${upcomingShifts.length}</h3>
            <p class="muted">${upcomingShifts.length ? "Scheduled this week" : "No shifts scheduled yet"}</p>
          </article>
          <article class="summary-card">
            <p class="eyebrow">Open requests</p>
            <h3>${requests.filter((item) => item.status === "pending").length}</h3>
            <p class="muted">Pending manager or admin review</p>
          </article>
        </div>
      </section>
      <section class="panel">
        <div class="panel-header">
          <div>
            <h3>Upcoming shifts</h3>
            <p class="muted">Your next scheduled shifts and notes.</p>
          </div>
        </div>
        <div class="list-grid">
          ${upcomingShifts.map(renderEmployeeShiftCard).join("") || renderInlineEmpty("No upcoming shifts yet.")}
        </div>
      </section>
    `;
    bindHelpButtons();
    return;
  }

  const visibleEmployees = getScopedEmployees(user);
  const visibleShifts = getScopedShifts(user);
  const pendingRequests = getScopedRequests(user).filter((request) => request.status === "pending");
  const todaysShifts = visibleShifts
    .filter((shift) => getWeekDates(state.weekStartDate).includes(shift.date))
    .slice(0, 6);
  const locationCards = getScopedLocations(user)
    .map((location) => {
      const locationShifts = visibleShifts.filter((shift) => shift.locationId === location.id);
      const hours = locationShifts.reduce((total, shift) => total + calculateHours(shift.start, shift.end), 0);
      return `<article class="summary-card">
        <h3>${location.name}</h3>
        <p class="muted">${locationShifts.length} shifts</p>
        <p class="kpi-note">${hours.toFixed(1)} hours</p>
      </article>`;
    })
    .join("");

  el.viewRoot.innerHTML = `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h3>Overview</h3>
        </div>
        ${renderHelpButton("Managers can see only their locations. Admin sees everything. Use this page to quickly spot staffing gaps and pending employee requests.")}
      </div>
      <div class="summary-grid">
        ${locationCards}
      </div>
    </section>
    <section class="dual-grid">
      <article class="panel">
        <div class="panel-header">
          <div>
            <h3>Pending requests</h3>
          </div>
        </div>
        <div class="list-grid">
          ${pendingRequests.slice(0, 4).map(renderRequestCard).join("") || renderInlineEmpty("No pending requests.")}
        </div>
      </article>
      <article class="panel">
        <div class="panel-header">
          <div>
            <h3>This week</h3>
          </div>
        </div>
        <div class="list-grid compact-list">
          ${todaysShifts.length
            ? todaysShifts.map((shift) => {
                const employee = getEmployee(shift.employeeId);
                return `<article class="list-card">
                  <strong>${employee?.name || "Unknown"}</strong>
                  <p class="muted">${getLocationName(shift.locationId)} · ${shift.start} - ${shift.end}</p>
                </article>`;
              }).join("")
            : visibleEmployees.slice(0, 4).map(renderEmployeeListCard).join("")}
        </div>
      </article>
    </section>
  `;
  bindHelpButtons();
}

function renderScheduleView() {
  const user = getCurrentUser();
  const weekDates = getWeekDates(state.weekStartDate);
  const locationOptions = getScopedLocations(user);
  if (state.filters.locationId === "all" && locationOptions[0]) {
    state.filters.locationId = locationOptions[0].id;
  }
  const activeLocationId = state.filters.locationId === "all" ? locationOptions[0]?.id : state.filters.locationId;
  const activeLocationSetting = state.appData.locationSettings.find((item) => item.locationId === activeLocationId);
  const employeeOptions = getScopedEmployees(user).filter((employee) =>
    activeLocationId ? employee.locations.includes(activeLocationId) : true
  );

  el.viewRoot.innerHTML = `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h3>Weekly planner</h3>
          <p class="muted">${formatWeekRange(weekDates[0], weekDates[6])}</p>
        </div>
        <div class="action-row">
          ${renderHelpButton("Pick a location, then drag an employee card into any day column. Their availability and pending requests stay visible while you schedule.")}
          <button type="button" class="ghost-button" id="prevWeekButton">Previous week</button>
          <button type="button" class="ghost-button" id="nextWeekButton">Next week</button>
          <button type="button" class="small-button" id="copyWeekButton">Copy last week</button>
          <button type="button" class="small-button" id="quickPublish">Publish visible drafts</button>
        </div>
      </div>
      <div class="filter-bar">
        <div class="form-field">
          <label for="locationFilter">Location</label>
          <select id="locationFilter">
            ${locationOptions.map(renderLocationOption).join("")}
          </select>
        </div>
        <div class="form-field">
          <label for="roleFilter">Position</label>
          <select id="roleFilter">
            <option value="all">All positions</option>
            ${state.appData.roles.map(renderRoleOption).join("")}
          </select>
        </div>
      </div>
      <div class="service-strip">
        <span class="service-pill">Lunch ${activeLocationSetting?.lunchOpen || "--:--"} - ${activeLocationSetting?.lunchClose || "--:--"}</span>
        <span class="service-pill">Dinner ${activeLocationSetting?.dinnerOpen || "--:--"} - ${activeLocationSetting?.dinnerClose || "--:--"}</span>
      </div>
      <div class="schedule-layout">
        <aside class="employee-bank">
          <div class="panel-header compact-header">
            <div>
              <h3>Available staff</h3>
            </div>
            ${renderHelpButton("Each card shows position, assigned hours, permanent availability, and pending requests. Drag a card into a day to create a draft shift.")}
          </div>
          <div class="staff-list">
            ${employeeOptions.map((employee) => renderStaffPlannerCard(employee, activeLocationId)).join("") || renderInlineEmpty("No employees for this location.")}
          </div>
        </aside>
        <div class="schedule-board">
          ${weekDates.map((date) => renderDayColumn(date, user, activeLocationId)).join("")}
        </div>
      </div>
    </section>
  `;

  document.querySelector("#locationFilter").value = activeLocationId;
  document.querySelector("#roleFilter").value = state.filters.roleId;
  document.querySelector("#locationFilter").addEventListener("change", (event) => {
    state.filters.locationId = event.target.value;
    renderScheduleView();
  });
  document.querySelector("#roleFilter").addEventListener("change", (event) => {
    state.filters.roleId = event.target.value;
    renderScheduleView();
  });
  document.querySelector("#quickPublish").addEventListener("click", publishVisibleShifts);
  document.querySelector("#copyWeekButton").addEventListener("click", copyLastWeek);
  document.querySelector("#prevWeekButton").addEventListener("click", () => {
    state.weekStartDate = addDaysToIso(state.weekStartDate, -7);
    renderScheduleView();
  });
  document.querySelector("#nextWeekButton").addEventListener("click", () => {
    state.weekStartDate = addDaysToIso(state.weekStartDate, 7);
    renderScheduleView();
  });
  document.querySelectorAll("[draggable='true']").forEach((card) => {
    card.addEventListener("dragstart", handleEmployeeDragStart);
  });
  document.querySelectorAll("[data-drop-date]").forEach((zone) => {
    zone.addEventListener("dragover", (event) => event.preventDefault());
    zone.addEventListener("drop", handleScheduleDrop);
  });
  bindHelpButtons();
}

function renderPeopleView() {
  const user = getCurrentUser();
  const employees = getScopedEmployees(user);

  el.viewRoot.innerHTML = `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h3>Employee management</h3>
          <p class="muted">Managers can add or remove employees, update profiles, and assign positions by location.</p>
        </div>
        ${renderHelpButton("Managers can only edit employees in their own locations. Admin can manage everybody.")}
      </div>
      <div class="employees-grid">
        ${employees.map(renderEmployeeManagerCard).join("")}
      </div>
    </section>
    <section class="panel">
      <div class="panel-header">
        <div>
          <h3>Add employee</h3>
          <p class="muted">Create a new team member and assign them to one or more restaurants.</p>
        </div>
      </div>
      <form id="employeeForm" class="form-grid">
        <div class="form-field">
          <label for="employeeName">Name</label>
          <input id="employeeName" placeholder="New employee name" />
        </div>
        <div class="form-field">
          <label for="employeeEmail">Email</label>
          <input id="employeeEmail" placeholder="employee@botte.com" />
        </div>
        <div class="form-field">
          <label for="employeeRole">Position</label>
          <select id="employeeRole">${state.appData.roles.map((role) => `<option value="${role.id}">${role.name}</option>`).join("")}</select>
        </div>
        <div class="form-field">
          <label for="employeeLocation">Primary location</label>
          <select id="employeeLocation">${getScopedLocations(user).map((location) => `<option value="${location.id}">${location.name}</option>`).join("")}</select>
        </div>
        <div class="form-field">
          <label for="employeeRate">Hourly rate</label>
          <input id="employeeRate" type="number" min="0" step="1" value="18" />
        </div>
        <div class="form-field">
          <label for="employeeTargetHours">Weekly target</label>
          <input id="employeeTargetHours" type="number" min="0" step="1" value="32" />
        </div>
        <div class="inline-form full-span">
          <button type="submit" class="primary-button">Add employee</button>
        </div>
      </form>
    </section>
  `;

  document.querySelectorAll("[data-action='delete-employee']").forEach((button) => {
    button.addEventListener("click", () => deleteEmployee(button.dataset.id));
  });
  document.querySelectorAll("[data-action='edit-employee']").forEach((button) => {
    button.addEventListener("click", () => openEmployeeEdit(button.dataset.id));
  });
  document.querySelector("#employeeForm").addEventListener("submit", handleCreateEmployee);
  bindHelpButtons();
}

function renderRequestsView() {
  const user = getCurrentUser();
  const visibleRequests = getScopedRequests(user);
  const requestOptions = user.role === "employee"
    ? `
      <option value="time_off">Time off</option>
      <option value="availability_change">Availability change</option>
      <option value="message">Message to manager/admin</option>
    `
    : `
      <option value="time_off">Time off</option>
      <option value="availability_change">Availability change</option>
      <option value="message">Message</option>
    `;

  el.viewRoot.innerHTML = `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h3>${user.role === "employee" ? "Send a request" : "Request inbox"}</h3>
          <p class="muted">${user.role === "employee" ? "Ask for time off, update your availability, or send a note to your managers." : "Review incoming employee requests and approve or decline them."}</p>
        </div>
        ${renderHelpButton("Availability change can be temporary for a date range or permanent. Messages are a lightweight way for employees to contact managers or admin.")}
      </div>
      ${user.role === "employee" ? renderEmployeeRequestForm() : ""}
      <div class="list-grid">
        ${visibleRequests.map(renderRequestCard).join("") || renderInlineEmpty("No requests found.")}
      </div>
    </section>
  `;

  if (user.role === "employee") {
    document.querySelector("#requestForm").addEventListener("submit", handleCreateRequest);
  } else {
    document.querySelectorAll("[data-action='approve-request']").forEach((button) => {
      button.addEventListener("click", () => updateRequestStatus(button.dataset.id, "approved"));
    });
    document.querySelectorAll("[data-action='decline-request']").forEach((button) => {
      button.addEventListener("click", () => updateRequestStatus(button.dataset.id, "declined"));
    });
  }
  bindHelpButtons();
}

function renderProfileView() {
  const user = getCurrentUser();
  const employee = getEmployeeByUser(user);
  const shifts = getEmployeeShifts(employee.id);

  el.viewRoot.innerHTML = `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h3>My profile</h3>
        </div>
        ${renderHelpButton("Profile edits update your employee record. Availability changes should be sent from the Requests page so managers can review them.")}
      </div>
      <form id="profileForm" class="form-grid">
        <div class="form-field">
          <label for="profileName">Name</label>
          <input id="profileName" value="${employee.name}" />
        </div>
        <div class="form-field">
          <label for="profilePhone">Phone</label>
          <input id="profilePhone" value="${employee.phone || ""}" />
        </div>
        <div class="form-field">
          <label for="profileEmail">Email</label>
          <input id="profileEmail" value="${employee.email || ""}" />
        </div>
        <div class="form-field">
          <label for="profileNotes">Notes</label>
          <input id="profileNotes" value="${employee.notes || ""}" />
        </div>
        <div class="form-field full-span">
          <label for="profileAvailability">Availability</label>
          <textarea id="profileAvailability" placeholder="Example: Monday lunch, Tuesday off, Friday closing only">${(employee.availability || []).join("\n")}</textarea>
        </div>
        <div class="inline-form full-span">
          <button type="submit" class="primary-button">Save profile</button>
        </div>
      </form>
    </section>
    <section class="panel">
      <div class="panel-header">
        <div>
          <h3>My shifts</h3>
        </div>
      </div>
      <div class="list-grid">
        ${shifts.map(renderEmployeeShiftCard).join("") || renderInlineEmpty("No shifts scheduled.")}
      </div>
    </section>
  `;

  document.querySelector("#profileForm").addEventListener("submit", handleUpdateOwnProfile);
  bindHelpButtons();
}

function renderSettingsView() {
  const backend = state.appData.meta.backend;
  el.viewRoot.innerHTML = `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h3>Locations</h3>
        </div>
        ${renderHelpButton("Managers can schedule and manage employee records for their locations only. Employees never see this page.")}
      </div>
      <div class="settings-grid">
        ${state.appData.locations.map(renderLocationSettingsCard).join("")}
      </div>
      <div class="inline-form top-gap">
        <button type="button" class="primary-button" id="saveLocationSettingsButton">Save restaurant hours</button>
      </div>
      <div class="summary-grid top-gap">
        ${state.appData.users
          .filter((user) => user.role !== "employee")
          .map(renderUserAccessCard)
          .join("")}
      </div>
    </section>
    <section class="panel">
      <div class="panel-header">
        <div>
          <h3>Live backend</h3>
        </div>
      </div>
      <div class="form-grid">
        <div class="form-field">
          <label for="appsScriptUrl">Apps Script Web App URL</label>
          <input id="appsScriptUrl" value="${backend.appsScriptUrl}" placeholder="https://script.google.com/macros/s/..." />
        </div>
        <div class="form-field">
          <label for="sheetId">Google Sheet ID</label>
          <input id="sheetId" value="${backend.sheetId}" placeholder="1abc..." />
        </div>
      </div>
      <div class="inline-form top-gap">
        <button type="button" class="primary-button" id="saveBackendButton">Save backend settings</button>
        <button type="button" class="ghost-button" id="loadRemoteButton">Load remote data</button>
        <button type="button" class="ghost-button" id="syncRemoteButton">Sync local to remote</button>
        <button type="button" class="ghost-button" id="healthcheckButton">Test Apps Script endpoint</button>
      </div>
      <div class="summary-grid top-gap">
        <article class="summary-card code-card">
          <p class="eyebrow">Apps Script starter</p>
          <pre>${escapeHtml(createAppsScriptExample())}</pre>
        </article>
      </div>
    </section>
  `;

  document.querySelector("#saveLocationSettingsButton").addEventListener("click", saveLocationServiceSettings);
  document.querySelector("#saveBackendButton").addEventListener("click", saveBackendSettings);
  document.querySelector("#loadRemoteButton").addEventListener("click", loadFromRemote);
  document.querySelector("#syncRemoteButton").addEventListener("click", pushToRemote);
  document.querySelector("#healthcheckButton").addEventListener("click", testHealthcheck);
  bindHelpButtons();
}

function renderDayColumn(date, user, activeLocationId) {
  const shifts = getVisibleShifts(user).filter((shift) => shift.date === date && shift.locationId === activeLocationId);
  const label = formatDate(date);
  return `<article class="schedule-card">
    <header>
      <h3>${label.weekday}</h3>
      <p class="muted">${label.fullDate}</p>
    </header>
    <div class="shift-stack dropzone" data-drop-date="${date}" data-drop-location="${activeLocationId}">
      ${shifts.map(renderShiftCard).join("") || renderInlineEmpty("No shifts")}
    </div>
  </article>`;
}

function renderShiftCard(shift) {
  const employee = getEmployee(shift.employeeId);
  return `<article class="shift-card">
    <div class="shift-head">
      <strong>${employee?.name || "Unknown employee"}</strong>
      <div class="inline-form">
        <button type="button" class="ghost-button mini-button" data-action="edit-shift" data-id="${shift.id}">Edit</button>
        <button type="button" class="icon-button" data-action="delete-shift" data-id="${shift.id}">×</button>
      </div>
    </div>
    <p class="muted">${getRoleName(shift.roleId)}</p>
    <div class="pill-row">
      <span class="pill">${shift.start} - ${shift.end}</span>
      <span class="pill ${shift.status === "published" ? "accent" : "warning"}">${capitalize(shift.status)}</span>
    </div>
  </article>`;
}

function renderEmployeeManagerCard(employee) {
  return `<article class="employee-card">
    <p class="eyebrow">${getRoleName(employee.roleId)}</p>
    <h4>${employee.name}</h4>
    <p class="muted">${employee.locations.map(getLocationName).join(", ")}</p>
    <div class="tag-row">
      <span class="tag">$${employee.hourlyRate}/hr</span>
      <span class="tag">${employee.weeklyHoursTarget}h target</span>
      <span class="tag">${employee.phone || "No phone"}</span>
    </div>
    <p class="kpi-note">${employee.email || "No email"} · ${employee.positionLabel || getRoleName(employee.roleId)}</p>
    <div class="inline-form top-gap">
      <button type="button" class="small-button" data-action="edit-employee" data-id="${employee.id}">Edit</button>
      <button type="button" class="ghost-button" data-action="delete-employee" data-id="${employee.id}">Remove</button>
    </div>
  </article>`;
}

function renderEmployeeListCard(employee) {
  return `<article class="list-card">
    <strong>${employee.name}</strong>
    <p class="muted">${getRoleName(employee.roleId)} · ${employee.locations.map(getLocationName).join(", ")}</p>
  </article>`;
}

function renderStaffPlannerCard(employee, activeLocationId) {
  const assignedHours = state.appData.shifts
    .filter((shift) => shift.employeeId === employee.id && shift.locationId === activeLocationId)
    .reduce((sum, shift) => sum + calculateHours(shift.start, shift.end), 0);
  const pendingAvailability = state.appData.requests.find(
    (request) => request.employeeId === employee.id && request.type === "availability_change" && request.status === "pending"
  );
  return `<article class="staff-card" draggable="true" data-employee-id="${employee.id}">
    <div class="shift-head">
      <strong>${employee.name}</strong>
      <span class="pill">${assignedHours.toFixed(1)}h</span>
    </div>
    <p class="muted">${employee.positionLabel || getRoleName(employee.roleId)}</p>
    <p class="kpi-note">Availability: ${(employee.availability || []).join(" · ") || "Not set"}</p>
    ${pendingAvailability ? `<p class="staff-note">Pending change: ${pendingAvailability.note}</p>` : ""}
  </article>`;
}

function renderEmployeeShiftCard(shift) {
  return `<article class="list-card">
    <strong>${formatDate(shift.date).weekday} · ${formatDate(shift.date).fullDate}</strong>
    <p class="muted">${getLocationName(shift.locationId)} · ${getRoleName(shift.roleId)}</p>
    <p class="kpi-note">${shift.start} - ${shift.end}${shift.notes ? ` · ${shift.notes}` : ""}</p>
  </article>`;
}

function renderRequestCard(request) {
  const employee = getEmployee(request.employeeId);
  const actionButtons = getCurrentUser().role === "employee"
    ? ""
    : `<div class="inline-form top-gap">
        <button type="button" class="small-button" data-action="approve-request" data-id="${request.id}">Approve</button>
        <button type="button" class="ghost-button" data-action="decline-request" data-id="${request.id}">Decline</button>
      </div>`;
  return `<article class="list-card">
    <div class="pill-row">
      <span class="pill">${humanizeRequestType(request.type)}</span>
      <span class="pill ${request.status === "approved" ? "accent" : request.status === "declined" ? "" : "warning"}">${capitalize(request.status)}</span>
    </div>
    <strong>${employee?.name || "Unknown employee"}</strong>
    <p class="muted">${request.startDate || "Open"}${request.endDate ? ` to ${request.endDate}` : ""}</p>
    <p class="kpi-note">${request.note || "No note added"}</p>
    ${actionButtons}
  </article>`;
}

function renderLocationSettingsCard(location) {
  const config = state.appData.locationSettings.find((item) => item.locationId === location.id);
  return `<article class="summary-card">
    <h3>${location.name}</h3>
    <p class="muted">${location.city}</p>
    <div class="form-grid top-gap">
      <div class="form-field">
        <label for="lunchOpen-${location.id}">Lunch open</label>
        <input id="lunchOpen-${location.id}" data-setting-location="${location.id}" data-setting-key="lunchOpen" type="time" value="${config.lunchOpen || ""}" />
      </div>
      <div class="form-field">
        <label for="lunchClose-${location.id}">Lunch close</label>
        <input id="lunchClose-${location.id}" data-setting-location="${location.id}" data-setting-key="lunchClose" type="time" value="${config.lunchClose || ""}" />
      </div>
      <div class="form-field">
        <label for="dinnerOpen-${location.id}">Dinner open</label>
        <input id="dinnerOpen-${location.id}" data-setting-location="${location.id}" data-setting-key="dinnerOpen" type="time" value="${config.dinnerOpen || ""}" />
      </div>
      <div class="form-field">
        <label for="dinnerClose-${location.id}">Dinner close</label>
        <input id="dinnerClose-${location.id}" data-setting-location="${location.id}" data-setting-key="dinnerClose" type="time" value="${config.dinnerClose || ""}" />
      </div>
    </div>
  </article>`;
}

function renderUserAccessCard(user) {
  return `<article class="summary-card">
    <p class="eyebrow">${capitalize(user.role)}</p>
    <h3>${user.name}</h3>
    <p class="muted">${user.email}</p>
    <p class="kpi-note">${(user.managedLocationIds || []).map(getLocationName).join(", ") || "No assigned locations"}</p>
  </article>`;
}

function renderEmployeeRequestForm() {
  return `<form id="requestForm" class="form-grid request-form">
    <div class="form-field">
      <label for="requestType">Request type</label>
      <select id="requestType">
        <option value="time_off">Time off</option>
        <option value="availability_change">Availability change</option>
        <option value="message">Message</option>
      </select>
    </div>
    <div class="form-field">
      <label for="requestStartDate">Start date</label>
      <input id="requestStartDate" type="date" />
    </div>
    <div class="form-field">
      <label for="requestEndDate">End date</label>
      <input id="requestEndDate" type="date" />
    </div>
    <div class="form-field">
      <label for="requestScope">Availability scope</label>
      <select id="requestScope">
        <option value="temporary">Temporary range</option>
        <option value="permanent">Permanent change</option>
      </select>
    </div>
    <div class="form-field full-span">
      <label for="requestNote">Details</label>
      <textarea id="requestNote" placeholder="Explain the time-off request, new availability, or your message"></textarea>
    </div>
    <div class="inline-form full-span">
      <button type="submit" class="primary-button">Send request</button>
    </div>
  </form>`;
}

function renderInlineEmpty(text) {
  return `<div class="empty-inline">${text}</div>`;
}

function renderHelpButton(text) {
  return `<button type="button" class="help-button" data-help="${escapeHtml(text)}">?</button>`;
}

function renderLocationOption(location) {
  return `<option value="${location.id}" ${state.filters.locationId === location.id ? "selected" : ""}>${location.name}</option>`;
}

function renderRoleOption(role) {
  return `<option value="${role.id}" ${state.filters.roleId === role.id ? "selected" : ""}>${role.name}</option>`;
}

function handleCreateShift(event) {
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
    notes: document.querySelector("#shiftNotes").value.trim(),
  };
  state.appData.shifts.push(newShift);
  persistAndRender("Shift added");
}

function handleEmployeeDragStart(event) {
  event.dataTransfer.setData("text/plain", event.currentTarget.dataset.employeeId);
}

function handleScheduleDrop(event) {
  event.preventDefault();
  const employeeId = event.dataTransfer.getData("text/plain");
  const date = event.currentTarget.dataset.dropDate;
  const locationId = event.currentTarget.dataset.dropLocation;
  const employee = getEmployee(employeeId);
  if (!employee || !date || !locationId) {
    return;
  }

  state.appData.shifts.push({
    id: `shift-${crypto.randomUUID()}`,
    date,
    locationId,
    employeeId,
    roleId: employee.roleId,
    start: "16:00",
    end: "22:00",
    status: "draft",
    notes: "",
  });
  persistAndRender(`Added ${employee.name} to ${formatDate(date).weekday}`);
}

function publishVisibleShifts() {
  const user = getCurrentUser();
  state.appData.shifts = state.appData.shifts.map((shift) =>
    getVisibleShifts(user).some((visible) => visible.id === shift.id) ? { ...shift, status: "published" } : shift
  );
  persistAndRender("Visible shifts published");
}

function copyLastWeek() {
  const user = getCurrentUser();
  const currentWeek = getWeekDates(state.weekStartDate);
  const previousWeek = getWeekDates(addDaysToIso(currentWeek[0], -7));
  const sourceShifts = state.appData.shifts.filter((shift) => {
    const inPreviousWeek = previousWeek.includes(shift.date);
    const visibleLocation = user.role === "admin" || user.managedLocationIds.includes(shift.locationId);
    return inPreviousWeek && visibleLocation;
  });

  const copied = sourceShifts.map((shift) => ({
    ...shift,
    id: `shift-${crypto.randomUUID()}`,
    date: addDaysToIso(shift.date, 7),
    status: "draft",
  }));

  state.appData.shifts.push(...copied);
  persistAndRender(`Copied ${copied.length} shifts from last week`);
}

function handleCreateEmployee(event) {
  event.preventDefault();
  const locationId = document.querySelector("#employeeLocation").value;
  const employee = {
    id: `emp-${slugify(document.querySelector("#employeeName").value)}-${Date.now()}`,
    name: document.querySelector("#employeeName").value.trim(),
    email: document.querySelector("#employeeEmail").value.trim(),
    phone: "",
    roleId: document.querySelector("#employeeRole").value,
    positionLabel: getRoleName(document.querySelector("#employeeRole").value),
    locations: [locationId],
    hourlyRate: Number(document.querySelector("#employeeRate").value),
    weeklyHoursTarget: Number(document.querySelector("#employeeTargetHours").value),
    tags: [],
    availability: ["Open availability"],
    notes: "",
    externalEmployeeId: "",
  };

  state.appData.employees.push(employee);
  state.appData.users.push({
    id: `user-${employee.id}`,
    name: employee.name,
    lastName: getLastName(employee.name),
    pin: "0000",
    email: employee.email,
    role: "employee",
    employeeId: employee.id,
    managedLocationIds: [],
  });
  persistAndRender(`Added ${employee.name}`);
}

function handleUpdateOwnProfile(event) {
  event.preventDefault();
  const user = getCurrentUser();
  const employee = getEmployeeByUser(user);
  const next = {
    ...employee,
    name: document.querySelector("#profileName").value.trim(),
    phone: document.querySelector("#profilePhone").value.trim(),
    email: document.querySelector("#profileEmail").value.trim(),
    notes: document.querySelector("#profileNotes").value.trim(),
    availability: document.querySelector("#profileAvailability").value
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean),
  };
  replaceEmployee(next);
  state.appData.users = state.appData.users.map((item) =>
    item.id === user.id ? { ...item, name: next.name, email: next.email } : item
  );
  persistAndRender("Profile updated");
}

function handleCreateRequest(event) {
  event.preventDefault();
  const employee = getEmployeeByUser(getCurrentUser());
  state.appData.requests.push({
    id: `req-${crypto.randomUUID()}`,
    employeeId: employee.id,
    type: document.querySelector("#requestType").value,
    status: "pending",
    startDate: document.querySelector("#requestStartDate").value,
    endDate: document.querySelector("#requestEndDate").value,
    scope: document.querySelector("#requestScope").value,
    note: document.querySelector("#requestNote").value.trim(),
    createdAt: new Date().toISOString(),
  });
  persistAndRender("Request sent");
}

function updateRequestStatus(requestId, status) {
  state.appData.requests = state.appData.requests.map((request) =>
    request.id === requestId ? { ...request, status } : request
  );
  persistAndRender(`Request ${status}`);
}

function deleteEmployee(employeeId) {
  const employee = getEmployee(employeeId);
  state.appData.employees = state.appData.employees.filter((item) => item.id !== employeeId);
  state.appData.users = state.appData.users.filter((item) => item.employeeId !== employeeId);
  state.appData.shifts = state.appData.shifts.filter((item) => item.employeeId !== employeeId);
  state.appData.requests = state.appData.requests.filter((item) => item.employeeId !== employeeId);
  persistAndRender(`${employee?.name || "Employee"} removed`);
}

function openEmployeeEdit(employeeId) {
  const employee = getEmployee(employeeId);
  const nextName = window.prompt("Employee name", employee.name);
  if (!nextName) {
    return;
  }
  const nextEmail = window.prompt("Employee email", employee.email || "");
  const nextPhone = window.prompt("Phone", employee.phone || "");
  const nextPosition = window.prompt("Position label", employee.positionLabel || getRoleName(employee.roleId));
  replaceEmployee({
    ...employee,
    name: nextName.trim(),
    email: (nextEmail || "").trim(),
    phone: (nextPhone || "").trim(),
    positionLabel: (nextPosition || "").trim(),
  });
  state.appData.users = state.appData.users.map((item) =>
    item.employeeId === employeeId
      ? { ...item, name: nextName.trim(), lastName: getLastName(nextName.trim()), email: (nextEmail || "").trim() }
      : item
  );
  persistAndRender("Employee updated");
}

function saveBackendSettings() {
  state.appData.meta.backend.provider = "appsScript";
  state.appData.meta.backend.appsScriptUrl = document.querySelector("#appsScriptUrl").value.trim();
  state.appData.meta.backend.sheetId = document.querySelector("#sheetId").value.trim();
  persistAndRender("Live backend settings saved");
}

async function handleAccessLogin(event) {
  event.preventDefault();
  const lastName = document.querySelector("#accessLastName").value.trim();
  const pin = document.querySelector("#accessPin").value.trim();

  if (!lastName || !pin) {
    state.lastSyncMessage = "Enter last name and PIN.";
    renderAccessGate();
    return;
  }

  try {
    const authenticatedUser = await authenticateUser(lastName, pin);
    saveSession({
      userId: authenticatedUser.id,
      email: authenticatedUser.email,
      role: authenticatedUser.role,
      lastName: authenticatedUser.lastName,
    });
    state.currentUserId = authenticatedUser.id;
    state.currentView = "dashboard";
    state.lastSyncMessage = `Access granted for ${authenticatedUser.name}`;
    render();
  } catch (error) {
    state.lastSyncMessage = error.message;
    renderAccessGate();
  }
}

async function testHealthcheck() {
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
}

async function maybeHydrateFromRemoteWithSession() {
  const backend = state.appData.meta.backend;
  const session = state.session;
  if (backend.provider !== "appsScript" || !backend.appsScriptUrl || !session?.email) {
    return;
  }
  const remoteData = await fetchRemoteState(backend.appsScriptUrl, session.email);
  state.appData = mergeBackendConfig(remoteData, backend);
  saveState(state.appData);
  state.currentUserId = state.appData.users.find((user) => user.email === session.email)?.id ?? null;
  if (!state.currentUserId) {
    clearSession();
    state.lastSyncMessage = "Access session expired. Please log in again.";
  } else {
    state.lastSyncMessage = `Loaded remote data for ${session.email}`;
  }
}

async function loadFromRemote() {
  const backend = state.appData.meta.backend;
  const currentUser = getCurrentUser();
  if (!backend.appsScriptUrl || !currentUser?.email) {
    window.alert("Add backend settings and make sure the current user has an email.");
    return;
  }
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
  }
}

async function pushToRemote() {
  const backend = state.appData.meta.backend;
  const currentUser = getCurrentUser();
  if (!backend.appsScriptUrl || !currentUser?.email) {
    window.alert("Add backend settings and make sure the current user has an email.");
    return;
  }
  try {
    await syncRemoteState(backend.appsScriptUrl, state.appData, currentUser.email);
    state.lastSyncMessage = `Synced local data to Google Apps Script as ${currentUser.email}`;
    renderAlerts();
  } catch (error) {
    state.lastSyncMessage = `Remote sync failed: ${error.message}`;
    renderAlerts();
  }
}

function buildStatsForUser(user) {
  if (user.role === "employee") {
    const employee = getEmployeeByUser(user);
    const shifts = getEmployeeShifts(employee.id);
    const requests = getEmployeeRequests(employee.id);
    return [
      { label: "Upcoming shifts", value: shifts.length, note: "Visible on your profile" },
      { label: "Primary location", value: employee.locations.length, note: employee.locations.map(getLocationName).join(", ") },
      { label: "Open requests", value: requests.filter((item) => item.status === "pending").length, note: "Pending review" },
      { label: "Weekly target", value: employee.weeklyHoursTarget, note: "Target hours" },
    ];
  }

  const locations = getScopedLocations(user);
  const shifts = getScopedShifts(user);
  const employees = getScopedEmployees(user);
  const requests = getScopedRequests(user);
  return [
    { label: "Locations", value: locations.length, note: locations.map((location) => location.name).join(", ") },
    { label: "Employees", value: employees.length, note: "Visible to this role" },
    { label: "Labor hours", value: shifts.reduce((sum, shift) => sum + calculateHours(shift.start, shift.end), 0).toFixed(1), note: "Scheduled this week" },
    { label: "Pending requests", value: requests.filter((item) => item.status === "pending").length, note: "Need review" },
  ];
}

function buildAlerts() {
  const user = getCurrentUser();
  const alerts = [];

  if (user.role !== "employee") {
    const pendingRequests = getScopedRequests(user).filter((item) => item.status === "pending").length;
    if (pendingRequests) {
      alerts.push({
        type: "warning",
        title: `${pendingRequests} pending requests`,
        body: "Review time-off and availability changes before finalizing next week’s schedule.",
      });
    }
  }

  if (user.role === "employee") {
    const open = getEmployeeRequests(getEmployeeByUser(user).id).filter((item) => item.status === "pending").length;
    alerts.push({
      type: "success",
      title: "Employee self-service is active",
      body: `${open} request(s) waiting for review. Use Requests to send time-off and availability updates.`,
    });
  }

  if (user.role === "admin") {
    alerts.push({
      type: "success",
      title: "Status",
      body: state.lastSyncMessage || "All changes are up to date.",
    });
  }

  return alerts;
}

function bindHelpButtons() {
  document.querySelectorAll("[data-help]").forEach((button) => {
    button.addEventListener("click", () => {
      window.alert(button.dataset.help);
    });
  });

  document.querySelectorAll("[data-action='delete-shift']").forEach((button) => {
    button.addEventListener("click", () => deleteShift(button.dataset.id));
  });
  document.querySelectorAll("[data-action='edit-shift']").forEach((button) => {
    button.addEventListener("click", () => editShift(button.dataset.id));
  });
}

function deleteShift(shiftId) {
  state.appData.shifts = state.appData.shifts.filter((shift) => shift.id !== shiftId);
  persistAndRender("Shift removed");
}

function editShift(shiftId) {
  const shift = state.appData.shifts.find((item) => item.id === shiftId);
  if (!shift) {
    return;
  }
  const start = window.prompt("Shift start", shift.start);
  if (!start) {
    return;
  }
  const end = window.prompt("Shift end", shift.end);
  if (!end) {
    return;
  }
  state.appData.shifts = state.appData.shifts.map((item) =>
    item.id === shiftId ? { ...item, start, end } : item
  );
  persistAndRender("Shift updated");
}

function persistAndRender(message) {
  saveState(state.appData);
  state.lastSyncMessage = message;
  render();
  void syncIfLive();
}

async function syncIfLive() {
  const backend = state.appData.meta.backend;
  const currentUser = getCurrentUser();
  if (backend.provider !== "appsScript" || !backend.appsScriptUrl || !currentUser?.email) {
    return;
  }

  try {
    await syncRemoteState(backend.appsScriptUrl, state.appData, currentUser.email);
    state.lastSyncMessage = "Live changes saved";
    renderAlerts();
  } catch (error) {
    state.lastSyncMessage = `Live sync failed: ${error.message}`;
    renderAlerts();
  }
}

function saveLocationServiceSettings() {
  const inputs = document.querySelectorAll("[data-setting-location]");
  state.appData.locationSettings = state.appData.locationSettings.map((setting) => {
    const updates = {};
    inputs.forEach((input) => {
      if (input.dataset.settingLocation === setting.locationId) {
        updates[input.dataset.settingKey] = input.value;
      }
    });
    return { ...setting, ...updates };
  });
  persistAndRender("Restaurant hours saved");
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

async function authenticateUser(lastName, pin) {
  const backend = state.appData.meta.backend;
  if (backend.provider === "appsScript" && backend.appsScriptUrl) {
    const result = await authenticateRemoteUser(backend.appsScriptUrl, lastName, pin);
    state.appData = mergeBackendConfig(result.data, backend);
    saveState(state.appData);
    return state.appData.users.find((user) => user.id === result.user.id) || result.user;
  }

  const user = state.appData.users.find(
    (item) =>
      String(item.lastName || "").toLowerCase() === lastName.toLowerCase() &&
      String(item.pin || "") === pin
  );

  if (!user) {
    throw new Error("Access denied. Check last name and PIN.");
  }

  return user;
}

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function saveSession(session) {
  state.session = session;
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSession() {
  state.session = null;
  state.currentUserId = null;
  localStorage.removeItem(SESSION_KEY);
}

function getVisiblePages() {
  const user = getCurrentUser();
  return Object.fromEntries(Object.entries(pages).filter(([, page]) => page.roles.includes(user.role)));
}

function getCurrentUser() {
  return state.appData.users.find((user) => user.id === state.currentUserId) ?? state.appData.users[0];
}

function getScopedLocations(user) {
  if (user.role === "admin") {
    return state.appData.locations;
  }
  if (user.role === "manager") {
    return state.appData.locations.filter((location) => user.managedLocationIds.includes(location.id));
  }
  const employee = getEmployeeByUser(user);
  return state.appData.locations.filter((location) => employee.locations.includes(location.id));
}

function getScopedEmployees(user) {
  if (user.role === "admin") {
    return state.appData.employees;
  }
  if (user.role === "manager") {
    return state.appData.employees.filter((employee) =>
      employee.locations.some((locationId) => user.managedLocationIds.includes(locationId))
    );
  }
  const employee = getEmployeeByUser(user);
  return employee ? [employee] : [];
}

function getScopedShifts(user) {
  if (user.role === "employee") {
    const employee = getEmployeeByUser(user);
    return getEmployeeShifts(employee.id);
  }
  return state.appData.shifts.filter((shift) =>
    user.role === "admin" ? true : user.managedLocationIds.includes(shift.locationId)
  );
}

function getVisibleShifts(user) {
  return getScopedShifts(user).filter((shift) => {
    const locationMatch = state.filters.locationId === "all" || shift.locationId === state.filters.locationId;
    const roleMatch = state.filters.roleId === "all" || shift.roleId === state.filters.roleId;
    return locationMatch && roleMatch;
  });
}

function getScopedRequests(user) {
  if (user.role === "admin") {
    return state.appData.requests;
  }
  if (user.role === "manager") {
    const employeeIds = new Set(getScopedEmployees(user).map((employee) => employee.id));
    return state.appData.requests.filter((request) => employeeIds.has(request.employeeId));
  }
  const employee = getEmployeeByUser(user);
  return state.appData.requests.filter((request) => request.employeeId === employee.id);
}

function getEmployeeShifts(employeeId) {
  return state.appData.shifts
    .filter((shift) => shift.employeeId === employeeId)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function getEmployeeRequests(employeeId) {
  return state.appData.requests.filter((request) => request.employeeId === employeeId);
}

function getEmployee(employeeId) {
  return state.appData.employees.find((employee) => employee.id === employeeId);
}

function getEmployeeByUser(user) {
  return state.appData.employees.find((employee) => employee.id === user.employeeId) ?? state.appData.employees[0];
}

function replaceEmployee(nextEmployee) {
  state.appData.employees = state.appData.employees.map((employee) =>
    employee.id === nextEmployee.id ? nextEmployee : employee
  );
}

function getRoleName(roleId) {
  return state.appData.roles.find((role) => role.id === roleId)?.name ?? roleId;
}

function getLocationName(locationId) {
  return state.appData.locations.find((location) => location.id === locationId)?.name ?? locationId;
}

function humanizeRequestType(type) {
  return type
    .split("_")
    .map(capitalize)
    .join(" ");
}

function renderEmpty() {
  const template = document.querySelector("#emptyStateTemplate");
  el.viewRoot.innerHTML = "";
  el.viewRoot.append(template.content.cloneNode(true));
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

function addDaysToIso(dateString, amount) {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return date.toISOString().slice(0, 10);
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function getLastName(fullName) {
  const parts = String(fullName || "").trim().split(/\s+/);
  return parts[parts.length - 1] || "";
}

function formatWeekRange(startDate, endDate) {
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  const startLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(start);
  const endLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(end);
  return `${startLabel} - ${endLabel}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
