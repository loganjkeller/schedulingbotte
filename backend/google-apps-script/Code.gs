var SHEET_CONFIG = {
  locations: ["id", "name", "city", "timezone", "laborTarget"],
  roles: ["id", "name", "color"],
  accessTypes: ["id", "name", "description"],
  employees: [
    "id",
    "name",
    "email",
    "phone",
    "roleId",
    "positionLabel",
    "locations",
    "hourlyRate",
    "weeklyHoursTarget",
    "tags",
    "availability",
    "notes",
    "externalEmployeeId",
  ],
  shifts: ["id", "date", "locationId", "employeeId", "roleId", "start", "end", "status", "notes"],
  templates: ["id", "name", "locationIds", "demandLevel", "roles"],
  locationSettings: ["locationId", "weekStartsOn", "publishCutoffHours", "overtimeWarningHours", "approvalRequired"],
  users: ["id", "name", "lastName", "pin", "email", "role", "employeeId", "managedLocationIds"],
  requests: ["id", "employeeId", "type", "status", "startDate", "endDate", "scope", "note", "createdAt"],
};

function doGet() {
  return jsonResponse_({
    ok: true,
    service: "botte-scheduling-apps-script",
    actions: ["healthcheck", "bootstrapSheets", "getState", "syncAll"],
  });
}

function doPost(e) {
  var request = parseBody_(e);
  var action = request.action || "healthcheck";

  if (action === "healthcheck") {
    return jsonResponse_({ ok: true, provider: "google-apps-script" });
  }

  try {
    if (action === "bootstrapSheets") {
      bootstrapSheets_();
      return jsonResponse_({ ok: true, message: "Sheet tabs are ready." });
    }

    if (action === "getState") {
      var access = getUserAccess_(request.userEmail);
      return jsonResponse_({ ok: true, data: buildStateForUser_(access) });
    }

    if (action === "authenticate") {
      var authenticated = authenticateUser_(request.lastName, request.pin);
      return jsonResponse_({
        ok: true,
        user: sanitizeUser_(authenticated),
        data: buildStateForUser_(authenticated),
      });
    }

    if (action === "syncAll") {
      var syncAccess = getUserAccess_(request.userEmail);
      if (syncAccess.role !== "admin") {
        if (request.context && isAllowedNonAdminAction_(request.context.type)) {
          writeFullState_(request.payload || {});
          notifyByContext_(request.payload || {}, request.context || {});
          return jsonResponse_({ ok: true, message: "Google Sheets updated." });
        }
        return jsonResponse_({ ok: false, error: "Only admins can sync all scheduling data." });
      }

      writeFullState_(request.payload || {});
      notifyByContext_(request.payload || {}, request.context || {});
      return jsonResponse_({ ok: true, message: "Google Sheets updated." });
    }

    return jsonResponse_({ ok: false, error: "Unknown action: " + action });
  } catch (error) {
    return jsonResponse_({
      ok: false,
      error: error && error.message ? error.message : String(error),
    });
  }
}

function bootstrapSheets_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEET_CONFIG).forEach(function (sheetName) {
    ensureSheet_(spreadsheet, sheetName, SHEET_CONFIG[sheetName]);
  });
}

function buildStateForUser_(access) {
  var state = readFullState_();
  var isAdmin = access.role === "admin";
  var isEmployee = access.role === "employee";
  var allowedLocations = access.managedLocationIds || [];

  if (isAdmin) {
    return state;
  }

  if (isEmployee) {
    var employeeLocations = getEmployeeLocations_(state.employees, access.employeeId);
    return {
      meta: state.meta,
      locations: state.locations.filter(function (row) {
        return intersects_(row.id ? [row.id] : [], employeeLocations);
      }),
      roles: state.roles,
      accessTypes: state.accessTypes,
      employees: state.employees.filter(function (row) {
        return intersects_(row.locations, employeeLocations);
      }),
      shifts: state.shifts.filter(function (row) {
        return employeeLocations.indexOf(row.locationId) !== -1 && row.status === "published";
      }),
      templates: [],
      locationSettings: state.locationSettings.filter(function (row) {
        return employeeLocations.indexOf(row.locationId) !== -1;
      }),
      users: state.users.filter(function (row) {
        return row.email === access.email;
      }),
      requests: state.requests.filter(function (row) {
        return row.employeeId === access.employeeId;
      }),
    };
  }

  return {
    meta: state.meta,
    locations: state.locations.filter(function (row) {
      return allowedLocations.indexOf(row.id) !== -1;
    }),
    roles: state.roles,
    accessTypes: state.accessTypes,
    employees: state.employees.filter(function (row) {
      return intersects_(row.locations, allowedLocations);
    }),
    shifts: state.shifts.filter(function (row) {
      return allowedLocations.indexOf(row.locationId) !== -1;
    }),
    templates: state.templates.filter(function (row) {
      return intersects_(row.locationIds, allowedLocations);
    }),
    locationSettings: state.locationSettings.filter(function (row) {
      return allowedLocations.indexOf(row.locationId) !== -1;
    }),
    users: state.users.filter(function (row) {
      return row.email === access.email;
    }),
    requests: state.requests.filter(function (row) {
      return scopedEmployeeIds_(state.employees, allowedLocations).indexOf(row.employeeId) !== -1;
    }),
  };
}

