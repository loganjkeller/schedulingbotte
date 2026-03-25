var SHEET_CONFIG = {
  locations: ["id", "name", "city", "timezone", "laborTarget"],
  roles: ["id", "name", "color"],
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
  users: ["id", "name", "email", "role", "employeeId", "managedLocationIds"],
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

    if (action === "syncAll") {
      var syncAccess = getUserAccess_(request.userEmail);
      if (syncAccess.role !== "admin") {
        return jsonResponse_({ ok: false, error: "Only admins can sync all scheduling data." });
      }

      writeFullState_(request.payload || {});
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
    return {
      meta: state.meta,
      locations: state.locations.filter(function (row) {
        return intersects_(row.id ? [row.id] : [], getEmployeeLocations_(state.employees, access.employeeId));
      }),
      roles: state.roles,
      employees: state.employees.filter(function (row) {
        return row.id === access.employeeId;
      }),
      shifts: state.shifts.filter(function (row) {
        return row.employeeId === access.employeeId;
      }),
      templates: [],
      locationSettings: state.locationSettings.filter(function (row) {
        return getEmployeeLocations_(state.employees, access.employeeId).indexOf(row.locationId) !== -1;
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
    employees: readRows_(spreadsheet.getSheetByName("employees"), SHEET_CONFIG.employees),
    shifts: readRows_(spreadsheet.getSheetByName("shifts"), SHEET_CONFIG.shifts),
    templates: readRows_(spreadsheet.getSheetByName("templates"), SHEET_CONFIG.templates),
    locationSettings: readRows_(spreadsheet.getSheetByName("locationSettings"), SHEET_CONFIG.locationSettings),
    users: readRows_(spreadsheet.getSheetByName("users"), SHEET_CONFIG.users),
    requests: readRows_(spreadsheet.getSheetByName("requests"), SHEET_CONFIG.requests),
  };
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
