# Family Calendar

Family Calendar is a helpful web application that allows you to seamlessly unify multiple Google Calendars into one beautiful weekly view. 

## Features

- **OAuth 2.0 Google Integration:** Securely sign in with your Google account. The app requests readonly access to your calendar list and events.
- **Multi-Calendar Support:** Select any number of calendars (Personal, Work, Family, etc.) you want to view simultaneously. Events from all selected calendars are merged into a single timeline.
- **Cross-Calendar Deduplication:** If the same event was shared across multiple calendars, CalendarSync will intelligently merge them together and present it as one event, preventing duplicated clutter.
- **Auto-Attendee Linking:** Assign each calendar a specific 'Person' from your local database. When CalendarSync downloads an event from that calendar, it will automatically stamp that person as an attendee!
- **Attendee Editor:** Not happy with randomly assigned display names or colors? Use the custom Attendee Editor to tweak user display names, their two-letter initials, and their specific unique UI color palette.
- **Smart Filtering:** Automatically discards events marked as `private` or events that contain the hashtag `#ignore` in their description.
- **Family Events:** Add `#allfamily` to an event description to automatically flag every configured person in your system as an attendee.
- **Hidden Debug Panel:** Append `?debug=1` to the URL to reveal a secret debug menu for direct localStorage manipulation, useful for troubleshooting your data state.

## Technology Stack

- **Framework:** React
- **Build Tool:** Vite
- **Styling:** Vanilla CSS 
- **Google API Integration:** `@react-oauth/google` & Native Fetch API

## Getting Started

### Prerequisites

You must have a Google Cloud Platform account with the **Google Calendar API** enabled. You'll need to create OAuth 2.0 Client credentials authorized for `http://localhost:5173`.

### Installation

1. Clone or download this repository.
2. Install the necessary Node dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the root directory (where `package.json` is located) and populate it with your Google credentials:
   ```env
   VITE_GOOGLE_CLIENT_ID="YOUR_GOOGLE_CLIENT_ID"
   VITE_GOOGLE_API_KEY="YOUR_GOOGLE_API_KEY"
   ```
4. Start the Vite development server:
   ```bash
   npm run dev
   ```
5. Open up `http://localhost:5173` in your browser.

## Usage Guide

1. Click **Sign in with Google** on the top right.
2. Once authenticated, click the **Select Calendars** button.
3. Check the boxes for whichever calendars you want visible.
4. If you have custom attendee profiles, you can use the dropdown next to a calendar name to **auto-assign** that person to all events from that calendar.
5. Hit Apply, and enjoy your synced weekly calendar view!
6. Use the **Edit Attendees** to rename or recolor attendees dynamically.

## License

This project is open-source and available under the standard MIT License.
