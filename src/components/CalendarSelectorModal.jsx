import React, { useState, useEffect } from 'react';

const CalendarSelectorModal = ({ isOpen, onClose, calendars, calendarConfigs = {}, people = [], onSave }) => {
  const [localConfigs, setLocalConfigs] = useState({});

  useEffect(() => {
    if (isOpen) {
      // Deep copy to avoid mutating props
      setLocalConfigs(JSON.parse(JSON.stringify(calendarConfigs)));
    }
  }, [isOpen, calendarConfigs]);

  const handleToggle = (calendarId) => {
    setLocalConfigs(prevConfigs => {
      const isSelected = prevConfigs[calendarId]?.selected;

      const updatedConfigs = {
        ...prevConfigs,
        [calendarId]: {
          ...prevConfigs[calendarId],
          selected: !isSelected,
        }
      };

      // Auto-assign person if calendarId matches a person's email and it was just selected
      if (!isSelected) {
        const personMatch = people.find(p => p.email === calendarId);
        if (personMatch) {
          updatedConfigs[calendarId].assignment = personMatch.email;
        }
      }

      return updatedConfigs;
    });
  };

  const handleConfigChange = (calendarId, field, value) => {
    setLocalConfigs(prev => {
      const currentConfig = prev[calendarId] || {};
      const updatedConfig = { ...currentConfig };

      const trimmedValue = typeof value === 'string' ? value.trim() : value;

      if (!trimmedValue || trimmedValue === '') {
        delete updatedConfig[field];
      } else {
        updatedConfig[field] = trimmedValue;
      }

      // If config is completely empty, we can just omit it
      if (Object.keys(updatedConfig).length === 0) {
        const newConfigs = { ...prev };
        delete newConfigs[calendarId];
        return newConfigs;
      }

      return {
        ...prev,
        [calendarId]: updatedConfig
      };
    });
  };

  const handleSave = () => {
    onSave(localConfigs);
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
                    checked={localConfigs[cal.id]?.selected || false}
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
                      {localConfigs[cal.id]?.selected && people.length > 0 && (
                        <select
                          value={localConfigs[cal.id]?.assignment || ''}
                          onChange={(e) => handleConfigChange(cal.id, 'assignment', e.target.value)}
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
                    {localConfigs[cal.id]?.selected && (
                      <div style={{ display: 'flex', alignItems: 'center', marginTop: '0.25rem', gap: '0.5rem' }}>
                        <input
                          type="text"
                          placeholder="Prefix Emoji"
                          value={localConfigs[cal.id]?.emoji || ''}
                          onChange={(e) => handleConfigChange(cal.id, 'emoji', e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          maxLength="5"
                          style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            border: '1px solid var(--border-color)',
                            background: 'var(--surface-color)',
                            color: 'var(--text-primary)',
                            fontSize: '0.85rem',
                            width: '90px'
                          }}
                        />
                        <input
                          type="text"
                          placeholder="#hashtag filter (optional)"
                          value={localConfigs[cal.id]?.hashtag || ''}
                          onChange={(e) => handleConfigChange(cal.id, 'hashtag', e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            border: '1px solid var(--border-color)',
                            background: 'var(--surface-color)',
                            color: 'var(--text-primary)',
                            fontSize: '0.85rem',
                            flex: 1,
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
