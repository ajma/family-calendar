import React from 'react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content glass help-modal" style={{ maxWidth: '700px', width: '90%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)' }}>
          <h2 style={{ border: 'none', padding: 0 }}>User Guide</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>&times;</button>
        </div>

        <div className="custom-scrollbar" style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
          <section style={{ marginBottom: '2rem' }}>
            <h3 style={{ marginTop: 0, color: 'var(--accent-blue)' }}>📅 Calendar Configuration</h3>
            <p>From the <strong>Settings</strong> modal, you can customize your experience:</p>
            <ul style={{ paddingLeft: '1.2rem', lineHeight: '1.6' }}>
              <li><strong>Subscriptions</strong>: Toggle which Google Calendars appear in your view.</li>
              <li><strong>Auto-Assign</strong>: Link a calendar to a specific person. Any event on that calendar will automatically show that person's avatar.</li>
              <li><strong>Hashtags</strong>: Filter a calendar to only show events containing a specific tag (e.g., <code>#work</code>).</li>
              <li><strong>Emojis</strong>: Prepend a custom emoji to every event title from a specific calendar.</li>
            </ul>
          </section>

          <section style={{ marginBottom: '2rem' }}>
            <h3 style={{ color: 'var(--accent-blue)' }}>🏷️ Event Hashtags</h3>
            <p>Use these special tags in your Google Calendar event descriptions for advanced logic:</p>
            <ul style={{ paddingLeft: '1.2rem', lineHeight: '1.6' }}>
              <li><code>#allfamily</code>: Automatically adds every person in your attendee list to the event. (Case-insensitive)</li>
              <li><code>#ignore</code>: Completely hides the event from this application (useful for sensitive or clutter events).</li>
            </ul>
          </section>

          <section style={{ marginBottom: '2rem' }}>
            <h3 style={{ color: 'var(--accent-blue)' }}>👥 People Management</h3>
            <p>Keep your attendee list clean and consistent:</p>
            <ul style={{ paddingLeft: '1.2rem', lineHeight: '1.6' }}>
              <li><strong>Merging</strong>: If one person has multiple email addresses, use the <strong>Merge...</strong> feature to consolidate them under one primary identity.</li>
              <li><strong>Unmerging</strong>: Click the <code>&times;</code> on an alternate email to split it back into a standalone person.</li>
              <li><strong>Visuals</strong>: Customize names, initials, and colors for better recognition.</li>
            </ul>
          </section>

          <section>
            <h3 style={{ color: 'var(--accent-blue)' }}>⌨️ Keyboard Shortcuts</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px' }}>
              <div>
                <div style={{ fontWeight: 'bold', marginBottom: '0.4rem' }}>Main View</div>
                <ul style={{ paddingLeft: '1.2rem', margin: 0, fontSize: '0.9rem' }}>
                  <li><code>Space</code>: Start Presentation</li>
                  <li><code>ArrowLeft</code>: Previous Week</li>
                  <li><code>ArrowRight</code>: Next Week</li>
                  <li><code>?</code>: Show this Guide</li>
                </ul>
              </div>
              <div>
                <div style={{ fontWeight: 'bold', marginBottom: '0.4rem' }}>Presentation Mode</div>
                <ul style={{ paddingLeft: '1.2rem', margin: 0, fontSize: '0.9rem' }}>
                  <li><code>Space</code> / <code>ArrowRight</code>: Next Event</li>
                  <li><code>ArrowLeft</code>: Previous Event</li>
                  <li><code>Escape</code>: Exit Mode</li>
                </ul>
              </div>
            </div>
          </section>
        </div>

        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', textAlign: 'right' }}>
          <button onClick={onClose} className="btn-primary">Got it!</button>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;
