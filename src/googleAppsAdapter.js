export async function pingAppsScript(url) {
  if (!url) {
    throw new Error("Missing Google Apps Script URL");
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "healthcheck" }),
  });

  if (!response.ok) {
    throw new Error(`Apps Script request failed with ${response.status}`);
  }

  return response.json();
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Apps Script request failed with ${response.status}`);
  }

  return response.json();
}

export async function fetchRemoteState(url, userEmail) {
  const result = await postJson(url, {
    action: "getState",
    userEmail,
  });

  if (!result.ok) {
    throw new Error(result.error || "Unable to load remote state");
  }

  return result.data;
}

export async function authenticateRemoteUser(url, lastName, pin) {
  const result = await postJson(url, {
    action: "authenticate",
    lastName,
    pin,
  });

  if (!result.ok) {
    throw new Error(result.error || "Unable to authenticate");
  }

  return result;
}

export async function syncRemoteState(url, state, userEmail, context = {}) {
  const result = await postJson(url, {
    action: "syncAll",
    userEmail,
    context,
    payload: buildAppsScriptPayload(state).payload,
  });

  if (!result.ok) {
    throw new Error(result.error || "Unable to sync remote state");
  }

  return result;
}

export async function sendRemoteTestEmail(url, userEmail, email) {
  const result = await postJson(url, {
    action: "testEmail",
    userEmail,
    email,
  });

  if (!result.ok) {
    throw new Error(result.error || "Unable to send test email");
  }

  return result;
}

export function buildAppsScriptPayload(state) {
  return {
    action: "syncAll",
    payload: {
      meta: state.meta,
      locations: state.locations,
      roles: state.roles,
      accessTypes: state.accessTypes,
      employees: state.employees,
      shifts: state.shifts,
      templates: state.templates,
      locationSettings: state.locationSettings,
      users: state.users,
      requests: state.requests,
    },
  };
}

export function createAppsScriptExample() {
  return `function doPost(e) {
  return handleRequest_(e);
}`;
}