function writeFullState_(payload) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  bootstrapSheets_();

  writeRows_(spreadsheet.getSheetByName("locations"), SHEET_CONFIG.locations, payload.locations || []);
  writeRows_(spreadsheet.getSheetByName("roles"), SHEET_CONFIG.roles, payload.roles || []);
  writeRows_(spreadsheet.getSheetByName("accessTypes"), SHEET_CONFIG.accessTypes, payload.accessTypes || []);
  writeRows_(spreadsheet.getSheetByName("employees"), SHEET_CONFIG.employees, payload.employees || []);
  writeRows_(spreadsheet.getSheetByName("shifts"), SHEET_CONFIG.shifts, payload.shifts || []);
  writeRows_(spreadsheet.getSheetByName("templates"), SHEET_CONFIG.templates, payload.templates || []);
  writeRows_(spreadsheet.getSheetByName("locationSettings"), SHEET_CONFIG.locationSettings, payload.locationSettings || []);
  writeRows_(spreadsheet.getSheetByName("users"), SHEET_CONFIG.users, payload.users || []);
  writeRows_(spreadsheet.getSheetByName("requests"), SHEET_CONFIG.requests, payload.requests || []);

  PropertiesService.getScriptProperties().setProperty(
    "APP_META",
    JSON.stringify(payload.meta || { version: 1, syncedAt: new Date().toISOString() })
  );
}

function readFullState_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  bootstrapSheets_();

  var metaRaw = PropertiesService.getScriptProperties().getProperty("APP_META");
  var meta = metaRaw ? JSON.parse(metaRaw) : { version: 1, provider: "google-sheets" };

  return {
    meta: meta,
    locations: readRows_(spreadsheet.getSheetByName("locations"), SHEET_CONFIG.locations),
    roles: readRows_(spreadsheet.getSheetByName("roles"), SHEET_CONFIG.roles),
    accessTypes: readRows_(spreadsheet.getSheetByName("accessTypes"), SHEET_CONFIG.accessTypes),
    employees: readRows_(spreadsheet.getSheetByName("employees"), SHEET_CONFIG.employees),
    shifts: readRows_(spreadsheet.getSheetByName("shifts"), SHEET_CONFIG.shifts),
    templates: readRows_(spreadsheet.getSheetByName("templates"), SHEET_CONFIG.templates),
    locationSettings: readRows_(spreadsheet.getSheetByName("locationSettings"), SHEET_CONFIG.locationSettings),
    users: readRows_(spreadsheet.getSheetByName("users"), SHEET_CONFIG.users),
    requests: readRows_(spreadsheet.getSheetByName("requests"), SHEET_CONFIG.requests),
  };
}

function isAllowedNonAdminAction_(type) {
  return [
    "employee_request_created",
    "profile_or_availability_updated",
    "settings_updated",
    "request_status_changed",
    "shift_draft_updated",
    "schedule_submitted",
    "schedule_approved",
    "schedule_rejected",
    "employee_created",
    "employee_and_user_created",
    "employee_updated",
    "employee_removed",
    "user_created",
  ].indexOf(type) !== -1;
}

function getUserAccess_(email) {
  if (!email) {
    throw new Error("Missing userEmail");
  }

  var users = readRows_(SpreadsheetApp.getActiveSpreadsheet().getSheetByName("users"), SHEET_CONFIG.users);
  var user = users.filter(function (row) {
    return String(row.email || "").toLowerCase() === String(email).toLowerCase();
  })[0];

  if (!user) {
    throw new Error("This email is not allowed to access the scheduler.");
  }

  return user;
}

