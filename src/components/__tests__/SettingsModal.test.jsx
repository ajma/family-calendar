import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SettingsModal from '../SettingsModal';

// Mock IntersectionObserver for emoji-picker-react
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
};

const CALENDARS = [
  { id: 'cal-1', summary: 'Work' },
  { id: 'cal-2', summary: 'Personal' }
];

const PEOPLE = [
  { email: 'alice@example.com', name: 'Alice', initials: 'A', color: '#ff0000', show: true }
];

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onSave: vi.fn(),
  onLogout: vi.fn(),
  onFullReset: vi.fn(),
  calendars: CALENDARS,
  calendarConfigs: {},
  people: PEOPLE,
  userEmail: 'user@example.com',
  isAdmin: true
};

describe('SettingsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.confirm
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  it('renders correctly and shows vertical tabs', () => {
    render(<SettingsModal {...defaultProps} />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('📅 Calendars')).toBeInTheDocument();
    expect(screen.getByText('👥 Attendees')).toBeInTheDocument();
    expect(screen.getByText('👤 Account')).toBeInTheDocument();
    expect(screen.getByText('🐛 Debug')).toBeInTheDocument();
  });

  it('switches tabs correctly', () => {
    render(<SettingsModal {...defaultProps} />);
    
    // Default tab is calendars
    expect(screen.getByText('Calendar Subscriptions')).toBeInTheDocument();
    
    // Switch to Attendees
    fireEvent.click(screen.getByText('👥 Attendees'));
    expect(screen.getByText('Attendee Management')).toBeInTheDocument();
    
    // Switch to Account
    fireEvent.click(screen.getByText('👤 Account'));
    expect(screen.getByText('Account Settings')).toBeInTheDocument();
    expect(screen.getByText('user@example.com')).toBeInTheDocument();
    
    // Switch to Debug
    fireEvent.click(screen.getByText('🐛 Debug'));
    expect(screen.getByText('Debug Console')).toBeInTheDocument();
    expect(screen.getByText(/Warning: These settings are primitive/)).toBeInTheDocument();
  });

  it('handles sign out from account tab', () => {
    render(<SettingsModal {...defaultProps} />);
    fireEvent.click(screen.getByText('👤 Account'));
    fireEvent.click(screen.getByText('Sign Out'));
    expect(defaultProps.onLogout).toHaveBeenCalled();
  });

  it('calls onSave with both calendar and attendee changes when Save is clicked', () => {
    render(<SettingsModal {...defaultProps} />);
    
    // Change calendar (Select Work)
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]); // Select first calendar
    
    // Switch to Attendees and change name
    fireEvent.click(screen.getByText('👥 Attendees'));
    const nameInput = screen.getByPlaceholderText('Name');
    fireEvent.change(nameInput, { target: { value: 'Alice Edited' } });
    
    // Save
    fireEvent.click(screen.getByText('Save Changes'));
    
    expect(defaultProps.onSave).toHaveBeenCalledWith(
      expect.objectContaining({ 'cal-1': expect.objectContaining({ selected: true }) }),
      expect.arrayContaining([expect.objectContaining({ name: 'Alice Edited' })])
    );
  });

  it('warns about unsaved changes when cancelling with edits', () => {
    render(<SettingsModal {...defaultProps} />);
    
    // Make a change
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    
    // Click Cancel
    fireEvent.click(screen.getByText('Cancel'));
    
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('unsaved changes'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('does not warn when cancelling without edits', () => {
    render(<SettingsModal {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Cancel'));
    
    expect(window.confirm).not.toHaveBeenCalled();
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('does not warn when cancelling if people order is different but content is same', () => {
    const unsortedPeople = [
      { email: 'bob@example.com', name: 'Bob', initials: 'B', color: '#00ff00', show: true },
      { email: 'alice@example.com', name: 'Alice', initials: 'A', color: '#ff0000', show: true }
    ];
    render(<SettingsModal {...defaultProps} people={unsortedPeople} />);
    
    // The component sorts them internally, but normalization in isDirty should handle it
    fireEvent.click(screen.getByText('Cancel'));
    
    expect(window.confirm).not.toHaveBeenCalled();
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('handles full reset with confirmation', () => {
    render(<SettingsModal {...defaultProps} />);
    fireEvent.click(screen.getByText('🐛 Debug'));
    
    fireEvent.click(screen.getByText('Full Factory Reset'));
    const confirmInput = screen.getByPlaceholderText('Type DELETE');
    fireEvent.change(confirmInput, { target: { value: 'DELETE' } });
    
    fireEvent.click(screen.getByText('Confirm'));
    expect(defaultProps.onFullReset).toHaveBeenCalled();
  });

  it('allows editing raw JSON in the Debug tab and reflects changes in onSave', () => {
    render(<SettingsModal {...defaultProps} />);
    fireEvent.click(screen.getByText('🐛 Debug'));
    
    const textarea = screen.getByRole('textbox');
    const newConfig = {
      calendar_configs: { 'cal-new': { selected: true, emoji: '🔥' } },
      people: [{ email: 'new@example.com', name: 'New User', initials: 'NU', color: '#000000', show: true }]
    };
    
    fireEvent.change(textarea, { target: { value: JSON.stringify(newConfig, null, 2) } });
    
    // Save
    fireEvent.click(screen.getByText('Save Changes'));
    
    expect(defaultProps.onSave).toHaveBeenCalledWith(
      expect.objectContaining({ 'cal-new': expect.objectContaining({ emoji: '🔥' }) }),
      expect.arrayContaining([expect.objectContaining({ name: 'New User' })])
    );
  });

  it('allows removing an emoji via the "No Emoji" button', () => {
    const configsWithEmoji = { 'cal-1': { selected: true, emoji: '📅' } };
    render(<SettingsModal {...defaultProps} calendarConfigs={configsWithEmoji} />);
    
    // Check emoji is there
    expect(screen.getByText('📅')).toBeInTheDocument();
    
    // Open picker
    fireEvent.click(screen.getByText('📅'));
    
    // Click "No Emoji"
    fireEvent.click(screen.getByText('No Emoji'));
    
    // Check emoji is replaced by plus sign
    expect(screen.getByText('＋')).toBeInTheDocument();
    
    // Save and verify onSave excludes emoji
    fireEvent.click(screen.getByText('Save Changes'));
    expect(defaultProps.onSave).toHaveBeenCalledWith(
      expect.objectContaining({ 'cal-1': expect.objectContaining({ emoji: null }) }),
      expect.any(Array)
    );
  });

  it('closes on Escape key press if not dirty', () => {
    render(<SettingsModal {...defaultProps} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
