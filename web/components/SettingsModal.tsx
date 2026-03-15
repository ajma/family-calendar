import React, { useState, useEffect, useRef } from 'react';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import { AVATAR_ICON_COLORS } from '../constants';
import { GoogleCalendarEvent, GoogleCalendar, CalendarConfig, Person } from 'common/types';

interface LocalPerson extends Person {
  _id: string;
  alternateEmails?: string[];
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  calendars: GoogleCalendar[];
  calendarConfigs: Record<string, CalendarConfig>;
  people: Person[];
  userEmail: string;
  isAdmin: boolean;
  onSave: (configs: CalendarConfig[], people: Person[]) => void;
  onLogout: () => void;
  onFullReset: () => void;
  initialTab?: string;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  calendars = [], 
  calendarConfigs = {}, 
  people = [], 
  userEmail = '',
  isAdmin = false,
  onSave, 
  onLogout,
  onFullReset,
  initialTab = 'calendars'
}) => {
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [localConfigs, setLocalConfigs] = useState<Record<string, CalendarConfig>>({});
  const [localPeople, setLocalPeople] = useState<LocalPerson[]>([]);
  const [localDebugText, setLocalDebugText] = useState<string>('');
  
  const [activeEmojiPickerId, setActiveEmojiPickerId] = useState<string | null>(null);
  const [mergingPersonId, setMergingPersonId] = useState<string | null>(null); // ID of person being merged FROM
  const [mergeTargetEmail, setMergeTargetEmail] = useState<string>(''); // Email of person being merged INTO
  const [isResetConfirming, setIsResetConfirming] = useState<boolean>(false);
  const [resetConfirmationText, setResetConfirmationText] = useState<string>('');
  const [isDirty, setIsDirty] = useState<boolean>(false);
  
  const pickerRef = useRef<HTMLDivElement>(null);

  // Initialize state when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalConfigs(JSON.parse(JSON.stringify(calendarConfigs)));
      
      const sortedPeople = [...people].sort((a, b) => {
        const nameA = a.name || a.email || '';
        const nameB = b.name || b.email || '';
        return nameA.localeCompare(nameB);
      }).map(p => ({ ...p, _id: p.email + Math.random() }));
      setLocalPeople(sortedPeople);

      // Debug state
      const debugData = { calendar_configs: calendarConfigs, people };
      setLocalDebugText(JSON.stringify(debugData, null, 2));

      setIsDirty(false);
      setIsResetConfirming(false);
      setResetConfirmationText('');
      if (initialTab) setActiveTab(initialTab);
    }
  }, [isOpen, calendarConfigs, people, initialTab]);

  // Track dirty state
  useEffect(() => {
    if (!isOpen) return;
    
    const normalizePeople = (pList: (Person | LocalPerson)[]) => JSON.stringify(
      [...pList]
        .map((p) => { const { _id, ...rest } = p as LocalPerson; return rest; })
        .sort((a, b) => (a.email || '').localeCompare(b.email || ''))
    );

    const initialConfigs = JSON.stringify(calendarConfigs);
    const initialPeople = normalizePeople(people);
    
    const currentConfigs = JSON.stringify(localConfigs);
    const currentPeople = normalizePeople(localPeople);
    
    setIsDirty(initialConfigs !== currentConfigs || initialPeople !== currentPeople);

    // Sync debug text from UI state (if not currently focused on debug tab)
    if (activeTab !== 'debug') {
      setLocalDebugText(JSON.stringify({ 
        calendar_configs: localConfigs, 
        people: localPeople.map(({ _id, ...rest }) => rest) 
      }, null, 2));
    }
  }, [localConfigs, localPeople, calendarConfigs, people, isOpen, activeTab]);

  const handleDebugTextChange = (newText: string) => {
    setLocalDebugText(newText);
    try {
      const parsed = JSON.parse(newText);
      if (parsed.calendar_configs) setLocalConfigs(parsed.calendar_configs);
      if (parsed.people) {
        // Re-add internal _ids for the UI
        const withIds = (parsed.people as Person[]).map((p: Person & { _id?: string }) => ({ 
          ...p, 
          _id: p._id || p.email + Math.random() 
        }));
        setLocalPeople(withIds);
      }
    } catch (e) {
      // Invalid JSON, just keep the text as is
    }
  };

  // Handle Escape and Outside Click
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeEmojiPickerId) {
          setActiveEmojiPickerId(null);
        } else {
          handleCloseRequest();
        }
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setActiveEmojiPickerId(null);
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, activeEmojiPickerId, isDirty]);

  const handleCloseRequest = () => {
    if (isDirty) {
      if (window.confirm('You have unsaved changes. Are you sure you want to discard them?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const handleSaveAll = () => {
    const peopleToSave = localPeople.map(({ _id, ...rest }) => rest);
    const configsToSave = Object.entries(localConfigs).map(([id, config]) => {
      const { summary, primary, ...rest } = config as any; 
      return { ...rest, id } as CalendarConfig;
    });
    onSave(configsToSave, peopleToSave);
    onClose();
  };

  // Calendar Handlers
  const handleCalendarToggle = (calendarId: string) => {
    setLocalConfigs(prev => {
      const isSelected = prev[calendarId]?.selected;
      const updated = {
        ...prev,
        [calendarId]: { ...prev[calendarId], selected: !isSelected }
      };
      if (!isSelected) {
        const match = localPeople.find(p => p.email === calendarId);
        if (match) updated[calendarId] = { ...updated[calendarId], assignment: match.email };
      }
      return updated;
    });
  };

  const handleCalendarConfigChange = (calendarId: string, field: keyof CalendarConfig, value: string | boolean | null) => {
    setLocalConfigs(prev => ({
      ...prev,
      [calendarId]: { ...prev[calendarId], [field]: value }
    }));
  };

  // Attendee Handlers
  const handlePersonChange = (id: string, field: keyof LocalPerson, value: string | boolean) => {
    setLocalPeople(prev => prev.map(p => {
      if (p._id === id) {
        const updated = { ...p, [field]: value };
        if (field === 'initials') updated.initials = (value as string).toUpperCase().substring(0, 2);
        return updated;
      }
      return p;
    }));
  };

  const handleAddPerson = () => {
    const usedColors = localPeople.map(p => p.color);
    let newColor = AVATAR_ICON_COLORS.find(c => !usedColors.includes(c));
    if (!newColor) newColor = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');

    setLocalPeople([
      { _id: 'new_' + Math.random(), name: 'New Person', email: '', initials: 'NP', color: newColor, show: true, alternateEmails: [] },
      ...localPeople
    ]);
  };

  const handleMerge = () => {
    if (!mergingPersonId || !mergeTargetEmail) return;

    const sourcePerson = localPeople.find(p => p._id === mergingPersonId);
    if (!sourcePerson) return;

    setLocalPeople(prev => {
      // 1. Find target person and update their alternates
      const updatedPeople = prev.map(p => {
        if (p.email === mergeTargetEmail) {
          const newAlternates = [...(p.alternateEmails || [])];
          const sourceEmailLower = sourcePerson.email.toLowerCase();
          // Add source primary email if not already there (case-insensitive)
          if (sourcePerson.email && !newAlternates.some(ae => ae.toLowerCase() === sourceEmailLower)) {
            newAlternates.push(sourcePerson.email);
          }
          // Add source's alternate emails if not already there (case-insensitive)
          (sourcePerson.alternateEmails || []).forEach(ae => {
            const aeLower = ae.toLowerCase();
            if (!newAlternates.some(existing => existing.toLowerCase() === aeLower)) {
              newAlternates.push(ae);
            }
          });
          return { ...p, alternateEmails: newAlternates };
        }
        return p;
      });

      // 2. Filter out the source person
      return updatedPeople.filter(p => p._id !== mergingPersonId);
    });

    setMergingPersonId(null);
    setMergeTargetEmail('');
    setIsDirty(true);
  };

  const handleUnmerge = (personId: string, emailToUnmerge: string) => {
    setLocalPeople(prev => {
      const personIndex = prev.findIndex(p => p._id === personId);
      if (personIndex === -1) return prev;

      const person = prev[personIndex];
      const newAlternates = (person.alternateEmails || []).filter(e => e !== emailToUnmerge);
      
      const updatedPerson = { ...person, alternateEmails: newAlternates };
      
      // Create new person from unmerged email
      const usedColors = prev.map(p => p.color);
      let newColor = AVATAR_ICON_COLORS.find(c => !usedColors.includes(c));
      if (!newColor) newColor = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
      
      const newPerson = {
        _id: 'unmerged_' + Math.random(),
        name: emailToUnmerge.split('@')[0],
        email: emailToUnmerge,
        initials: emailToUnmerge.substring(0, 2).toUpperCase(),
        color: newColor,
        show: true,
        alternateEmails: []
      };

      const newPeople = [...prev];
      newPeople[personIndex] = updatedPerson;
      newPeople.push(newPerson);
      return newPeople;
    });
    setIsDirty(true);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content glass" style={{ maxWidth: '800px', width: '90%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)' }}>
          <h2 style={{ border: 'none', padding: 0 }}>Settings</h2>
          <button onClick={handleCloseRequest} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>&times;</button>
        </div>

        <div className="settings-layout">
          {/* Sidebar */}
          <div className="settings-sidebar">
            <button className={`settings-tab-btn ${activeTab === 'calendars' ? 'active' : ''}`} onClick={() => setActiveTab('calendars')}>📅 Calendars</button>
            <button className={`settings-tab-btn ${activeTab === 'attendees' ? 'active' : ''}`} onClick={() => setActiveTab('attendees')}>👥 Attendees</button>
            <button className={`settings-tab-btn ${activeTab === 'guide' ? 'active' : ''}`} onClick={() => setActiveTab('guide')}>❓ User Guide</button>
            <button className={`settings-tab-btn ${activeTab === 'account' ? 'active' : ''}`} onClick={() => setActiveTab('account')}>👤 Account</button>
            {isAdmin && <button className={`settings-tab-btn ${activeTab === 'debug' ? 'active' : ''}`} onClick={() => setActiveTab('debug')}>🐛 Debug</button>}
          </div>

          {/* Content area */}
          <div className="settings-content-area">
            {activeTab === 'calendars' && (
              <>
                <div className="settings-section-title">Calendar Subscriptions</div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                  Choose which calendars to display and configure their hashtag filters or auto-attendee assignment.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {calendars.map(cal => {
                    const isSelected = localConfigs[cal.id]?.selected || false;
                    return (
                      <div key={cal.id} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: isSelected ? '0.75rem' : 0 }}>
                          <input type="checkbox" checked={isSelected} onChange={() => handleCalendarToggle(cal.id)} id={`cal-${cal.id}`} />
                          <label htmlFor={`cal-${cal.id}`} style={{ fontWeight: '600', cursor: 'pointer', flex: 1 }}>{cal.summaryOverride || cal.summary}</label>
                        </div>
                        {isSelected && (
                          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', paddingTop: '0.75rem', borderTop: '1px dashed var(--border-color)' }}>
                            <div className="form-group" style={{ flex: 1 }}>
                              <label>Auto-Assign To</label>
                              <select 
                                value={localConfigs[cal.id]?.assignment || ''} 
                                onChange={(e) => handleCalendarConfigChange(cal.id, 'assignment', e.target.value)}
                                style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-primary)' }}
                              >
                                <option value="">-- None --</option>
                                {localPeople.map(p => <option key={p.email} value={p.email}>{p.name || p.email}</option>)}
                              </select>
                            </div>
                            <div className="form-group" style={{ flex: 1 }}>
                              <label>Hashtag</label>
                              <input 
                                type="text" 
                                value={localConfigs[cal.id]?.hashtag || ''} 
                                onChange={(e) => handleCalendarConfigChange(cal.id, 'hashtag', e.target.value)} 
                                placeholder="#family"
                              />
                            </div>
                            <div className="form-group" style={{ flex: '0 0 auto' }}>
                              <label>Emoji</label>
                              <div style={{ position: 'relative' }}>
                                <button 
                                  onClick={() => setActiveEmojiPickerId(activeEmojiPickerId === cal.id ? null : cal.id)}
                                  style={{ padding: '0.4rem', width: '40px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-primary)' }}
                                >
                                  {localConfigs[cal.id]?.emoji || '＋'}
                                </button>
                                {activeEmojiPickerId === cal.id && (
                                  <div ref={pickerRef} className="emoji-picker-popover animate-in">
                                    <button 
                                      onClick={() => { handleCalendarConfigChange(cal.id, 'emoji', null); setActiveEmojiPickerId(null); }}
                                      className="btn-no-emoji"
                                    >
                                      No Emoji
                                    </button>
                                    <EmojiPicker 
                                      onEmojiClick={(emoji: EmojiClickData) => { handleCalendarConfigChange(cal.id, 'emoji', emoji.emoji); setActiveEmojiPickerId(null); }}
                                      width={350}
                                      height={440}
                                      theme={Theme.AUTO}
                                      previewConfig={{ showPreview: false }}
                                      skinTonesDisabled
                                      searchDisabled={false}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {activeTab === 'attendees' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <div className="settings-section-title" style={{ margin: 0 }}>Attendee Management</div>
                  <button onClick={handleAddPerson} className="btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>+ Add New Person</button>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                  Manage family members and their display preferences. Discovered attendees from events appear here automatically.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {localPeople.map(person => (
                    <div key={person._id} style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'flex-start', background: mergingPersonId === person._id ? 'var(--surface-hover)' : 'transparent' }}>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <input type="text" value={person.name} onChange={(e) => handlePersonChange(person._id, 'name', e.target.value)} placeholder="Name" style={{ padding: '0.4rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-primary)', fontWeight: '600' }} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <input type="email" value={person.email} onChange={(e) => handlePersonChange(person._id, 'email', e.target.value)} placeholder="Email" style={{ padding: '0.3rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'none', color: 'var(--text-secondary)', fontSize: '0.8rem' }} />
                          {person.alternateEmails && person.alternateEmails.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.25rem' }}>
                              {person.alternateEmails.map(ae => (
                                <span key={ae} className="alternate-email-tag">
                                  {ae}
                                  <button onClick={() => handleUnmerge(person._id, ae)} className="unmerge-btn" title="Unmerge email">&times;</button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '0.25rem' }}>
                          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                            <input type="checkbox" checked={person.show !== false} onChange={(e) => handlePersonChange(person._id, 'show', e.target.checked)} id={`show-${person._id}`} />
                            <label htmlFor={`show-${person._id}`} style={{ fontSize: '0.75rem', cursor: 'pointer' }}>Show in View</label>
                          </div>
                          
                          {mergingPersonId === person._id ? (
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <select 
                                value={mergeTargetEmail} 
                                onChange={(e) => setMergeTargetEmail(e.target.value)}
                                style={{ fontSize: '0.75rem', padding: '0.2rem', borderRadius: '4px', border: '1px solid var(--accent-blue)', background: 'var(--bg-color)', color: 'var(--text-primary)' }}
                              >
                                <option value="">Merge into...</option>
                                {localPeople.filter(p => p._id !== person._id).map(p => (
                                  <option key={p.email} value={p.email}>{p.name || p.email}</option>
                                ))}
                              </select>
                              <button onClick={handleMerge} disabled={!mergeTargetEmail} className="btn-primary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}>Confirm</button>
                              <button onClick={() => setMergingPersonId(null)} className="btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}>Cancel</button>
                            </div>
                          ) : (
                            <button 
                              onClick={() => setMergingPersonId(person._id)} 
                              className="btn-secondary" 
                              style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', borderColor: 'var(--accent-blue)', color: 'var(--accent-blue)' }}
                            >
                              Merge...
                            </button>
                          )}
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ backgroundColor: person.color, width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '14px', fontWeight: 'bold', boxShadow: 'var(--shadow-sm)' }}>{person.initials}</div>
                        <input type="text" value={person.initials} onChange={(e) => handlePersonChange(person._id, 'initials', e.target.value)} maxLength={2} style={{ width: '40px', textAlign: 'center', padding: '0.3rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-primary)', fontSize: '0.8rem' }} />
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', width: '70px', gap: '0.2rem', alignSelf: 'center' }}>
                        {AVATAR_ICON_COLORS.map(c => (
                          <div key={c} onClick={() => handlePersonChange(person._id, 'color', c)} style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: c, cursor: 'pointer', border: person.color === c ? '2px solid var(--text-primary)' : '1px solid transparent' }} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {activeTab === 'account' && (
              <>
                <div className="settings-section-title">Account Settings</div>
                <div className="settings-account-info">
                  <div>Logged in as: <span className="settings-account-email">{userEmail}</span></div>
                  <button onClick={onLogout} className="btn-secondary" style={{ alignSelf: 'flex-start', color: '#ff7b72', borderColor: '#ff7b72' }}>Sign Out</button>
                </div>
              </>
            )}

            {activeTab === 'guide' && (
              <div className="custom-scrollbar" style={{ height: '100%', overflowY: 'auto', paddingRight: '0.5rem' }}>
                <div className="settings-section-title">User Guide</div>
                
                <section style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ marginTop: 0, color: 'var(--accent-blue)', fontSize: '1rem', marginBottom: '0.5rem' }}>📅 Calendar Configuration</h3>
                  <p style={{ fontSize: '0.9rem', lineHeight: '1.5', margin: '0 0 0.5rem 0' }}>From the <strong>Calendars</strong> tab, you can customize your experience:</p>
                  <ul style={{ paddingLeft: '1.2rem', lineHeight: '1.5', fontSize: '0.85rem', margin: 0 }}>
                    <li><strong>Subscriptions</strong>: Toggle which Google Calendars appear in your view.</li>
                    <li><strong>Auto-Assign</strong>: Link a calendar to a specific person. Any event on that calendar will automatically show that person's avatar.</li>
                    <li><strong>Hashtags</strong>: Filter a calendar to only show events containing a specific tag (e.g., <code>#work</code>).</li>
                    <li><strong>Emojis</strong>: Prepend a custom emoji to every event title from a specific calendar.</li>
                  </ul>
                </section>

                <section style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ color: 'var(--accent-blue)', fontSize: '1rem', marginBottom: '0.5rem' }}>🏷️ Event Hashtags</h3>
                  <p style={{ fontSize: '0.9rem', lineHeight: '1.5', margin: '0 0 0.5rem 0' }}>Use these special tags in your Google Calendar event descriptions:</p>
                  <ul style={{ paddingLeft: '1.2rem', lineHeight: '1.5', fontSize: '0.85rem', margin: 0 }}>
                    <li><code>#allfamily</code>: Automatically adds every person in your attendee list to the event.</li>
                    <li><code>#ignore</code>: Completely hides the event from this application.</li>
                  </ul>
                </section>

                <section style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ color: 'var(--accent-blue)', fontSize: '1rem', marginBottom: '0.5rem' }}>👥 People Management</h3>
                  <p style={{ fontSize: '0.9rem', lineHeight: '1.5', margin: '0 0 0.5rem 0' }}>Keep your attendee list clean and consistent from the <strong>Attendees</strong> tab:</p>
                  <ul style={{ paddingLeft: '1.2rem', lineHeight: '1.5', fontSize: '0.85rem', margin: 0 }}>
                    <li><strong>Merging</strong>: Consolidate multiple email addresses under one primary identity.</li>
                    <li><strong>Unmerging</strong>: Split an alternate email back into a standalone person.</li>
                    <li><strong>Visuals</strong>: Customize names, initials, and colors for better recognition.</li>
                  </ul>
                </section>

                <section>
                  <h3 style={{ color: 'var(--accent-blue)', fontSize: '1rem', marginBottom: '0.5rem' }}>⌨️ Keyboard Shortcuts</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: 'rgba(255,255,255,0.05)', padding: '0.75rem', borderRadius: '8px' }}>
                    <div>
                      <div style={{ fontWeight: 'bold', marginBottom: '0.3rem', fontSize: '0.85rem' }}>Main View</div>
                      <ul style={{ paddingLeft: '1.1rem', margin: 0, fontSize: '0.8rem' }}>
                        <li><code>Space</code>: Start Presentation</li>
                        <li><code>ArrowLeft/Right</code>: Navigate</li>
                        <li><code>?</code>: Open this Guide</li>
                      </ul>
                    </div>
                    <div>
                      <div style={{ fontWeight: 'bold', marginBottom: '0.3rem', fontSize: '0.85rem' }}>Show Mode</div>
                      <ul style={{ paddingLeft: '1.1rem', margin: 0, fontSize: '0.8rem' }}>
                        <li><code>Right/Space</code>: Next Event</li>
                        <li><code>Left</code>: Previous Event</li>
                        <li><code>Escape</code>: Exit Mode</li>
                      </ul>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'debug' && isAdmin && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div className="settings-section-title">Debug Console</div>
                <div className="settings-debug-warning">
                   ⚠️ Warning: These settings are primitive and potentially dangerous. Only modify these if you know what you're doing.
                </div>
                <textarea 
                  value={localDebugText} 
                  onChange={(e) => handleDebugTextChange(e.target.value)}
                  style={{ flex: 1, minHeight: '200px', background: 'var(--bg-color)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '1rem', fontFamily: 'monospace', fontSize: '0.8rem' }}
                />
                <div style={{ marginTop: '1rem', padding: '1rem', border: '1px solid rgba(255,123,114,0.3)', borderRadius: '8px', background: 'rgba(255,123,114,0.05)' }}>
                  <div style={{ fontWeight: 'bold', color: '#ff7b72', marginBottom: '0.5rem' }}>Danger Zone</div>
                  {!isResetConfirming ? (
                    <button onClick={() => setIsResetConfirming(true)} className="btn-secondary" style={{ color: '#ff7b72', borderColor: '#ff7b72' }}>Full Factory Reset</button>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input type="text" value={resetConfirmationText} onChange={(e) => setResetConfirmationText(e.target.value)} placeholder="Type DELETE" style={{ padding: '0.4rem', border: '1px solid #ff7b72', borderRadius: '4px', background: 'var(--bg-color)', color: 'var(--text-primary)' }} />
                      <button onClick={onFullReset} disabled={resetConfirmationText !== 'DELETE'} className="btn-primary" style={{ background: resetConfirmationText === 'DELETE' ? '#ff7b72' : 'var(--border-color)' }}>Confirm</button>
                      <button onClick={() => setIsResetConfirming(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancel</button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="modal-actions">
          <button onClick={handleCloseRequest} className="btn-secondary">Cancel</button>
          <button onClick={handleSaveAll} className="btn-primary">Save Changes</button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
