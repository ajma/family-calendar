import { annotateEvents, filterHiddenAttendees, buildEmailMap, normalizeAttendees } from '../annotateEnrichment';

// ─── Helpers ────────────────────────────────────────────────────────────────

const makeEvent = (overrides = {}) => ({
  id: 'evt-1',
  summary: 'Team Standup',
  _calendarId: 'cal-work',
  start: { dateTime: '2024-03-13T09:00:00Z' },
  end: { dateTime: '2024-03-13T09:30:00Z' },
  ...overrides,
});

const ALICE = { email: 'alice@example.com', name: 'Alice', initials: 'AL', color: '#ff6b6b', show: true };
const BOB = { email: 'bob@example.com', name: 'Bob', initials: 'BO', color: '#4ecdc4', show: true };

// ─── buildEmailMap & normalizeAttendees ───────────────────────────────────────

describe('Attendee Normalization Utilities', () => {
  const CHARLIE = { 
    email: 'charlie@primary.com', 
    name: 'Charlie', 
    alternateEmails: ['charlie@work.com', 'charlie@home.com'] 
  };

  it('buildEmailMap maps both primary and alternate emails to the same person', () => {
    const map = buildEmailMap([CHARLIE]);
    expect(map.get('charlie@primary.com')).toEqual(CHARLIE);
    expect(map.get('charlie@work.com')).toEqual(CHARLIE);
    expect(map.get('charlie@home.com')).toEqual(CHARLIE);
  });

  it('normalizeAttendees dedups based on identity but PRESERVES original attendee data', () => {
    const emailMap = buildEmailMap([CHARLIE]);
    const attendees = [
      { email: 'charlie@work.com', displayName: 'Charlie Work' },
      { email: 'charlie@home.com', displayName: 'Charlie Home' }, // Should be dropped
      { email: 'guest@other.com', displayName: 'Guest' }
    ];
    
    const result = normalizeAttendees(attendees, emailMap);
    
    expect(result).toHaveLength(2);
    // Verified: First occurrence preserved
    expect(result[0].email).toBe('charlie@work.com'); 
    expect(result[0].displayName).toBe('Charlie Work');
    expect(result[1].email).toBe('guest@other.com');
  });
});

// ─── annotateEvents ────────────────────────────────────────────────────────────

