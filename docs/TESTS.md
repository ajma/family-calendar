# Test Suite Coverage

This document outlines the test coverage for the `family-calendar` project. The suite uses **Vitest**, **React Testing Library**, and **Supertest**.

**Total: 109 tests across 12 files.**

To run:

```bash
npm run test
```

---

### `web/__tests__/PresentationMode.test.tsx`

Full integration tests that render the real `App` component with mocked backend services. Each test explicitly sets up all required mocks (`checkAuthStatus`, `fetchSettings`, `fetchCalendars`, `fetchEvents`) and waits for events to load before entering presentation mode.

- **Sequential Reveal**: Verifies that events are hidden initially and appear one by one via "Next" button/Right Arrow.
- **Header Simplification**: Confirms that other buttons are hidden during presentation.
- **Keyboard Navigation**: Verifies that Arrow keys and Escape key function correctly.
- **Sorting Logic**: Ensures all-day events are revealed before timed events on the same day.
- **Exit Logic**: Ensures all UI elements reappear after exiting.

---

### `web/__tests__/Onboarding.test.tsx`

- **First-Time Flow**: Verifies that new users (indicated by `isNewUser: true`) are automatically shown the User Guide upon login.
- **Persistence**: Confirms that existing users are NOT shown the auto-popup.

---

## Backend Tests

### `server/__tests__/api.test.ts`

#### `POST /api/auth`

- Returns `400` when no auth code is provided.
- Exchanges a valid code and returns a local `session_token` (JWT).
- Returns `500` if Google's token exchange fails (e.g. `invalid_grant`).

#### `GET /api/settings`

- Returns `401` when Authorization header is missing or invalid.
- Returns empty defaults (`{ calendar_configs: {}, people: [] }`) for a new user.

#### `PUT /api/settings`

- Saves `calendar_configs` and `people`; subsequent `GET` returns the persisted data.

#### `POST /api/settings/reset`

- Returns `403` for non-admin users.
- Wipes all settings when called by the configured `ADMIN_EMAIL`.

#### Settings persistence across logout / login

- **Round-trip**: Saving settings then re-fetching (simulating a fresh login with the same identity) returns the data intact — including nested calendar config fields and all people records.
- **User isolation**: Settings saved by one user are not visible to a different user.

#### Token Refresh Optimization

- **Cached Token**: Does NOT call Google to refresh if the stored token is still valid (based on `token_expiry` with a 5-minute buffer).
- **Auto-Refresh**: Successfully calls Google to refresh and updates the database if the current token is expired.

---

### `server/__tests__/eventService.test.ts`

Tests for the `processEvents` utility that handles server-side event processing.

#### Deduplication

- Removes duplicate events by ID, keeping the first occurrence.
- Keeps the first occurrence when the same event appears across multiple calendars.

#### Filtering

- Filters out events with `visibility: 'private'`.
- Filters out events with `#ignore` in description.
- Keeps events without a description.
- Does not filter events with `visibility: 'default'`.

#### Sorting

- Sorts events chronologically by start time.
- Sorts all-day events before timed events on the same day.

#### Combined Behavior

- Deduplicates, filters, and sorts in one pass.
- Returns empty array for empty input.

---

### `server/__tests__/crypto.test.ts`

- Encrypts and decrypts a string correctly.
- Produces different ciphertext for the same input (randomized IV).
- Returns `null` on decryption with a wrong key.
- Returns `null` when the ciphertext is corrupted.

---

## Frontend Tests

### `web/utils/__tests__/annotateEnrichment.test.ts`

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
- **Universal Visibility**: Verified that an event is marked `_hidden` if its ID exists in *any* selected calendar's `hiddenEvents` list.
- Does not mutate the original event objects.

#### `filterHiddenAttendees`

- Removes attendees whose person record has `show: false`.
- Keeps attendees who are visible (`show: true`).
- Keeps attendees not found in `peopleDB` (external guests).
- Returns events without attendees unchanged.

---

### `web/components/__tests__/CalendarHeader.test.tsx`

- Renders correctly for a week within the same month.
- Renders correctly across a month boundary.
- Renders correctly across a year boundary.
- Calls `onNext`, `onPrev`, `onToday`, and `onRefresh` when navigation buttons are clicked.

---

### `web/components/__tests__/SettingsModal.test.tsx`

- **Vertical Navigation**: Verifies that user can switch between Calendars, Attendees, Account, and Debug tabs.
- **Custom Tab Guard**: Confirms that switching tabs with unsaved changes triggers a custom in-app dialog (Discard & Switch / Save & Switch).
- **Unsaved Changes Guard**: Confirms that trying to close (Escape/X) after a change triggers a confirmation prompt.
- **Exit Button**: Verifies that the sidebar **Exit** button correctly triggers the close flow.
- **Save Behavior**: 
    - **Persistence**: Clicking **Save** commits changes without closing the modal or resetting the active tab.
    - **Floating Button**: Sticky button labeled **Save**, disabled until changes are made.
- **Unified Save**: Confirms that one click persists both calendar configurations and people records.
- **Calendars Tab**:
    - Renders a checkbox for each calendar.
    - Sorting: Lists calendars alphabetically.
    - Emoji Picker: Toggles picker visibility; verifies emoji selection/removal.
    - **Multi-Person Auto-Assignment**: Confirms that multiple people can be associated with a single calendar via chip-based multi-select.
- **Attendee Tab**:
    - CRUD: Allows editing names, emails, and colors.
    - Initials Logic: Automatically generates 2-letter uppercase initials.
    - **Merging**: Verifies that merging one person into another deletes the source and adds their email to `alternateEmails`.
    - **Unmerging**: Verifies that clicking (x) on an alternate email removes it and creates a new standalone attendee.
- **Account Tab**:
    - Identity: Displays the currently logged-in user email.
    - Sign Out: Triggers the logout flow.
    - **Danger Zone**: Verifies that the factory reset section is visible and functional only within this tab.
    - **Admin-Only Visibility**: Confirmed via a dedicated test that the Danger Zone is hidden for non-admin users.
- **Debug Tab**:
    - Admin-Only: Only visible when `isAdmin` is true.
    - **Invalid JSON Support**: Verifies that even invalid JSON edits trigger the dirty state and enable the Save button.
    - **Spell Check**: Confirms spell check is disabled in the debug textarea.
- **Keyboard Navigation**: Closes the dialog via **Escape** (with dirty check).

---

### `web/components/__tests__/WeekGrid.test.tsx`

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

### `web/components/__tests__/EventCard.test.tsx`

- Renders the event summary.
- **Clickable Title**: Verifies the title links directly to the Google Calendar URL.
- Shows "Untitled Event" when summary is missing.
- **Calculates a smaller font size** for very long titles to ensure visibility without truncation.
- Shows "All Day" when the event has no `start.dateTime`.
- **Event Visibility Toggles**:
    - Verifies that a green circle (SolidCircleIcon) appears when visible.
    - Verifies that an empty circle (EmptyCircleIcon) appears when marked as hidden.
    - Confirms clicking the toggle calls `toggleHiddenEvent` with correct parameters.
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

### `web/__tests__/KeyboardShortcuts.test.tsx`

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
