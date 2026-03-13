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

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        // If emoji picker is active, close it first. Otherwise close the modal.
        if (activePickerId) {
          setActivePickerId(null);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activePickerId, onClose]);

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
      <div className="modal-content glass" style={{ maxWidth: '550px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', padding: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
          <h2 style={{ padding: 0, border: 'none', margin: '0 0 0.5rem 0' }}>Select Calendars</h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.85rem' }}>
            Choose which calendars to display and configure their hashtag filters or auto-attendee assignments.
          </p>
        </div>

        <div className="attendee-list" style={{ overflowY: 'auto', padding: '1rem' }}>
          {calendars.length === 0 ? (
            <div className="empty-state">No calendars found.</div>
          ) : (
            [...calendars].sort((a, b) => {
              const nameA = a.summaryOverride || a.summary || '';
              const nameB = b.summaryOverride || b.summary || '';
              return nameA.localeCompare(nameB);
            }).map(cal => {
              const isSelected = localConfigs[cal.id]?.selected || false;
              return (
                <div
                  key={cal.id}
                  className={`attendee-list-item ${isSelected ? 'editing' : ''}`}
                  style={{
                    padding: '0.75rem 1rem',
                    marginBottom: '0.5rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {/* Top Row: Selection & Name */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggle(cal.id)}
                        id={`cal-${cal.id}`}
                        style={{
                          width: '16px',
                          height: '16px',
                          cursor: 'pointer',
                          accentColor: 'var(--accent-blue)'
                        }}
                      />
                      <label 
                        htmlFor={`cal-${cal.id}`}
                        style={{ 
                          fontWeight: '600', 
                          fontSize: '0.9rem',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                          flex: 1
                        }}
                      >
                        {cal.summaryOverride || cal.summary}
                      </label>
                    </div>

                    {/* Expandable Config Row */}
                    {isSelected && (
                      <div className="attendee-edit-form" style={{
                        marginTop: '0.5rem',
                        paddingTop: '0.75rem',
                        borderTop: '1px dashed var(--border-color)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                        animation: 'none'
                      }}>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                          {/* Auto-Attendee Group */}
                          <div className="form-group" style={{ flex: 1, minWidth: '150px' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'block' }}>
                              Auto Assign To
                            </label>
                            <select
                              value={localConfigs[cal.id]?.assignment || ''}
                              onChange={(e) => handleConfigChange(cal.id, 'assignment', e.target.value)}
                              style={{
                                width: '100%',
                                padding: '0.4rem 0.5rem',
                                borderRadius: '6px',
                                border: '1px solid var(--border-color)',
                                background: 'var(--bg-color)',
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem',
                                height: '34px',
                                outline: 'none'
                              }}
                            >
                              <option value="">-- No Auto Attendee --</option>
                              {people.map(p => (
                                <option key={p.email} value={p.email}>
                                  {p.name || p.email}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Hashtag Filter Group */}
                          <div className="form-group" style={{ flex: 1, minWidth: '150px' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'block' }}>
                              Hashtag Filter
                            </label>
                            <input
                              type="text"
                              placeholder="#hashtag filter (optional)"
                              value={localConfigs[cal.id]?.hashtag || ''}
                              onChange={(e) => handleConfigChange(cal.id, 'hashtag', e.target.value)}
                              style={{
                                width: '100%',
                                padding: '0.4rem 0.6rem',
                                borderRadius: '6px',
                                border: '1px solid var(--border-color)',
                                background: 'var(--bg-color)',
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem',
                                height: '34px',
                                outline: 'none'
                              }}
                            />
                          </div>

                          {/* Emoji Picker Group */}
                          <div className="form-group" style={{ flex: '0 0 auto' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'block' }}>
                              Emoji
                            </label>
                            <div style={{ position: 'relative' }}>
                              <button
                                type="button"
                                onClick={() => setActivePickerId(activePickerId === cal.id ? null : cal.id)}
                                title="Pick an emoji"
                                style={{
                                  padding: '0.4rem',
                                  borderRadius: '6px',
                                  border: '1px solid var(--border-color)',
                                  background: 'var(--bg-color)',
                                  width: '40px',
                                  height: '34px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  fontSize: '1.1rem'
                                }}
                              >
                                {localConfigs[cal.id]?.emoji || '＋'}
                              </button>
                              
                              {activePickerId === cal.id && (
                                <div 
                                  ref={pickerRef}
                                  className="compact-emoji-picker"
                                  style={{ 
                                    position: 'absolute', 
                                    top: '100%', 
                                    left: 0, 
                                    zIndex: 1000,
                                    marginTop: '0.5rem',
                                    boxShadow: 'var(--shadow-md)',
                                    background: 'white',
                                    borderRadius: '8px',
                                    padding: '0.45rem',
                                    border: '1px solid var(--border-color)',
                                    '--epr-category-label-font-size': '0.75rem',
                                    '--epr-search-input-font-size': '0.85rem',
                                    '--epr-emoji-size': '26px'
                                  }}
                                >
                                  <button
                                    onClick={() => {
                                      handleConfigChange(cal.id, 'emoji', '');
                                      setActivePickerId(null);
                                    }}
                                    style={{
                                      width: '100%',
                                      padding: '0.3rem',
                                      marginBottom: '0.4rem',
                                      background: 'var(--bg-color)',
                                      border: '1px solid var(--border-color)',
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      fontSize: '0.75rem',
                                      color: 'var(--text-secondary)',
                                      textAlign: 'center'
                                    }}
                                  >
                                    ❌ No Emoji
                                  </button>
                                  <EmojiPicker 
                                    onEmojiClick={(emojiData) => handleEmojiClick(cal.id, emojiData)}
                                    autoFocusSearch={false}
                                    theme="auto"
                                    width={280}
                                    height={350}
                                    previewConfig={{ showPreview: false }}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="modal-actions">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} className="btn-primary">Apply Changes</button>
        </div>
      </div>
    </div>
  );
};

export default CalendarSelectorModal;
