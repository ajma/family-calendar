import React, { useState, useEffect } from 'react';

const CalendarSelectorModal = ({ isOpen, onClose, calendars, selectedCalendars, calendarAssignments = {}, calendarHashtags = {}, people = [], onSave }) => {
  const [localSelection, setLocalSelection] = useState([]);
  const [localAssignments, setLocalAssignments] = useState({});
  const [localHashtags, setLocalHashtags] = useState({});

  useEffect(() => {
    if (isOpen) {
      setLocalSelection([...selectedCalendars]);
      setLocalAssignments({ ...calendarAssignments });
      setLocalHashtags({ ...calendarHashtags });
    }
  }, [isOpen, selectedCalendars, calendarAssignments, calendarHashtags]);

  const handleToggle = (calendarId) => {
    setLocalSelection(prev => {
      if (prev.includes(calendarId)) {
        return prev.filter(id => id !== calendarId);
      } else {
        // Auto-assign person if calendarId matches a person's email
        const personMatch = people.find(p => p.email === calendarId);
        if (personMatch) {
          setLocalAssignments(prevAssignments => ({
            ...prevAssignments,
            [calendarId]: personMatch.email
          }));
        }
        return [...prev, calendarId];
      }
    });
  };

  const handleAssignPerson = (calendarId, email) => {
    setLocalAssignments(prev => {
      const updated = { ...prev };
      if (!email) {
        delete updated[calendarId];
      } else {
        updated[calendarId] = email;
      }
      return updated;
    });
  };

  const handleHashtagChange = (calendarId, value) => {
    setLocalHashtags(prev => {
      const updated = { ...prev };
      if (!value || value.trim() === '') {
        delete updated[calendarId];
      } else {
        updated[calendarId] = value.trim();
      }
      return updated;
    });
  };

  const handleSave = () => {
    onSave(localSelection, localAssignments, localHashtags);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content glass" style={{ maxWidth: '500px' }}>
        <h2>Select Calendars to Sync</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          Choose which calendars you want to display events from in your weekly view.
        </p>

        <div className="attendee-list" style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: '1.5rem', paddingRight: '0.5rem' }}>
          {calendars.length === 0 ? (
            <div className="empty-state">No calendars found.</div>
          ) : (
            [...calendars].sort((a, b) => {
              const nameA = a.summaryOverride || a.summary || '';
              const nameB = b.summaryOverride || b.summary || '';
              return nameA.localeCompare(nameB);
            }).map(cal => (
              <label
                key={cal.id}
                className="attendee-list-item"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '1rem',
                  marginBottom: '0.5rem',
                  border: '1px solid var(--border-color)',
                  cursor: 'pointer',
                  borderRadius: '8px',
                  transition: 'background-color 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--surface-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <div style={{ display: 'flex', alignItems: 'center', width: '100%', flexDirection: 'row', justifyContent: 'flex-start' }}>
                  <input
                    type="checkbox"
                    checked={localSelection.includes(cal.id)}
                    onChange={() => handleToggle(cal.id)}
                    style={{
                      marginRight: '1rem',
                      width: '18px',
                      height: '18px',
                      cursor: 'pointer',
                      accentColor: 'var(--accent-blue)'
                    }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '0.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                        {cal.summaryOverride || cal.summary}
                      </div>
                      {localSelection.includes(cal.id) && people.length > 0 && (
                        <select
                          value={localAssignments[cal.id] || ''}
                          onChange={(e) => handleAssignPerson(cal.id, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            border: '1px solid var(--border-color)',
                            background: 'var(--surface-color)',
                            color: 'var(--text-primary)',
                            fontSize: '0.85rem',
                            maxWidth: '150px'
                          }}
                        >
                          <option value="">-- No Auto Attendee --</option>
                          {people.map(p => (
                            <option key={p.email} value={p.email}>
                              {p.name || p.email}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    {localSelection.includes(cal.id) && (
                      <div style={{ display: 'flex', alignItems: 'center', marginTop: '0.25rem' }}>
                        <input
                          type="text"
                          placeholder="#hashtag filter (optional)"
                          value={localHashtags[cal.id] || ''}
                          onChange={(e) => handleHashtagChange(cal.id, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            border: '1px solid var(--border-color)',
                            background: 'var(--surface-color)',
                            color: 'var(--text-primary)',
                            fontSize: '0.85rem',
                            width: '100%',
                            maxWidth: '200px'
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </label>
            ))
          )}
        </div>

        <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
          <button onClick={onClose} className="btn-secondary" style={{ padding: '0.5rem 1rem' }}>Cancel</button>
          <button onClick={handleSave} className="btn-primary" style={{ padding: '0.5rem 1rem' }}>Apply Changes</button>
        </div>
      </div>
    </div>
  );
};

export default CalendarSelectorModal;
