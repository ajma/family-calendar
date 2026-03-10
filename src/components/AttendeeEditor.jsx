import React, { useState, useEffect } from 'react';
import { AVATAR_ICON_COLORS } from '../constants';

const AttendeeEditor = ({ isOpen, onClose, people, onSave }) => {
  // Update internal state when people prop changes
  const [localPeople, setLocalPeople] = useState([]);

  useEffect(() => {
    // Sort alphabetically when opened
    const sortedPeople = [...people].sort((a, b) => {
      const nameA = a.name || a.email || '';
      const nameB = b.name || b.email || '';
      return nameA.localeCompare(nameB);
    }).map(p => ({ ...p, _id: p.email + Math.random() })); // Add internal ID for stable keys
    setLocalPeople(sortedPeople);
  }, [people]);

  const handleChange = (id, field, value) => {
    setLocalPeople(prev => prev.map(p => {
      if (p._id === id) {
        const updated = { ...p, [field]: value };
        if (field === 'initials') {
          updated.initials = value.toUpperCase().substring(0, 2);
        }
        return updated;
      }
      return p;
    }));
  };

  const handleAddPerson = () => {
    const usedColors = localPeople.map(p => p.color);
    let newColor = AVATAR_ICON_COLORS.find(c => !usedColors.includes(c));
    if (!newColor) {
      newColor = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
    }

    setLocalPeople([
      {
        _id: 'new_' + Math.random(),
        name: 'New Person',
        email: '',
        initials: 'NP',
        color: newColor,
        show: true
      },
      ...localPeople
    ]);
  };

  const handleSaveAll = () => {
    const dataToSave = localPeople.map(({ _id, ...rest }) => rest);
    onSave(dataToSave);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content glass">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
          <h2 style={{ padding: 0, border: 'none', margin: 0 }}>Edit Attendees</h2>
          <button onClick={handleAddPerson} className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>+ Add Person</button>
        </div>
        <div className="attendee-list">
          {localPeople.map(person => (
            <div key={person._id} className="attendee-list-item editing" style={{ padding: '1rem', marginBottom: '1rem', border: '1px solid var(--border-color)' }}>

              <div className="attendee-edit-form" style={{
                marginTop: 0,
                paddingTop: 0,
                borderTop: 'none',
                animation: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%'
              }}>

                {/* Left side: Inputs */}
                <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '0.4rem', paddingRight: '1rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>

                    {/* Name & Email Column */}
                    <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <input
                        type="text"
                        value={person.name}
                        placeholder="Display Name"
                        onChange={(e) => handleChange(person._id, 'name', e.target.value)}
                        style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', outline: 'none', fontSize: '0.85rem' }}
                      />
                      <input
                        type="email"
                        value={person.email}
                        placeholder="Email Address"
                        onChange={(e) => handleChange(person._id, 'email', e.target.value)}
                        style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', outline: 'none', fontSize: '0.75rem', color: 'var(--text-secondary)' }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input
                          type="checkbox"
                          checked={person.show !== false} // default to true if undefined
                          onChange={(e) => handleChange(person._id, 'show', e.target.checked)}
                          id={`show-${person._id}`}
                        />
                        <label htmlFor={`show-${person._id}`} style={{ fontSize: '0.75rem', cursor: 'pointer', userSelect: 'none' }}>Show</label>
                      </div>
                    </div>

                    {/* Initials & Avatar Column */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      <input
                        type="text"
                        maxLength="2"
                        value={person.initials}
                        placeholder="Initials"
                        onChange={(e) => handleChange(person._id, 'initials', e.target.value)}
                        style={{ width: '45px', textTransform: 'uppercase', textAlign: 'center', padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--border-color)', outline: 'none', fontSize: '0.85rem' }}
                      />
                      <div style={{
                        backgroundColor: person.color,
                        width: '32px', height: '32px',
                        borderRadius: '50%',
                        marginTop: '0.2rem',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontSize: '13px', fontWeight: '700',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
                      }}>
                        {person.initials}
                      </div>
                    </div>

                  </div>
                </div>

                {/* Right side: Color Picker */}
                <div style={{ width: '80px', flexShrink: 0 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', justifyContent: 'flex-start' }}>
                    {AVATAR_ICON_COLORS.map(color => (
                      <div
                        key={color}
                        onClick={() => handleChange(person._id, 'color', color)}
                        style={{
                          width: '20px', height: '20px', borderRadius: '50%', backgroundColor: color, cursor: 'pointer',
                          border: person.color === color ? '2px solid var(--text-primary)' : '1px solid transparent',
                          transform: person.color === color ? 'scale(1.15)' : 'scale(1)',
                          transition: 'all var(--transition-fast)',
                          boxShadow: person.color === color ? 'var(--shadow-sm)' : 'none'
                        }}
                      />
                    ))}
                    {/* Keep custom color if they randomly generated one that's not in the palette */}
                    {!AVATAR_ICON_COLORS.includes(person.color) && (
                      <div
                        style={{
                          width: '20px', height: '20px', borderRadius: '50%', backgroundColor: person.color, cursor: 'pointer',
                          border: '2px solid var(--text-primary)',
                          transform: 'scale(1.15)',
                          boxShadow: 'var(--shadow-sm)'
                        }}
                      />
                    )}
                  </div>
                </div>

              </div>

            </div>
          ))}
          {localPeople.length === 0 && (
            <div className="empty-state">No attendees found in your events.</div>
          )}
        </div>

        <div className="modal-actions">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSaveAll} className="btn-primary">Save Changes</button>
        </div>
      </div>
    </div>
  );
};

export default AttendeeEditor;
