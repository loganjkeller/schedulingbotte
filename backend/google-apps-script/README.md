# Google Apps Script Backend

This folder contains a starter backend for the scheduling app.

## What it does

- creates the required Google Sheet tabs
- reads all scheduling data from Sheets
- filters data by manager location access
- allows admin users to sync the full app state into Sheets
- returns JSON for the GitHub Pages frontend

## Files

- `Code.gs`: backend handlers and Sheet helpers
- `appsscript.json`: Apps Script project settings

## Setup

1. Create a Google Sheet.
2. Open `Extensions` -> `Apps Script`.
3. Replace the default script with the contents of `Code.gs`.
4. Replace the project manifest with `appsscript.json`.
5. Run `bootstrapSheets_()` once from the Apps Script editor to create all tabs.
6. Add at least one admin row into the `users` tab with your real email.
7. Deploy as a web app.
8. Paste the web app URL into the admin backend screen in the frontend app.

## Actions supported

- `healthcheck`
- `bootstrapSheets`
- `getState`
- `syncAll`

## Current auth model

The frontend sends `userEmail` with each request, and Apps Script checks that email against the `users` sheet.

That is fine for a starter or internal prototype, but it is not strong authentication by itself. For production, you should upgrade this with a proper sign-in flow or deploy the web app with tighter access restrictions.