function authenticateUser_(lastName, pin) {
  if (!lastName || !pin) {
    throw new Error("Missing last name or PIN.");
  }

  var users = readRows_(SpreadsheetApp.getActiveSpreadsheet().getSheetByName("users"), SHEET_CONFIG.users);
  var user = users.filter(function (row) {
    return String(row.lastName || "").toLowerCase() === String(lastName).toLowerCase() && String(row.pin || "") === String(pin);
  })[0];

  if (!user) {
    throw new Error("Access denied. Check last name and PIN.");
  }

  return user;
}

function ensureSheet_(spreadsheet, sheetName, headers) {
  var sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return sheet;
  }

  var currentHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  var isMatching = headers.every(function (header, index) {
    return currentHeaders[index] === header;
  });

  if (!isMatching) {
    sheet.clearContents();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function writeRows_(sheet, headers, rows) {
  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);

  if (!rows.length) {
    return;
  }

  var values = rows.map(function (row) {
    return headers.map(function (header) {
      return serializeCell_(row[header]);
    });
  });

  sheet.getRange(2, 1, values.length, headers.length).setValues(values);
}

function readRows_(sheet, headers) {
  if (!sheet || sheet.getLastRow() < 2) {
    return [];
  }

  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  return values
    .filter(function (row) {
      return row.some(function (value) {
        return value !== "";
      });
    })
    .map(function (row) {
      var result = {};
      headers.forEach(function (header, index) {
        result[header] = deserializeCell_(header, row[index]);
      });
      return result;
    });
}

function serializeCell_(value) {
  if (Array.isArray(value)) {
    return value.join(",");
  }

  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }

  return value == null ? "" : value;
}

function deserializeCell_(header, value) {
  var listHeaders = ["locations", "tags", "availability", "locationIds", "roles", "managedLocationIds"];
  var numericHeaders = ["laborTarget", "hourlyRate", "weeklyHoursTarget", "publishCutoffHours", "overtimeWarningHours"];
  var booleanHeaders = ["approvalRequired"];

  if (listHeaders.indexOf(header) !== -1) {
    return String(value || "")
      .split(",")
      .map(function (item) {
        return item.trim();
      })
      .filter(Boolean);
  }

  if (numericHeaders.indexOf(header) !== -1) {
    return value === "" ? 0 : Number(value);
  }

  if (booleanHeaders.indexOf(header) !== -1) {
    return String(value).toUpperCase() === "TRUE";
  }

  return value;
}

function scopedEmployeeIds_(employees, allowedLocations) {
  return employees
    .filter(function (row) {
      return intersects_(row.locations, allowedLocations);
    })
    .map(function (row) {
      return row.id;
    });
}

function getEmployeeLocations_(employees, employeeId) {
  var employee = employees.filter(function (row) {
    return row.id === employeeId;
  })[0];
  return employee ? employee.locations : [];
}

function parseBody_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return {};
  }

  return JSON.parse(e.postData.contents);
}

function jsonResponse_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function intersects_(list, allowedLocations) {
  var values = Array.isArray(list) ? list : [];
  return values.some(function (value) {
    return allowedLocations.indexOf(value) !== -1;
  });
}

function sanitizeUser_(user) {
  return {
    id: user.id,
    name: user.name,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    employeeId: user.employeeId,
    managedLocationIds: user.managedLocationIds || [],
  };
}

