# Test Suite Coverage

This document outlines the test coverage for the `family-calendar` project. The suite uses **Vitest**, **React Testing Library**, and **Supertest**.

**Total: 85 tests across 9 files.**

To run:
```bash
npm run test
```

---

## Backend Tests

### `server/__tests__/api.test.js`

#### `GET /api/settings`
- Returns `401` when Authorization header is missing or invalid.
- Returns empty defaults (`{ calendarConfigs: {}, people: [] }`) for a new user.

#### `PUT /api/settings`
- Saves `calendarConfigs` and `people`; subsequent `GET` returns the persisted data.

#### `POST /api/settings/reset`
- Returns `403` for non-admin users.
- Wipes all settings when called by the configured `ADMIN_EMAIL`.

#### `POST /api/auth/exchange`
- Returns `400` when no auth code is provided.
- Exchanges a valid code and returns `access_token` + `expiry_date`.
- Returns `500` if Google's token exchange fails (e.g. `invalid_grant`).

#### `POST /api/auth/refresh`
- Returns `401` when no Authorization header is present.
- Returns `401` when no refresh token is stored for the requesting user.
- Returns a new `access_token` and `expiry_date` when a valid refresh token exists.

#### Settings persistence across logout / login
- **Round-trip**: Saving settings then re-fetching (simulating a fresh login with the same identity) returns the data intact — including nested calendar config fields and all people records.
- **User isolation**: Settings saved by one user are not visible to a different user.

---

## Frontend Tests

### `src/services/__tests__/googleCalendar.test.js`

#### `fetchCalendars`
- Throws if no access token is provided.
- Returns an empty array when the API returns no items.
- Returns items from the API response.
- Throws a descriptive error on a non-OK response.

#### `fetchEvents`
- Throws if no access token is provided.
- Returns `[]` immediately for an empty `calendarIds` list (no network call made).
- Stamps each event with its source `_calendarId`.
- **Deduplication**: An event shared across two calendars appears exactly once.
- Keeps distinct events from multiple calendars.
- **Filtering**: Discards events with `visibility: "private"`.
- **Filtering**: Discards events with `#ignore` in their description.
- **Sorting**: Returns events in chronological order.
- Handles all-day events (`start.date` only) without crashing.
- **Graceful degradation**: Still returns events from healthy calendars when one calendar fetch fails.
- Appends a hashtag `q` query param when the calendar has a hashtag config.
- Does not append `q` when no hashtag is configured.

---

### `src/utils/__tests__/eventEnrichment.test.js`

Tests for the pure `annotateEvents` and `filterHiddenAttendees` utilities extracted from `App.jsx`.

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

### `src/components/__tests__/AttendeeEditor.test.jsx`
- Does not render when `isOpen={false}`.
- Renders existing people and allows adding a new person.
- Allows editing a person's name and emits the updated data via `onSave`.

### `src/components/__tests__/DebugModal.test.jsx`
- Loads `localStorage` data into the editing textarea.
- Saves edited JSON to `localStorage` and calls `onBackendSave`.

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
- Shows emoji and hashtag inputs when a calendar is selected.
- Does not show emoji input when a calendar is not selected.
- Saves emoji value when set.
- Removes the `emoji` key entirely (rather than setting it to `""`) when the field is cleared.
- Shows the person dropdown when a calendar is selected and people exist.

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

### `src/components/__tests__/EventCard.test.jsx`
- Renders the event summary.
- Shows "Untitled Event" when summary is missing.
- Shows "All Day" when the event has no `start.dateTime`.
- Does not render the attendee row when there are no attendees.
- Renders one avatar per attendee (up to 6).
- Shows a `+N` overflow badge when there are more than 6 attendees.
- Does not show an overflow badge for exactly 6 attendees.
- Uses a gradient border when multiple attendees have different colors.
