# Test Suite Coverage

This document outlines the test coverage for the `family-calendar` project. The test suite focuses on validating frontend components and backend API endpoints using Vitest, React Testing Library, and Supertest.

## Backend Tests

Location: `server/__tests__/api.test.js`

### 1. `GET /api/settings`
- **Authentication**: Validates that a `401 Unauthorized` status is returned when an invalid or missing `Authorization` header is provided.
- **Initial State**: Ensures that making a request with a valid token returns an empty settings object initially (`{ calendarConfigs: {}, people: [] }`).

### 2. `PUT /api/settings`
- **Data Persistence**: Validates that updating the `calendarConfigs` and `people` successfully saves the data, and that subsequent `GET` requests retrieve the updated persisted configuration correctly.

## Frontend Component Tests

Location: `src/components/__tests__/`

### 1. CalendarHeader (`CalendarHeader.test.jsx`)
- **Same Month Render**: Validates that weeks within the same month are displayed accurately (e.g., "March 9-15, 2026").
- **Month Boundary Render**: Validates weeks crossing month boundaries are accurately represented (e.g., "Feb 23 - Mar 1, 2026").
- **Year Boundary Render**: Validates weeks crossing year boundaries are formatted clearly (e.g., "Dec 29, 2025 - Jan 4, 2026").
- **User Interactions**: Simulates interface clicks and ensures the correct component callback functions (`onNext`, `onPrev`, `onToday`, `onRefresh`) are called when navigation buttons are pressed.

### 2. AttendeeEditor (`AttendeeEditor.test.jsx`)
- **Initial Render State**: Verifies the component does not render when `isOpen={false}`.
- **Add Attendee Functionality**: Verifies that clicking "Add Person" successfully inserts a new person template into the state and allows them to be correctly rendered.
- **Edit & Save Sequence**: Confirms that modifying an established attendee's name appropriately registers with the state and that the changes emit correctly into the `onSave` callback parameter when the "Save Changes" button is pressed.

### 3. DebugModal (`DebugModal.test.jsx`)
- **Data Load**: Validates that `localStorage` structures are properly parsed and injected into the Modal's editing `textarea`.
- **Advanced Save Handlers**: Automates a sequence where a user edits the JSON interface directly (changing attendee names and altering calendar selection status values). Verifies that the correct variables update concurrently via the `onBackendSave` functionality and the internal `localStorage` engine gracefully when saved.