function notifyByContext_(payload, context) {
  if (!context || !context.type) {
    return;
  }

  var employees = payload.employees || [];
  var users = payload.users || [];
  var requests = payload.requests || [];
  var shifts = payload.shifts || [];
  var locations = payload.locations || [];

  if (context.type === "employee_request_created") {
    var requestEmployee = findEmployeeById_(employees, context.employeeId);
    var requestManagers = managerAndAdminEmailsForLocations_(users, requestEmployee.locations || []);
    sendEmailList_(
      requestManagers,
      "New employee request",
      "<p><strong>" + safe_(requestEmployee.name) + "</strong> submitted a " + safe_(formatRequestType_(context.requestType)) + " request.</p>" +
        "<p>Review it in Botte Scheduling.</p>"
    );
    return;
  }

  if (context.type === "profile_or_availability_updated") {
    var availabilityEmployee = findEmployeeById_(employees, context.employeeId);
    var availabilityManagers = managerAndAdminEmailsForLocations_(users, availabilityEmployee.locations || []);
    sendEmailList_(
      availabilityManagers,
      "Employee profile or availability updated",
      "<p><strong>" + safe_(availabilityEmployee.name) + "</strong> updated profile or availability information.</p>" +
        "<p>Open the employee record or requests inbox to review the latest changes.</p>"
    );
    return;
  }

  if (context.type === "settings_updated") {
    var settingsRecipients = managerAndAdminEmailsForLocations_(users, context.locationIds || []);
    sendEmailList_(
      settingsRecipients,
      "Restaurant settings updated",
      "<p>Restaurant service settings were updated in Botte Scheduling.</p>" +
        "<p>Locations: " + safe_((context.locationIds || []).map(function (id) {
          return findLocationName_(locations, id);
        }).join(", ")) + "</p>"
    );
    return;
  }

  if (context.type === "request_status_changed") {
    var request = findRequestById_(requests, context.requestId);
    var employee = findEmployeeById_(employees, request.employeeId);
    sendEmailList_(
      [employee.email],
      "Request " + safe_(capitalizeText_(context.status)),
      "<p>Your " + safe_(formatRequestType_(request.type)) + " request has been <strong>" + safe_(context.status) + "</strong>.</p>" +
        "<p><strong>Dates:</strong> " + safe_(request.startDate || "Open") +
        (request.endDate ? " to " + safe_(request.endDate) : "") + "</p>" +
        "<p>" + safe_(request.note || "") + "</p>"
    );
    return;
  }

  if (context.type === "schedule_submitted") {
    var admins = getRoleEmails_(users, "admin");
    sendEmailList_(
      admins,
      "Schedule waiting for approval",
      buildScheduleEmailHtml_(payload, context, "A manager submitted a weekly plan for approval.")
    );
    return;
  }

  if (context.type === "schedule_approved") {
    var managersAndAdmins = managerAndAdminEmailsForLocations_(users, [context.locationId]);
    sendEmailList_(
      managersAndAdmins,
      "Schedule approved and live",
      buildScheduleEmailHtml_(payload, context, "The weekly plan has been approved and is now live.")
    );
    sendEmployeeScheduleEmails_(payload, context);
    return;
  }

  if (context.type === "schedule_rejected") {
    var recipients = managerAndAdminEmailsForLocations_(users, [context.locationId]);
    sendEmailList_(
      recipients,
      "Schedule rejected",
      buildScheduleEmailHtml_(payload, context, "The weekly plan was rejected.") +
        "<p><strong>Reason:</strong> " + safe_(context.reason || "No reason provided.") + "</p>"
    );
  }
}

function sendEmployeeScheduleEmails_(payload, context) {
  var weekShifts = getWeekLocationShifts_(payload.shifts || [], context.weekStartDate, context.locationId).filter(function (shift) {
    return shift.status === "published";
  });
  var grouped = {};
  weekShifts.forEach(function (shift) {
    grouped[shift.employeeId] = grouped[shift.employeeId] || [];
    grouped[shift.employeeId].push(shift);
  });

  Object.keys(grouped).forEach(function (employeeId) {
    var employee = findEmployeeById_(payload.employees || [], employeeId);
    var shifts = grouped[employeeId];
    var totalHours = shifts.reduce(function (sum, shift) {
      return sum + calculateHours_(shift.start, shift.end);
    }, 0);
    var html = buildEmployeeWeeklyScheduleHtml_(payload, context, employee, shifts, totalHours);
    sendEmailList_([employee.email], "Your weekly schedule", html);
  });
}

function buildScheduleEmailHtml_(payload, context, intro) {
  var locationName = findLocationName_(payload.locations || [], context.locationId);
  var weekShifts = getWeekLocationShifts_(payload.shifts || [], context.weekStartDate, context.locationId);
  var totalHours = weekShifts.reduce(function (sum, shift) {
    return sum + calculateHours_(shift.start, shift.end);
  }, 0);
  var totalCost = weekShifts.reduce(function (sum, shift) {
    var employee = findEmployeeById_(payload.employees || [], shift.employeeId);
    return sum + calculateHours_(shift.start, shift.end) * Number(employee.hourlyRate || 0);
  }, 0);

  return "<p>" + safe_(intro) + "</p><p><strong>Location:</strong> " + safe_(locationName) + "</p>" +
    "<p><strong>Week:</strong> " + safe_(context.weekStartDate) + "</p>" +
    "<p><strong>Total scheduled hours:</strong> " + totalHours.toFixed(1) + "</p>" +
    "<p><strong>Total labor cost:</strong> $" + totalCost.toFixed(2) + "</p>" +
    buildScheduleBreakdownHtml_(payload, weekShifts);
}

