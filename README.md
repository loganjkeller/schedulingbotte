# Botte Scheduling

Free-stack scheduling web app starter for a multi-location restaurant business.

## Recommended stack

- Frontend: static HTML, CSS, and JavaScript hosted on GitHub Pages
- Live backend: Google Apps Script Web App
- Database: Google Sheets tabs for `locations`, `employees`, `shifts`, `templates`, `settings`, and `users`
- Auth approach: manager/admin email allowlist stored in Google Sheets and enforced in Apps Script

## What is included

- Weekly scheduling dashboard
- Admin, manager, and employee role views
- Admin-only backend configuration screen
- Manager-scoped employee management and scheduling
- Employee self-service for profile, requests, and availability updates
- Four seeded restaurant locations
- Team directory with future `Botte Employees` external IDs
- Requests inbox and dashboard metrics
- Copy-last-week scheduling
- Local demo storage for quick iteration without a backend
- Remote load/sync controls for Google Apps Script
- Apps Script backend scaffold in `backend/google-apps-script`

## Why GitHub Pages + Google Sheets works here

GitHub Pages can host the UI for free, but it cannot securely store server secrets or enforce real backend authorization by itself. The safe free option is:

1. GitHub Pages hosts the frontend.
2. Google Apps Script receives requests and writes to Google Sheets.
3. Google Sheets acts as the editable database.
4. Apps Script checks whether the current user is an admin or manager before returning or updating data.

## Suggested Google Sheet tabs

### `locations`

| id | name | city | timezone | laborTarget |
| --- | --- | --- | --- | --- |
| loc-nolita | Nolita | New York | America/New_York | 0.29 |

### `employees`

| id | name | roleId | locations | hourlyRate | weeklyHoursTarget | externalEmployeeId |
| --- | --- | --- | --- | --- | --- | --- |
| emp-alessia | Alessia Romano | role-gm | loc-nolita,loc-soho | 32 | 45 | BE-1001 |

### `shifts`

| id | date | locationId | employeeId | roleId | start | end | status | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| shift-1 | 2026-03-16 | loc-nolita | emp-alessia | role-gm | 08:00 | 17:00 | published | Vendor check-in |

### `users`

| id | name | email | role | managedLocationIds |
| --- | --- | --- | --- | --- |
| user-admin | Logan Admin | owner@botte.com | admin | loc-nolita,loc-soho,loc-brooklyn,loc-miami |

## GitHub Pages deployment

1. Create a GitHub repository and push this project.
2. In GitHub, open `Settings` -> `Pages`.
3. Under `Build and deployment`, choose `Deploy from a branch`.
4. Select your main branch and root folder.
5. Save, then wait for the site URL to appear.

Because this project is pure static files, no build step is required.

## Google Apps Script deployment

1. Create a Google Sheet and add the tabs described above.
2. Open [Google Apps Script](https://script.google.com/).
3. Create a new project attached to that sheet.
4. Copy the files from `backend/google-apps-script` into the Apps Script project.
5. Run `bootstrapSheets_()` once to create the required tabs.
6. Add your admin email into the `users` sheet.
7. Deploy the script as a web app.
8. Paste that web app URL and your Sheet ID into the app’s Admin Backend screen.

If you already had the older version connected, update the Apps Script code, rerun `bootstrapSheets_()`, and redeploy so the new `requests` and employee profile fields exist in the sheet schema.

## Current remote workflow

1. Keep the frontend on GitHub Pages.
2. Use the app in `Local demo storage` mode while configuring your Sheet.
3. Switch the backend mode to `Google Apps Script + Sheets`.
4. Click `Load remote data` to pull from Sheets.
5. Click `Sync local to remote` to push the app state into Sheets.

The current starter backend checks a `userEmail` field against the `users` sheet. That is a practical internal prototype, but it is not strong production-grade authentication yet.

## Future integration with Botte Employees

The data model already includes `externalEmployeeId` for each employee. That gives you a clean path to later:

- sync employee master records from Botte Employees into this scheduler
- send published schedules back into Botte Employees
- connect PTO requests, availability updates, and acknowledgement flows

## Next steps I recommend

1. Upgrade the current email-based access check to a stronger login flow.
2. Add edit/delete shift actions and conflict validation.
3. Add employee self-service views once you connect Botte Employees.
4. Add payroll export and labor forecasting by location.
