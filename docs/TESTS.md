# Test Suite Coverage

This document outlines the test coverage for the `family-calendar` project. The suite uses **Vitest**, **React Testing Library**, and **Supertest**.

**Total: 73 tests across 9 files.**

To run:

```bash
npm run test
```

---

## Backend Tests

### `server/__tests__/api.test.js`

#### `GET /api/health`

- Returns `200 { status: 'ok' }`.

#### `POST /api/auth`

- Returns `400` when no auth code is provided.
- Exchanges a valid code and returns a local `session_token` (JWT).
- Returns `500` if Google's token exchange fails (e.g. `invalid_grant`).

#### `GET /api/settings`

- Returns `401` when Authorization header is missing or invalid.
- Returns empty defaults (`{ calendarConfigs: {}, people: [] }`) for a new user.

#### `PUT /api/settings`

- Saves `calendarConfigs` and `people`; subsequent `GET` returns the persisted data.

#### `POST /api/settings/reset`

- Returns `403` for non-admin users.
- Wipes all settings when called by the configured `ADMIN_EMAIL`.

#### `GET /api/calendars`

- Returns `401` if local session JWT is invalid.
- Proxies Google's calendar list response to the client.

#### `GET /api/events`

- Returns `401` if local session JWT is invalid.
- Proxies Google's event list for selected calendars.
- **Deduplication**: Merges events shared across multiple calendars.
- **Filtering**: Discards private and `#ignore` events server-side.
- **Sorting**: Returns events in chronological order.
- Handles all-day events (`start.date` only) without crashing.
- **Graceful degradation**: Still returns events from healthy calendars when one calendar fetch fails.
- Appends a hashtag `q` query param when the calendar has a hashtag config.
- Does not append `q` when no hashtag is configured.

#### Settings persistence across logout / login

- **Round-trip**: Saving settings then re-fetching (simulating a fresh login with the same identity) returns the data intact — including nested calendar config fields and all people records.
- **User isolation**: Settings saved by one user are not visible to a different user.

---

### `server/__tests__/crypto.test.js`

- Encrypts and decrypts a string correctly.
- Produces different ciphertext for the same input (randomized IV).
- Returns `null` on decryption with a wrong key.
- Returns `null` when the ciphertext is corrupted.

---

## Frontend Tests

### `src/utils/__tests__/eventEnrichment.test.js`

Tests for the pure `annotateEvents` and `filterHiddenAttendees` utilities.

#### `annotateEvents`

- Prepends the calendar emoji to the event summary.
- Does not modify summary when no emoji is configured.
- Does not crash when the event has no summary.
- Adds the assigned person as an attendee when not already present.
- Does not add the assigned person as a duplicate if already an attendee.
- Does nothing if the assigned email doesn't match any person in `peopleDB`.
- `#allfamily`: Adds every person in `peopleDB` as an attendee.
- `#allfamily`: Case-insensitive (`#ALLFAMILY` works the same way).
- `#allfamily`: Does not add duplicates if a person is already an attendee.
- Leaves events without `#allfamily` untouched.
- Does not mutate the original event objects.

#### `filterHiddenAttendees`

- Removes attendees whose person record has `show: false`.
- Keeps attendees who are visible (`show: true`).
- Keeps attendees not found in `peopleDB` (external guests).
- Returns events without attendees unchanged.

---

### `src/components/__tests__/CalendarHeader.test.jsx`

- Renders correctly for a week within the same month.
- Renders correctly across a month boundary.
- Renders correctly across a year boundary.
- Calls `onNext`, `onPrev`, `onToday`, and `onRefresh` when navigation buttons are clicked.

---

### `src/components/__tests__/AttendeeEditor.test.jsx`

- Does not render when `isOpen={false}`.
- Renders existing people and allows adding a new person.
- Allows editing a person's name and emits the updated data via `onSave`.

---

### `src/components/__tests__/DebugModal.test.jsx`

- Loads `localStorage` data into the editing textarea.
- Saves edited JSON to `localStorage` and calls `onBackendSave`.

---

### `src/components/__tests__/CalendarSelectorModal.test.jsx`

- Does not render when `isOpen={false}`.
- Renders a checkbox for each calendar.
- Sorts calendars alphabetically.
- Shows "No calendars found." when the list is empty.
- Checking a calendar marks it as selected.
- Unchecking a calendar marks it as not selected.
- "Cancel" does not call `onSave`.
- "Cancel" calls `onClose`.
- "Apply Changes" calls `onSave` with the updated config.
- "Apply Changes" calls `onClose` after saving.
- Shows the emoji picker button and hashtag input when a calendar is selected.
- Does not show emoji picker button when a calendar is not selected.
- Shows the emoji picker search/text area when the button is clicked.
- Shows assigned emoji in the button.
- Shows a plus sign (`＋`) when no emoji is assigned.
- Clears the emoji when "No Emoji" is clicked.
- Shows the person dropdown when a calendar is selected and people exist.

---

### `src/components/__tests__/WeekGrid.test.jsx`

- Always renders exactly 7 day columns.
- Week starts on Monday.
- Week ends on Sunday.
- Places an event on the correct day column.
- Shows "No events" in all 7 columns when the event list is empty.
- Does not show "No events" in a column that has an event.
- Handles all-day events (`start.date` only) on the correct day.
- Ignores events that fall outside the current week.
- Correctly calculates the week when the current day is Sunday (edge case).

---

### `src/components/__tests__/EventCard.test.jsx`

- Renders the event summary.
- Shows "Untitled Event" when summary is missing.
- **Calculates a smaller font size** for very long titles to ensure visibility without truncation.
- Shows "All Day" when the event has no `start.dateTime`.
- Does not render the attendee row when there are no attendees.
- Renders one avatar per attendee (up to 6).
- Shows a `+N` overflow badge when there are more than 6 attendees.
- Does not show an overflow badge for exactly 6 attendees.
- Uses a gradient border when multiple attendees have different colors.
