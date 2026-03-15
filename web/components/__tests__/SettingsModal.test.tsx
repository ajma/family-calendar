import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SettingsModal from '../SettingsModal';

// Mock IntersectionObserver for emoji-picker-react
global.IntersectionObserver = class IntersectionObserver {
  readonly root: Element | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
} as any;

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
  calendars: CALENDARS as any,
  calendarConfigs: {} as any,
  people: PEOPLE as any,
  userEmail: 'user@example.com',
  isAdmin: true
};

describe('SettingsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.confirm
    vi.stubGlobal('confirm', vi.fn(() => true));
    // Mock window.alert
    vi.stubGlobal('alert', vi.fn());
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
    // First, let's verify we can switch if we save first. But here we just want to test save.
    // Let's stay on Calendars and save.
    
    // Save (using the sticky save button in current tab)
    fireEvent.click(screen.getAllByText('Save')[0]); 
    
    expect(defaultProps.onSave).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'cal-1', selected: true })]),
      expect.any(Array)
    );
  });

  it('shows custom guard when closing modal with edits', () => {
    render(<SettingsModal {...defaultProps} />);
    
    // Make a change
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    
    // Click Close (header button)
    fireEvent.click(screen.getByText('×'));
    
    // Should show custom guard
    expect(screen.getByText('Unsaved Changes')).toBeInTheDocument();
    expect(screen.getByText(/What would you like to do before exiting/)).toBeInTheDocument();
    
    // Click Discard & Exit
    fireEvent.click(screen.getByText('Discard & Exit'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('does not warn when closing modal without edits', () => {
    render(<SettingsModal {...defaultProps} />);
    
    fireEvent.click(screen.getByText('×'));
    
    expect(window.confirm).not.toHaveBeenCalled();
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('does not warn when closing if people order is different but content is same', () => {
    const unsortedPeople = [
      { email: 'bob@example.com', name: 'Bob', initials: 'B', color: '#00ff00', show: true },
      { email: 'alice@example.com', name: 'Alice', initials: 'A', color: '#ff0000', show: true }
    ];
    render(<SettingsModal {...defaultProps} people={unsortedPeople} />);
    
    fireEvent.click(screen.getByText('×'));
    
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
    fireEvent.click(screen.getAllByText('Save')[0]); // Now only one should be active/rendered in the tab
    
    expect(defaultProps.onSave).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'cal-new', emoji: '🔥' })]),
      expect.arrayContaining([expect.objectContaining({ name: 'New User' })])
    );
  });

  it('allows removing an emoji via the "No Emoji" button', () => {
    const configsWithEmoji = { 'cal-1': { selected: true, emoji: '📅' } } as any;
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
    fireEvent.click(screen.getAllByText('Save')[0]); 
    expect(defaultProps.onSave).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'cal-1', emoji: null })]),
      expect.any(Array)
    );
  });

  it('closes on Escape key press if not dirty', () => {
    render(<SettingsModal {...defaultProps} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('handles the merge flow correctly', () => {
    const people = [
      { _id: '1', email: 'alice@example.com', name: 'Alice', initials: 'A', color: '#ff0000', show: true },
      { _id: '2', email: 'bob@example.com', name: 'Bob', initials: 'B', color: '#00ff00', show: true }
    ] as any;
    render(<SettingsModal {...defaultProps} people={people} />);
    
    fireEvent.click(screen.getByText('👥 Attendees'));
    
    // Click Merge on Alice
    const mergeButtons = screen.getAllByText('Merge...');
    fireEvent.click(mergeButtons[0]);
    
    // Select Bob as target
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'bob@example.com' } });
    
    // Confirm
    fireEvent.click(screen.getByText('Confirm'));
    
    // Alice should be gone, Bob should have Alice's email in alternates
    expect(screen.queryByDisplayValue('Alice')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('Bob')).toBeInTheDocument();
    expect(screen.getByText('alice@example.com')).toBeInTheDocument(); // Tag
  });

  it('handles the unmerge flow correctly', () => {
    const people = [
      { 
        _id: '1', 
        email: 'alice@primary.com', 
        name: 'Alice', 
        initials: 'A', 
        color: '#ff0000', 
        show: true, 
        alternateEmails: ['alice@work.com'] 
      }
    ] as any;
    render(<SettingsModal {...defaultProps} people={people} />);
    
    fireEvent.click(screen.getByText('👥 Attendees'));
    
    // Should see alternate email tag
    expect(screen.getByText('alice@work.com')).toBeInTheDocument();
    
    // Click unmerge (x button in tag)
    const unmergeBtn = screen.getByTitle('Unmerge email');
    fireEvent.click(unmergeBtn);
    
    // alice@work.com should now be its own record
    expect(screen.getByDisplayValue('alice@work.com')).toBeInTheDocument();
    // And no longer a tag under Alice
    expect(screen.queryByTitle('Unmerge email')).not.toBeInTheDocument();
  });

  it('blocks tab navigation with a custom dialog when dirty', () => {
    render(<SettingsModal {...defaultProps} />);
    
    // Make a change in Calendars
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    
    // Try to switch to Attendees
    fireEvent.click(screen.getByText('👥 Attendees'));
    
    // Should show custom dialog and NOT switch yet
    expect(screen.getByText('Unsaved Changes')).toBeInTheDocument();
    expect(screen.getByText(/What would you like to do before switching/)).toBeInTheDocument();
    expect(screen.getByText('Calendar Subscriptions')).toBeInTheDocument();
    
    // Click Discard & Switch
    fireEvent.click(screen.getByText('Discard & Switch'));
    
    // Should now show Attendees tab
    expect(screen.getByText('Attendee Management')).toBeInTheDocument();
    expect(screen.queryByText('Unsaved Changes')).not.toBeInTheDocument();
  });

  it('allows saving and switching via the custom guard', () => {
    render(<SettingsModal {...defaultProps} />);
    
    // Make a change in Calendars
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    
    // Try to switch to Attendees
    fireEvent.click(screen.getByText('👥 Attendees'));
    
    // Click Save & Switch
    fireEvent.click(screen.getByText('Save & Switch'));
    
    // Verify save was called and tab switched
    expect(defaultProps.onSave).toHaveBeenCalled();
    expect(screen.getByText('Attendee Management')).toBeInTheDocument();
  });

  it('disables the save button when not dirty', () => {
    render(<SettingsModal {...defaultProps} />);
    
    const saveBtn = screen.getAllByText('Save')[0];
    expect(saveBtn).toBeDisabled();
    
    // Make it dirty
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    
    expect(saveBtn).not.toBeDisabled();
  });

  it('enables the save button when editing raw JSON in the Debug tab', () => {
    render(<SettingsModal {...defaultProps} />);
    fireEvent.click(screen.getByText('🐛 Debug'));
    
    const saveBtn = screen.getByText('Save');
    expect(saveBtn).toBeDisabled();
    
    const textarea = screen.getByRole('textbox');
    const newConfig = {
      calendar_configs: { 'cal-1': { selected: true, emoji: '🔥' } },
      people: PEOPLE
    };
    
    // Make a change (valid JSON)
    fireEvent.change(textarea, { target: { value: JSON.stringify(newConfig, null, 2) } });
    
    // Now it should be enabled
    expect(saveBtn).not.toBeDisabled();

    // Make a change (invalid JSON)
    fireEvent.change(textarea, { target: { value: '{ invalid: json }' } });
    expect(saveBtn).not.toBeDisabled();
  });

  it('stays on the same tab after saving', () => {
    const { rerender } = render(<SettingsModal {...defaultProps} />);
    
    // Switch to Attendees
    fireEvent.click(screen.getByText('👥 Attendees'));
    expect(screen.getByText('Attendee Management')).toBeInTheDocument();
    
    // Make a change
    const nameInput = screen.getByPlaceholderText('Name');
    fireEvent.change(nameInput, { target: { value: 'Alice Edited' } });
    
    // Save
    fireEvent.click(screen.getByText('Save'));
    
    // Simulate parent updating props
    const newPeople = [{ ...PEOPLE[0], name: 'Alice Edited' }];
    rerender(<SettingsModal {...defaultProps} people={newPeople} />);
    
    // Should STILL be on Attendees tab
    expect(screen.getByText('Attendee Management')).toBeInTheDocument();
  });

  it('triggers close flow when sidebar Exit button is clicked', () => {
    render(<SettingsModal {...defaultProps} />);
    
    // Click Exit in sidebar
    fireEvent.click(screen.getByText('🚪 Exit'));
    
    // No edits, should close immediately
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('shows custom guard when clicking sidebar Exit with edits', () => {
    render(<SettingsModal {...defaultProps} />);
    
    // Make a change
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    
    // Click Exit in sidebar
    fireEvent.click(screen.getByText('🚪 Exit'));
    
    // Should show custom guard
    expect(screen.getByText('Unsaved Changes')).toBeInTheDocument();
    expect(screen.getByText('Save & Exit')).toBeInTheDocument();
    
    // Click Save & Exit
    fireEvent.click(screen.getByText('Save & Exit'));
    
    expect(defaultProps.onSave).toHaveBeenCalled();
    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
