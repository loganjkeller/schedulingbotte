const STORAGE_KEY = "botte-scheduling-state-v3";

const today = new Date();

function startOfWeek(date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = copy.getDate() - day + (day === 0 ? -6 : 1);
  copy.setDate(diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date, amount) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

function iso(date) {
  return date.toISOString().slice(0, 10);
}

const baseWeek = startOfWeek(today);
const lastWeek = addDays(baseWeek, -7);

export function createSeedState() {
  const locations = [
    { id: "loc-nolita", name: "Nolita", city: "New York", timezone: "America/New_York", laborTarget: 0.29 },
    { id: "loc-soho", name: "SoHo", city: "New York", timezone: "America/New_York", laborTarget: 0.31 },
    { id: "loc-brooklyn", name: "Williamsburg", city: "Brooklyn", timezone: "America/New_York", laborTarget: 0.28 },
    { id: "loc-miami", name: "Design District", city: "Miami", timezone: "America/New_York", laborTarget: 0.3 },
  ];

  const roles = [
    { id: "role-gm", name: "General Manager", color: "#3e2a1f" },
    { id: "role-am", name: "Assistant Manager", color: "#5d3d2d" },
    { id: "role-server", name: "Server", color: "#a85b34" },
    { id: "role-bartender", name: "Bartender", color: "#8c5131" },
    { id: "role-line", name: "Line Cook", color: "#7e4033" },
    { id: "role-host", name: "Host", color: "#b88637" },
    { id: "role-runner", name: "Food Runner", color: "#4d7b62" },
  ];

  const accessTypes = [
    { id: "admin", name: "Admin", description: "Full access to everything." },
    { id: "manager", name: "Manager", description: "Manages staff and scheduling for assigned locations." },
    { id: "employee", name: "Employee", description: "Views schedule, profile, and requests." },
  ];

  const employees = [
    {
      id: "emp-alessia",
      name: "Alessia Romano",
      email: "alessia@botte.com",
      phone: "917-555-0147",
      roleId: "role-gm",
      positionLabel: "General Manager",
      locations: ["loc-nolita", "loc-soho"],
      hourlyRate: 32,
      weeklyHoursTarget: 45,
      tags: ["leadership", "opening"],
      availability: ["Open weekdays", "Sunday off"],
      notes: "Leads Nolita operations and helps SoHo launches.",
      externalEmployeeId: "BE-1001",
    },
    {
      id: "emp-marco",
      name: "Marco Silva",
      email: "marco@botte.com",
      phone: "718-555-0101",
      roleId: "role-am",
      positionLabel: "Assistant Manager",
      locations: ["loc-brooklyn"],
      hourlyRate: 24,
      weeklyHoursTarget: 40,
      tags: ["inventory", "training"],
      availability: ["Tuesday to Saturday", "Mornings flexible"],
      notes: "Supports Williamsburg schedules and training.",
      externalEmployeeId: "BE-1002",
    },
    {
      id: "emp-lena",
      name: "Lena Torres",
      email: "lena@botte.com",
      phone: "646-555-0194",
      roleId: "role-server",
      positionLabel: "Lead Server",
      locations: ["loc-nolita", "loc-soho"],
      hourlyRate: 16,
      weeklyHoursTarget: 32,
      tags: ["wine", "private dining"],
      availability: ["Dinner shifts", "Weekend open"],
      notes: "Strong for VIP and private dining coverage.",
      externalEmployeeId: "BE-1043",
    },
    {
      id: "emp-jules",
      name: "Jules Rivera",
      email: "jules@botte.com",
      phone: "212-555-0156",
      roleId: "role-bartender",
      positionLabel: "Bartender",
      locations: ["loc-soho"],
      hourlyRate: 18,
      weeklyHoursTarget: 36,
      tags: ["cocktails", "closing"],
      availability: ["Wednesday to Sunday evenings"],
      notes: "Owns cocktail execution and closing routines.",
      externalEmployeeId: "BE-1070",
    },
    {
      id: "emp-sofia",
      name: "Sofia Haddad",
      email: "sofia@botte.com",
      phone: "347-555-0121",
      roleId: "role-host",
      positionLabel: "Host",
      locations: ["loc-brooklyn", "loc-nolita"],
      hourlyRate: 15,
      weeklyHoursTarget: 28,
      tags: ["vip seating", "events"],
      availability: ["Friday to Sunday", "Monday evening"],
      notes: "Strong guest experience and event arrivals.",
      externalEmployeeId: "BE-1099",
    },
    {
      id: "emp-ian",
      name: "Ian Brooks",
      email: "ian@botte.com",
      phone: "305-555-0133",
      roleId: "role-line",
      positionLabel: "Line Cook",
      locations: ["loc-miami"],
      hourlyRate: 19,
      weeklyHoursTarget: 40,
      tags: ["grill", "prep"],
      availability: ["Monday to Saturday mornings"],
      notes: "Prep and grill support for Miami.",
      externalEmployeeId: "BE-1110",
    },
    {
      id: "emp-kiara",
      name: "Kiara Conte",
      email: "kiara@botte.com",
      phone: "786-555-0178",
      roleId: "role-runner",
      positionLabel: "Food Runner",
      locations: ["loc-miami", "loc-soho"],
      hourlyRate: 15,
      weeklyHoursTarget: 30,
      tags: ["speed", "brunch"],
      availability: ["Weekend brunch", "Friday evenings"],
      notes: "Reliable in fast brunch service.",
      externalEmployeeId: "BE-1112",
    },
  ];

  const shifts = [
    {
      id: "shift-last-1",
      date: iso(lastWeek),
      locationId: "loc-nolita",
      employeeId: "emp-alessia",
      roleId: "role-gm",
      start: "08:00",
      end: "17:00",
      status: "published",
      notes: "Last week opening coverage",
    },
    {
      id: "shift-last-2",
      date: iso(addDays(lastWeek, 2)),
      locationId: "loc-soho",
      employeeId: "emp-lena",
      roleId: "role-server",
      start: "15:00",
      end: "23:00",
      status: "published",
      notes: "Last week terrace section",
    },
    {
      id: "shift-1",
      date: iso(baseWeek),
      locationId: "loc-nolita",
      employeeId: "emp-alessia",
      roleId: "role-gm",
      start: "08:00",
      end: "17:00",
      status: "published",
      notes: "Vendor check-in and payroll review",
    },
    {
      id: "shift-2",
      date: iso(baseWeek),
      locationId: "loc-nolita",
      employeeId: "emp-sofia",
      roleId: "role-host",
      start: "16:00",
      end: "22:00",
      status: "draft",
      notes: "Private dining arrivals",
    },
    {
      id: "shift-3",
      date: iso(addDays(baseWeek, 1)),
      locationId: "loc-brooklyn",
      employeeId: "emp-marco",
      roleId: "role-am",
      start: "11:00",
      end: "20:00",
      status: "published",
      notes: "Team training block from 2pm",
    },
    {
      id: "shift-4",
      date: iso(addDays(baseWeek, 2)),
      locationId: "loc-soho",
      employeeId: "emp-lena",
      roleId: "role-server",
      start: "15:00",
      end: "23:00",
      status: "published",
      notes: "Cover terrace section",
    },
    {
      id: "shift-5",
      date: iso(addDays(baseWeek, 3)),
      locationId: "loc-soho",
      employeeId: "emp-jules",
      roleId: "role-bartender",
      start: "16:00",
      end: "00:00",
      status: "published",
      notes: "New cocktail menu rollout",
    },
    {
      id: "shift-6",
      date: iso(addDays(baseWeek, 4)),
      locationId: "loc-miami",
      employeeId: "emp-ian",
      roleId: "role-line",
      start: "09:00",
      end: "17:00",
      status: "published",
      notes: "Prep for weekend brunch",
    },
    {
      id: "shift-7",
      date: iso(addDays(baseWeek, 5)),
      locationId: "loc-miami",
      employeeId: "emp-kiara",
      roleId: "role-runner",
      start: "11:00",
      end: "19:00",
      status: "draft",
      notes: "Brunch and patio support",
    },
  ];

  const templates = [
    {
      id: "template-weekday-dinner",
      name: "Weekday Dinner",
      locationIds: ["loc-nolita", "loc-soho"],
      demandLevel: "High",
      roles: ["GM", "Server x3", "Bartender x1", "Host x1", "Runner x1"],
    },
    {
      id: "template-brunch",
      name: "Weekend Brunch",
      locationIds: ["loc-brooklyn", "loc-miami"],
      demandLevel: "Peak",
      roles: ["AM", "Server x2", "Host x1", "Line Cook x2", "Runner x1"],
    },
  ];

  const locationSettings = [
    { locationId: "loc-nolita", weekStartsOn: "Monday", publishCutoffHours: 48, overtimeWarningHours: 38, approvalRequired: true, lunchOpen: "11:30", lunchClose: "15:00", dinnerOpen: "17:00", dinnerClose: "23:00" },
    { locationId: "loc-soho", weekStartsOn: "Monday", publishCutoffHours: 48, overtimeWarningHours: 38, approvalRequired: true, lunchOpen: "11:30", lunchClose: "15:00", dinnerOpen: "17:00", dinnerClose: "23:00" },
    { locationId: "loc-brooklyn", weekStartsOn: "Monday", publishCutoffHours: 72, overtimeWarningHours: 36, approvalRequired: false, lunchOpen: "10:30", lunchClose: "15:30", dinnerOpen: "17:00", dinnerClose: "22:00" },
    { locationId: "loc-miami", weekStartsOn: "Monday", publishCutoffHours: 48, overtimeWarningHours: 40, approvalRequired: true, lunchOpen: "11:00", lunchClose: "15:00", dinnerOpen: "17:30", dinnerClose: "22:30" },
  ];

  const users = [
    {
      id: "user-admin",
      name: "Logan Admin",
      lastName: "Keller",
      pin: "1111",
      email: "owner@botte.com",
      role: "admin",
      employeeId: "",
      managedLocationIds: locations.map((item) => item.id),
    },
    {
      id: "user-manager-alessia",
      name: "Alessia Manager",
      lastName: "Romano",
      pin: "2020",
      email: "alessia@botte.com",
      role: "manager",
      employeeId: "emp-alessia",
      managedLocationIds: ["loc-nolita", "loc-soho"],
    },
    {
      id: "user-manager-marco",
      name: "Marco Manager",
      lastName: "Silva",
      pin: "3030",
      email: "marco@botte.com",
      role: "manager",
      employeeId: "emp-marco",
      managedLocationIds: ["loc-brooklyn"],
    },
    {
      id: "user-employee-lena",
      name: "Lena Employee",
      lastName: "Torres",
      pin: "4040",
      email: "lena@botte.com",
      role: "employee",
      employeeId: "emp-lena",
      managedLocationIds: [],
    },
    {
      id: "user-employee-sofia",
      name: "Sofia Employee",
      lastName: "Haddad",
      pin: "5050",
      email: "sofia@botte.com",
      role: "employee",
      employeeId: "emp-sofia",
      managedLocationIds: [],
    },
  ];

  const requests = [
    {
      id: "req-1",
      employeeId: "emp-lena",
      type: "time_off",
      status: "pending",
      startDate: iso(addDays(baseWeek, 5)),
      endDate: iso(addDays(baseWeek, 6)),
      scope: "temporary",
      note: "Family event this weekend.",
      createdAt: new Date().toISOString(),
    },
    {
      id: "req-2",
      employeeId: "emp-sofia",
      type: "availability_change",
      status: "pending",
      startDate: iso(addDays(baseWeek, 7)),
      endDate: "",
      scope: "permanent",
      note: "Can no longer work Tuesday evenings after next week.",
      createdAt: new Date().toISOString(),
    },
  ];

  return {
    meta: {
      version: 3,
      seededAt: new Date().toISOString(),
      mode: "local-demo",
      backend: {
        provider: "localStorage",
        appsScriptUrl: "",
        sheetId: "",
      },
    },
    locations,
    roles,
    accessTypes,
    employees,
    shifts,
    templates,
    locationSettings,
    users,
    requests,
  };
}

export function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seed = createSeedState();
    saveState(seed);
    return seed;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed.requests || !parsed.accessTypes || !parsed.meta || parsed.meta.version !== 3) {
      const seed = createSeedState();
      saveState(seed);
      return seed;
    }
    return parsed;
  } catch {
    const seed = createSeedState();
    saveState(seed);
    return seed;
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetState() {
  const seed = createSeedState();
  saveState(seed);
  return seed;
}

export function getWeekDates(referenceDate = baseWeek) {
  const start = typeof referenceDate === "string" ? new Date(`${referenceDate}T12:00:00`) : referenceDate;
  return Array.from({ length: 7 }, (_, index) => iso(addDays(start, index)));
}

export function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}
