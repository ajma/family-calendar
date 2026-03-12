# Family Calendar

Family Calendar is a helpful web application that allows you to seamlessly unify multiple Google Calendars into one beautiful weekly view.

## Features

- **OAuth 2.0 Google Integration:** Securely sign in with your Google account. The app requests readonly access to your calendar list and events.
- **Multi-Calendar Support:** Select any number of calendars (Personal, Work, Family, etc.) you want to view simultaneously. Events from all selected calendars are merged into a single timeline.
- **Cross-Calendar Deduplication:** If the same event was shared across multiple calendars, CalendarSync will intelligently merge them together and present it as one event, preventing duplicated clutter.
- **Auto-Attendee Linking:** Assign each calendar a specific 'Person' from your local database. When CalendarSync downloads an event from that calendar, it will automatically stamp that person as an attendee!
- **Attendee Editor:** Not happy with randomly assigned display names or colors? Use the custom Attendee Editor to tweak user display names, their two-letter initials, and their specific unique UI color palette.
- **Persistent Settings:** Your calendar selections and custom attendees are saved to a localized SQLite database, meaning your setup is restored exactly as you left it every time you log in with your Google Account.
- **Smart Filtering:** Automatically discards events marked as `private` or events that contain the hashtag `#ignore` in their description.
- **Family Events:** Add `#allfamily` to an event description to automatically flag every configured person in your system as an attendee.
- **Hidden Debug Panel:** Append `?debug=1` to the URL to reveal a secret debug menu for direct state manipulation. Only visible to the configured `ADMIN_EMAIL`. Changes are synced safely to the backend database.
- **Admin Full Reset:** An admin can wipe the entire configuration database directly from the Debug Panel.

## Technology Stack

- **Frontend:** React + Vite
- **Backend:** Node.js + Express + `jsonwebtoken`
- **Database:** SQLite
- **Styling:** Vanilla CSS
- **Google API Integration:** `@react-oauth/google` (auth-code flow, server-side proxied)

## Getting Started

### Prerequisites

You must have a Google Cloud Platform account with the **Google Calendar API** enabled. You'll need to create OAuth 2.0 Client credentials (type: **Web application**) authorized for `http://localhost:5173`.

### Installation

1. Clone or download this repository.
2. Install the necessary Node dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the root directory (where `package.json` is located) and populate it with your Google credentials:
   ```env
   GOOGLE_CLIENT_ID="YOUR_GOOGLE_CLIENT_ID"
   GOOGLE_CLIENT_SECRET="YOUR_GOOGLE_CLIENT_SECRET"
   ADMIN_EMAIL="YOUR_EMAIL_ADDRESS"
   TOKEN_ENCRYPTION_KEY="[random-64-char-hex-string]"
   JWT_SECRET="[your-random-session-secret]"
   ```
   _Note: Use a secure random string for `TOKEN_ENCRYPTION_KEY` and `JWT_SECRET` in production!_
   Both the Client ID and Client Secret can be found in your [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials).
4. Start both the Vite development server and the Express backend concurrently:
   ```bash
   npm run dev
   ```
5. Open up `http://localhost:5173` in your browser.

### Docker Compose

Alternatively, you can run the application directly for production using Docker Compose. The Docker container runs both the API and the compiled frontend together on a unified port.

Here is an example `docker-compose.yml` configuration:

```yaml
services:
  family-calendar:
    image: ghcr.io/ajma/family-calendar:latest
    container_name: family-calendar
    ports:
      - "5173:5173"
    environment:
      - GOOGLE_CLIENT_ID=[YOUR_GOOGLE_CLIENT_ID]
      - GOOGLE_CLIENT_SECRET=[YOUR_GOOGLE_CLIENT_SECRET]
      - ADMIN_EMAIL=[EMAIL_ADDRESS]
      - TOKEN_ENCRYPTION_KEY=[random-64-char-hex-string]
      - JWT_SECRET=[your-random-session-secret]
    volumes:
      - ./data:/app/data
```

Run `docker compose up -d` to start the application. Note that the image must be built and published to your GitHub Container Registry, or you can build it locally.

## Usage Guide

1. Click **Sign in with Google** on the top right.
2. Once authenticated, click the **Select Calendars** button.
3. Check the boxes for whichever calendars you want visible.
4. If you have custom attendee profiles, you can use the dropdown next to a calendar name to **auto-assign** that person to all events from that calendar.
5. Hit Apply, and enjoy your synced weekly calendar view!
6. Use the **Edit Attendees** to rename or recolor attendees dynamically.

## Testing

This project includes a comprehensive test suite covering the backend API, event annotation logic, and all major UI components. For a detailed breakdown, refer to the [Test Suite Coverage documentation](./docs/TESTS.md).

To run the test suite locally:

```bash
npm run test
```

## License

This project is open-source and available under the standard MIT License.