function buildScheduleBreakdownHtml_(payload, weekShifts) {
  if (!weekShifts.length) {
    return "<p>No shifts in this weekly plan.</p>";
  }

  var grouped = {};
  weekShifts.forEach(function (shift) {
    grouped[shift.date] = grouped[shift.date] || [];
    grouped[shift.date].push(shift);
  });

  return Object.keys(grouped).sort().map(function (date) {
    return "<h4>" + safe_(formatDateLabel_(date)) + "</h4><ul>" +
      grouped[date].map(function (shift) {
        var employee = findEmployeeById_(payload.employees || [], shift.employeeId);
        var shiftCost = calculateHours_(shift.start, shift.end) * Number(employee.hourlyRate || 0);
        return "<li><strong>" + safe_(employee.name) + "</strong> · " +
          safe_(shift.start) + " - " + safe_(shift.end) + " · $" + shiftCost.toFixed(2) +
          " · " + safe_(capitalizeText_(shift.status)) + "</li>";
      }).join("") + "</ul>";
  }).join("");
}

function buildEmployeeWeeklyScheduleHtml_(payload, context, employee, shifts, totalHours) {
  return "<p>Your weekly schedule is now live.</p>" +
    "<p><strong>Week:</strong> " + safe_(context.weekStartDate) + "</p>" +
    "<p><strong>Total hours:</strong> " + totalHours.toFixed(1) + "</p>" +
    "<ul>" + shifts.sort(function (a, b) {
      return a.date.localeCompare(b.date) || a.start.localeCompare(b.start);
    }).map(function (shift) {
      return "<li>" + safe_(formatDateLabel_(shift.date)) + " · " +
        safe_(findLocationName_(payload.locations || [], shift.locationId)) + " · " +
        safe_(shift.start) + " - " + safe_(shift.end) + "</li>";
    }).join("") + "</ul>" +
    "<p>Open Botte Scheduling anytime to review the full team schedule.</p>";
}

function getWeekLocationShifts_(shifts, weekStartDate, locationId) {
  if (!weekStartDate || !locationId) {
    return [];
  }
  var start = new Date(weekStartDate + "T12:00:00");
  var dates = [];
  for (var i = 0; i < 7; i += 1) {
    var current = new Date(start);
    current.setDate(start.getDate() + i);
    dates.push(current.toISOString().slice(0, 10));
  }
  return shifts.filter(function (shift) {
    return shift.locationId === locationId && dates.indexOf(shift.date) !== -1;
  });
}

function managerAndAdminEmailsForLocations_(users, locationIds) {
  var emails = [];
  users.forEach(function (user) {
    var isAdmin = user.role === "admin";
    var isManager = user.role === "manager" && intersects_(user.managedLocationIds || [], locationIds || []);
    if ((isAdmin || isManager) && user.email) {
      emails.push(user.email);
    }
  });
  return unique_(emails);
}

function getRoleEmails_(users, role) {
  return unique_(users.filter(function (user) {
    return user.role === role && user.email;
  }).map(function (user) {
    return user.email;
  }));
}

function sendEmailList_(emails, subject, htmlBody) {
  var recipients = unique_(emails || []).filter(Boolean);
  if (!recipients.length) {
    return;
  }
  MailApp.sendEmail({
    to: recipients.join(","),
    subject: subject,
    htmlBody: htmlBody,
  });
}

function findEmployeeById_(employees, id) {
  return employees.filter(function (item) {
    return item.id === id;
  })[0] || {};
}

function findRequestById_(requests, id) {
  return requests.filter(function (item) {
    return item.id === id;
  })[0] || {};
}

function findLocationName_(locations, id) {
  var match = locations.filter(function (item) {
    return item.id === id;
  })[0];
  return match ? match.name : id;
}

function calculateHours_(start, end) {
  var startParts = String(start).split(":");
  var endParts = String(end).split(":");
  var total = Number(endParts[0]) + Number(endParts[1]) / 60 - (Number(startParts[0]) + Number(startParts[1]) / 60);
  if (total < 0) {
    total += 24;
  }
  return total;
}

function unique_(items) {
  var seen = {};
  return items.filter(function (item) {
    if (seen[item]) {
      return false;
    }
    seen[item] = true;
    return true;
  });
}

function safe_(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function capitalizeText_(value) {
  var text = String(value || "");
  return text ? text.charAt(0).toUpperCase() + text.slice(1).replace(/_/g, " ") : "";
}

function formatRequestType_(value) {
  return capitalizeText_(String(value || "").replace(/_/g, " "));
}

function formatDateLabel_(isoDate) {
  var date = new Date(isoDate + "T12:00:00");
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "EEE MMM d");
}
