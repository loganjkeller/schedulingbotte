const STORAGE_KEY = "botte-scheduling-state-v1";

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

export function createSeedState() {
  const locations = [
    { id: "loc-nolita", name: "Nolita", city: "New York", timezone: "America/New_York", laborTarget: 0.29 },
    { id: "loc-soho", name: "SoHo", city: "New York", timezone: "America/New_York", laborTarget: 0.31 },
    { id: "loc-brooklyn", name: "Williamsburg", city: "Brooklyn", timezone: "America/New_York", laborTarget: 0.28 },
    { id: "loc-miami", name: "Design District", city: "Miami", timezone: "America/New_York", laborTarget: 0.3 },
  ];

  const roles = [
    { id: "role-gm", name: "General Manager", color: "#6d3a1e" },
    { id: "role-am", name: "Assistant Manager", color: "#945027" },
    { id: "role-server", name: "Server", color: "#bf5a2b" },
    { id: "role-bartender", name: "Bartender", color: "#d97844" },
    { id: "role-line", name: "Line Cook", color: "#a03f2e" },
    { id: "role-host", name: "Host", color: "#ca8b20" },
    { id: "role-runner", name: "Food Runner", color: "#1f7a55" },
  ];

  const employees = [
    {
      id: "emp-alessia",
      name: "Alessia Romano",
      roleId: "role-gm",
      locations: ["loc-nolita", "loc-soho"],
      hourlyRate: 32,
      weeklyHoursTarget: 45,
      tags: ["leadership", "opening"],
      availability: ["Mon AM", "Tue AM", "Wed AM", "Thu AM", "Fri AM"],
      externalEmployeeId: "BE-1001",
    },
    {
      id: "emp-marco",
      name: "Marco Silva",
      roleId: "role-am",
      locations: ["loc-brooklyn"],
      hourlyRate: 24,
      weeklyHoursTarget: 40,
      tags: ["inventory", "training"],
      availability: ["Mon PM", "Tue PM", "Wed PM", "Thu PM", "Fri PM", "Sat PM"],
      externalEmployeeId: "BE-1002",
    },
    {
      id: "emp-lena",
      name: "Lena Torres",
      roleId: "role-server",
      locations: ["loc-nolita", "loc-soho"],
      hourlyRate: 16,
      weeklyHoursTarget: 32,
      tags: ["wine", "private dining"],
      availability: ["Tue PM", "Wed PM", "Thu PM", "Fri PM", "Sat PM", "Sun PM"],
      externalEmployeeId: "BE-1043",
    },
    {
      id: "emp-jules",
      name: "Jules Rivera",
      roleId: "role-bartender",
      locations: ["loc-soho"],
      hourlyRate: 18,
      weeklyHoursTarget: 36,
      tags: ["cocktails", "closing"],
      availability: ["Wed PM", "Thu PM", "Fri PM", "Sat PM", "Sun PM"],
      externalEmployeeId: "BE-1070",
    },
    {
      id: "emp-sofia",
      name: "Sofia Haddad",
      roleId: "role-host",
      locations: ["loc-brooklyn", "loc-nolita"],
      hourlyRate: 15,
      weeklyHoursTarget: 28,
      tags: ["vip seating", "events"],
      availability: ["Mon PM", "Tue PM", "Fri PM", "Sat PM", "Sun PM"],
      externalEmployeeId: "BE-1099",
    },
    {
      id: "emp-ian",
      name: "Ian Brooks",
      roleId: "role-line",
      locations: ["loc-miami"],
      hourlyRate: 19,
      weeklyHoursTarget: 40,
      tags: ["grill", "prep"],
      availability: ["Mon AM", "Tue AM", "Wed AM", "Thu AM", "Fri AM", "Sat AM"],
      externalEmployeeId: "BE-1110",
    },
    {
      id: "emp-kiara",
      name: "Kiara Conte",
      roleId: "role-runner",
      locations: ["loc-miami", "loc-soho"],
      hourlyRate: 15,
      weeklyHoursTarget: 30,
      tags: ["speed", "brunch"],
      availability: ["Fri PM", "Sat PM", "Sun AM", "Sun PM"],
      externalEmployeeId: "BE-1112",
    },
  ];

  const shifts = [
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
    {
      locationId: "loc-nolita",
      weekStartsOn: "Monday",
      publishCutoffHours: 48,
      overtimeWarningHours: 38,
      approvalRequired: true,
    },
    {
      locationId: "loc-soho",
      weekStartsOn: "Monday",
      publishCutoffHours: 48,
      overtimeWarningHours: 38,
      approvalRequired: true,
    },
    {
      locationId: "loc-brooklyn",
      weekStartsOn: "Monday",
      publishCutoffHours: 72,
      overtimeWarningHours: 36,
      approvalRequired: false,
    },
    {
      locationId: "loc-miami",
      weekStartsOn: "Monday",
      publishCutoffHours: 48,
      overtimeWarningHours: 40,
      approvalRequired: true,
    },
  ];

  const users = [
    {
      id: "user-admin",
      name: "Logan Admin",
      email: "owner@botte.com",
      role: "admin",
      managedLocationIds: locations.map((item) => item.id),
    },
    {
      id: "user-nolita-manager",
      name: "Alessia Manager",
      email: "alessia@botte.com",
      role: "manager",
      managedLocationIds: ["loc-nolita", "loc-soho"],
    },
    {
      id: "user-brooklyn-manager",
      name: "Marco Manager",
      email: "marco@botte.com",
      role: "manager",
      managedLocationIds: ["loc-brooklyn"],
    },
  ];

  return {
    meta: {
      version: 1,
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
    employees,
    shifts,
    templates,
    locationSettings,
    users,
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
    return JSON.parse(raw);
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
  return Array.from({ length: 7 }, (_, index) => iso(addDays(referenceDate, index)));
}

export function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}