describe('annotateEvents', () => {
  describe('emoji prefix', () => {
    it('prepends the calendar emoji to the event summary', () => {
      const events = [makeEvent({ summary: 'Standup' })];
      const configs = { 'cal-work': { emoji: '💼' } };
      const [result] = annotateEvents(events, configs, []);
      expect(result.summary).toBe('💼 Standup');
    });

    it('does not modify summary when no emoji is configured', () => {
      const events = [makeEvent({ summary: 'Standup' })];
      const [result] = annotateEvents(events, { 'cal-work': {} }, []);
      expect(result.summary).toBe('Standup');
    });

    it('does not crash when the event has no summary', () => {
      const events = [makeEvent({ summary: undefined })];
      const configs = { 'cal-work': { emoji: '💼' } };
      expect(() => annotateEvents(events, configs, [])).not.toThrow();
    });
  });

  describe('auto-attendee assignment', () => {
    it('adds the assigned person as an attendee when they are not already present', () => {
      const events = [makeEvent()];
      const configs = { 'cal-work': { assignment: ALICE.email } };
      const [result] = annotateEvents(events, configs, [ALICE]);
      expect(result.attendees).toHaveLength(1);
      expect(result.attendees[0].email).toBe(ALICE.email);
      expect(result.attendees[0].responseStatus).toBe('accepted');
    });

    it('does not add the assigned person as a duplicate if already an attendee', () => {
      const existing = { email: ALICE.email, displayName: 'Alice', responseStatus: 'accepted' };
      const events = [makeEvent({ attendees: [existing] })];
      const configs = { 'cal-work': { assignment: ALICE.email } };
      const [result] = annotateEvents(events, configs, [ALICE]);
      expect(result.attendees).toHaveLength(1);
    });

    it('does nothing if the assigned email does not match any person in peopleDB', () => {
      const events = [makeEvent()];
      const configs = { 'cal-work': { assignment: 'ghost@example.com' } };
      const [result] = annotateEvents(events, configs, [ALICE]);
      expect(result.attendees).toBeUndefined();
    });
  });

  describe('#allfamily tag', () => {
    it('adds every person in peopleDB as an attendee for #allfamily events', () => {
      const events = [makeEvent({ description: 'Birthday party! #allfamily' })];
      const [result] = annotateEvents(events, {}, [ALICE, BOB]);
      expect(result.attendees).toHaveLength(2);
      const emails = result.attendees.map(a => a.email);
      expect(emails).toContain(ALICE.email);
      expect(emails).toContain(BOB.email);
    });

    it('is case-insensitive: #ALLFAMILY triggers the same behaviour', () => {
      const events = [makeEvent({ description: '#ALLFAMILY dinner' })];
      const [result] = annotateEvents(events, {}, [ALICE, BOB]);
      expect(result.attendees).toHaveLength(2);
    });

    it('does not add a person who is already an attendee (no duplicates)', () => {
      const existing = { email: ALICE.email, displayName: 'Alice', responseStatus: 'accepted' };
      const events = [makeEvent({ description: '#allfamily', attendees: [existing] })];
      const [result] = annotateEvents(events, {}, [ALICE, BOB]);
      const aliceCount = result.attendees.filter(a => a.email === ALICE.email).length;
      expect(aliceCount).toBe(1);
      expect(result.attendees).toHaveLength(2); // Alice (existing) + Bob
    });

    it('leaves events without #allfamily untouched', () => {
      const events = [makeEvent({ description: 'Regular meeting' })];
      const [result] = annotateEvents(events, {}, [ALICE, BOB]);
      expect(result.attendees).toBeUndefined();
    });
  });

  it('does not mutate the original event objects', () => {
    const original = makeEvent({ summary: 'Original' });
    annotateEvents([original], { 'cal-work': { emoji: '💼' } }, []);
    expect(original.summary).toBe('Original');
  });
});

// ─── filterHiddenAttendees ────────────────────────────────────────────────────

describe('filterHiddenAttendees', () => {
  it('removes attendees whose person record has show: false (including alternate emails)', () => {
    const hiddenAlice = { ...ALICE, show: false, alternateEmails: ['alice@alternate.com'] };
    const events = [makeEvent({ attendees: [{ email: 'alice@alternate.com' }] })];
    const [result] = filterHiddenAttendees(events, [hiddenAlice]);
    expect(result.attendees).toHaveLength(0);
  });

  it('removes attendees whose person record has show: false', () => {
    const hiddenBob = { ...BOB, show: false };
    const events = [makeEvent({ attendees: [{ email: ALICE.email }, { email: BOB.email }] })];
    const [result] = filterHiddenAttendees(events, [ALICE, hiddenBob]);
    expect(result.attendees).toHaveLength(1);
    expect(result.attendees[0].email).toBe(ALICE.email);
  });

  it('keeps attendees who are visible (show: true)', () => {
    const events = [makeEvent({ attendees: [{ email: ALICE.email }] })];
    const [result] = filterHiddenAttendees(events, [ALICE]);
    expect(result.attendees).toHaveLength(1);
  });

  it('keeps attendees not found in peopleDB (guest / unknown person)', () => {
    const events = [makeEvent({ attendees: [{ email: 'guest@external.com' }] })];
    const [result] = filterHiddenAttendees(events, [ALICE]);
    expect(result.attendees).toHaveLength(1);
  });

  it('deduplicates attendees when called (handles post-merge cleanup)', () => {
    const CHARLIE = { email: 'charlie@primary.com', name: 'Charlie', alternateEmails: ['charlie@work.com'] };
    const attendees = [{ email: 'charlie@primary.com' }, { email: 'charlie@work.com' }];
    const events = [makeEvent({ attendees })];
    
    const [result] = filterHiddenAttendees(events, [CHARLIE]);
    
    expect(result.attendees).toHaveLength(1);
    expect(result.attendees[0].email).toBe('charlie@primary.com');
  });

  it('returns events without attendees unchanged', () => {
    const events = [makeEvent()];
    const [result] = filterHiddenAttendees(events, [ALICE]);
    expect(result.attendees).toBeUndefined();
  });
});
