import React, { useState, useEffect, useRef } from 'react';
import EmojiPicker from 'emoji-picker-react';

const CalendarSelectorModal = ({ isOpen, onClose, calendars, calendarConfigs = {}, people = [], onSave }) => {
  const [localConfigs, setLocalConfigs] = useState({});
  const [activePickerId, setActivePickerId] = useState(null); // ID of the calendar currently picking an emoji
  const pickerRef = useRef(null);

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setActivePickerId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const handleEmojiClick = (calendarId, emojiObject) => {
    handleConfigChange(calendarId, 'emoji', emojiObject.emoji);
    setActivePickerId(null);
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
              <div
                key={cal.id}
                className="attendee-list-item"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '1rem',
                  marginBottom: '0.5rem',
                  border: '1px solid var(--border-color)',
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
                        <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setActivePickerId(activePickerId === cal.id ? null : cal.id)}
                            style={{
                              padding: '0.25rem 0.5rem',
                              borderRadius: '4px',
                              border: '1px solid var(--border-color)',
                              background: 'var(--surface-color)',
                              color: localConfigs[cal.id]?.emoji ? 'var(--text-primary)' : 'var(--text-secondary)',
                              fontSize: '1rem',
                              width: '40px',
                              height: '32px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease'
                            }}
                            title="Pick an emoji"
                          >
                            {localConfigs[cal.id]?.emoji || '＋'}
                          </button>
                          
                          {activePickerId === cal.id && (
                            <div 
                              ref={pickerRef}
                              style={{ 
                                position: 'absolute', 
                                top: '100%', 
                                left: 0, 
                                zIndex: 1000,
                                marginTop: '0.5rem',
                                boxShadow: 'var(--shadow-md)',
                                background: 'white',
                                borderRadius: '8px',
                                padding: '0.5rem',
                                border: '1px solid var(--border-color)'
                              }}
                            >
                              <button
                                onClick={() => {
                                  handleConfigChange(cal.id, 'emoji', '');
                                  setActivePickerId(null);
                                }}
                                style={{
                                  width: '100%',
                                  padding: '0.5rem',
                                  marginBottom: '0.5rem',
                                  background: 'var(--bg-color)',
                                  border: '1px solid var(--border-color)',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontSize: '0.85rem',
                                  color: 'var(--text-secondary)',
                                  textAlign: 'center'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-color)'}
                              >
                                ❌ No Emoji
                              </button>
                              <EmojiPicker 
                                onEmojiClick={(emojiData) => handleEmojiClick(cal.id, emojiData)}
                                autoFocusSearch={false}
                                theme="auto"
                                width={300}
                                height={400}
                              />
                            </div>
                          )}
                        </div>
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
              </div>
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
