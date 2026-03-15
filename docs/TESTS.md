# Test Suite Coverage

This document outlines the test coverage for the `family-calendar` project. The suite uses **Vitest**, **React Testing Library**, and **Supertest**.

**Total: 84 tests across 11 files.**

To run:

```bash
npm run test
```

---

### `web/__tests__/PresentationMode.test.jsx`

- **Sequential Reveal**: Verifies that events are hidden initially and appear one by one via "Next" button/Right Arrow.
- **Header Simplification**: Confirms that other buttons are hidden during presentation.
- **Keyboard Navigation**: Verifies that Arrow keys and Escape key function correctly.
- **Sorting Logic**: Ensures all-day events are revealed before timed events on the same day.
- **Exit Logic**: Ensures all UI elements reappear after exiting.

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

### `web/utils/__tests__/eventEnrichment.test.js`

Tests for the pure `annotateEvents` and `filterHiddenAttendees` utilities.

#### `annotateEvents`

- Prepends the calendar emoji to the event summary.
- Does not modify summary when no emoji is configured.
- Does not crash when the event has no summary.
- Adds the assigned person as an attendee when not already present (normalized to primary identity).
- Does not add the assigned person as a duplicate if already an attendee.
- Does nothing if the assigned email doesn't match any person in `peopleDB`.
- **Normalization**: Ensures attendees resolved via alternate emails are converted to their primary email and name.
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

### `web/components/__tests__/CalendarHeader.test.jsx`

- Renders correctly for a week within the same month.
- Renders correctly across a month boundary.
- Renders correctly across a year boundary.
- Calls `onNext`, `onPrev`, `onToday`, and `onRefresh` when navigation buttons are clicked.

---

### `web/components/__tests__/SettingsModal.test.jsx`

- **Vertical Navigation**: Verifies that user can switch between Calendars, Attendees, Account, and Debug tabs.
- **Unsaved Changes Guard**: Confirms that trying to close (Escape/Cancel) after a change triggers a confirmation prompt.
- **Tab Persistence**: Verifies that changes made in one tab (e.g. attendee name) are preserved when switching to another tab before saving.
- **Unified Save**: Confirms that one "Save Changes" click persists both calendar configurations and people records.
- **Calendars Tab**:
    - Renders a checkbox for each calendar.
    - Sorting: Lists calendars alphabetically.
    - Emoji Picker: Toggles picker visibility; verifies emoji selection/removal.
    - Auto-Assignment: Confirms that people can be associated with specific calendars.
- **Attendees Tab**:
    - CRUD: Allows editing names, emails, and colors.
    - Initials Logic: Automatically generates 2-letter uppercase initials.
    - **Merging**: Verifies that merging one person into another deletes the source and adds their email to `alternateEmails`.
    - **Unmerging**: Verifies that clicking (x) on an alternate email removes it and creates a new standalone attendee.
    - **Deduplication**: Verifies that if multiple emails for the same merged person are in one event, only one avatar is shown.
- **Account Tab**:
    - Identity: Displays the currently logged-in user email.
    - Sign Out: Triggers the logout flow.
- **Debug Tab**:
    - Admin-Only: Only visible when `isAdmin` is true.
    - Safety: Displays a prominent warning disclaimer.
    - Factory Reset: Verifies the two-stage "DELETE" confirmation flow before wiping data.
- **Keyboard Navigation**: Closes the dialog via **Escape** (with dirty check).

---

### `web/components/__tests__/WeekGrid.test.jsx`

- Always renders exactly 7 day columns.
- Week starts on Monday.
- Week ends on Sunday.
- Places an event on the correct day column.
- Verifies that no "No events" empty state text is shown (removed in favor of clean UI).
- Handles all-day events (`start.date` only) on the correct day (verifies placement by column index to prevent timezone shifts).
- **Multiday Support**: Verifies that a 3-day all-day event appears in exactly 3 columns.
- **Midnight Spanning**: Verifies that a timed event spanning midnight (e.g. 10 PM to 2 AM) appears in both columns.
- Ignores events that fall outside the current week.
- Correctly calculates the week when the current day is Sunday (edge case).
- **Sorting Logic**: Ensures all-day events appear at the top of the day.

---

### `web/components/__tests__/DayColumn.test.tsx`

- **Visual Sorting**: Verifies that all-day events are rendered before (at the top of) timed events within the same day.
- **Chronological Order**: Verifies that timed events are sorted by start time after any all-day events.

---

### `web/components/__tests__/EventCard.test.jsx`

- Renders the event summary.
- Shows "Untitled Event" when summary is missing.
- **Calculates a smaller font size** for very long titles to ensure visibility without truncation.
- Shows "All Day" when the event has no `start.dateTime`.
- **Multiday Time Display**:
    - Shows full range for same-day events.
    - Day 1: Shows `start time →` (e.g. `10:00 PM →`).
    - Final Day: Shows `→ end time` (e.g. `→ 2:00 AM`).
    - Middle Days: Shows `All Day`.
- Does not render the attendee row when there are no attendees.
- Renders one avatar per attendee (up to 6).
- Shows a `+N` overflow badge when there are more than 6 attendees.
- Does not show an overflow badge for exactly 6 attendees.
- Uses a gradient border when multiple attendees have different colors.

---

### `web/__tests__/KeyboardShortcuts.test.jsx`

- **Week Navigation**: Verifies that `ArrowLeft` and `ArrowRight` trigger clicks on the previous and next week buttons respectively.
- **Presentation Trigger**: Verifies that `Space` triggers the "Present" button click from the main view.
- **Presentation Navigation**:
    - `ArrowRight` or `Space` triggers the "Next" (>) button in presentation mode.
    - `ArrowLeft` triggers the "Previous" (<) button in presentation mode.
    - `Escape` triggers the "End" button click to exit presentation mode.
- **Input Inhibition**: Confirms that global shortcuts are disabled when typing in any input field or within the Settings modal.
- **Help Shortcut**: Verifies that `?`, `h`, or `H` opens the User Guide.
- **Focused Button Reliability**: A regression test ensuring that shortcuts (like ArrowRight) still work even when a button (like "End") has browser focus.
- **Button Mapping**: Ensures that every keyboard shortcut literally triggers a `click()` on a DOM element for consistent behavior.
