import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CalendarSelectorModal from '../CalendarSelectorModal';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const CALENDARS = [
  { id: 'cal-work',   summary: 'Work' },
  { id: 'cal-family', summary: 'Family' },
];

const PEOPLE = [
  { email: 'alice@example.com', name: 'Alice' },
  { email: 'bob@example.com',   name: 'Bob'   },
];

const defaultProps = (overrides = {}) => ({
  isOpen: true,
  onClose: vi.fn(),
  onSave: vi.fn(),
  calendars: CALENDARS,
  calendarConfigs: {},
  people: [],
  ...overrides,
});

// ─── Rendering ────────────────────────────────────────────────────────────────

describe('CalendarSelectorModal', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(<CalendarSelectorModal {...defaultProps({ isOpen: false })} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a checkbox for each calendar', () => {
    render(<CalendarSelectorModal {...defaultProps()} />);
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(CALENDARS.length);
  });

  it('shows calendars sorted alphabetically', () => {
    const unsortedCalendars = [
      { id: 'z-cal', summary: 'Zebra' },
      { id: 'a-cal', summary: 'Alpha' },
    ];
    render(<CalendarSelectorModal {...defaultProps({ calendars: unsortedCalendars })} />);
    const labels = screen.getAllByRole('checkbox').map(cb => cb.closest('label'));
    expect(labels[0]).toHaveTextContent('Alpha');
    expect(labels[1]).toHaveTextContent('Zebra');
  });

  it('shows "No calendars found." when the list is empty', () => {
    render(<CalendarSelectorModal {...defaultProps({ calendars: [] })} />);
    expect(screen.getByText('No calendars found.')).toBeInTheDocument();
  });

  // ── Toggle behaviour ──────────────────────────────────────────────────────

  it('checking a calendar marks it as selected', () => {
    render(<CalendarSelectorModal {...defaultProps()} />);
    const [workCheckbox] = screen.getAllByRole('checkbox');
    expect(workCheckbox).not.toBeChecked();
    fireEvent.click(workCheckbox);
    expect(workCheckbox).toBeChecked();
  });

  it('unchecking a calendar marks it as not selected', () => {
    const configs = { 'cal-work': { selected: true } };
    render(<CalendarSelectorModal {...defaultProps({ calendarConfigs: configs })} />);
    const workCheckbox = screen.getAllByRole('checkbox').find(cb =>
      cb.closest('label')?.textContent?.includes('Work')
    );
    expect(workCheckbox).toBeChecked();
    fireEvent.click(workCheckbox);
    expect(workCheckbox).not.toBeChecked();
  });

  // ── Save / Cancel ─────────────────────────────────────────────────────────

  it('"Cancel" does not call onSave', () => {
    const onSave = vi.fn();
    render(<CalendarSelectorModal {...defaultProps({ onSave })} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('"Cancel" calls onClose', () => {
    const onClose = vi.fn();
    render(<CalendarSelectorModal {...defaultProps({ onClose })} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('"Apply Changes" calls onSave with the current config', () => {
    const onSave = vi.fn();
    render(<CalendarSelectorModal {...defaultProps({ onSave })} />);

    // Toggle Work calendar on
    const workCheckbox = screen.getAllByRole('checkbox').find(cb =>
      cb.closest('label')?.textContent?.includes('Work')
    );
    fireEvent.click(workCheckbox);

    fireEvent.click(screen.getByText('Apply Changes'));
    expect(onSave).toHaveBeenCalledOnce();
    const [savedConfig] = onSave.mock.calls[0];
    expect(savedConfig['cal-work']?.selected).toBe(true);
  });

  it('"Apply Changes" calls onClose after saving', () => {
    const onClose = vi.fn();
    render(<CalendarSelectorModal {...defaultProps({ onClose })} />);
    fireEvent.click(screen.getByText('Apply Changes'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  // ── Config fields ─────────────────────────────────────────────────────────

  it('shows the emoji and hashtag inputs when a calendar is selected', () => {
    const configs = { 'cal-work': { selected: true } };
    render(<CalendarSelectorModal {...defaultProps({ calendarConfigs: configs })} />);
    expect(screen.getByPlaceholderText('Prefix Emoji')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('#hashtag filter (optional)')).toBeInTheDocument();
  });

  it('does not show emoji input when a calendar is not selected', () => {
    render(<CalendarSelectorModal {...defaultProps()} />);
    expect(screen.queryByPlaceholderText('Prefix Emoji')).not.toBeInTheDocument();
  });

  it('saves emoji value when set', () => {
    const onSave = vi.fn();
    const configs = { 'cal-work': { selected: true } };
    render(<CalendarSelectorModal {...defaultProps({ onSave, calendarConfigs: configs })} />);

    const emojiInput = screen.getByPlaceholderText('Prefix Emoji');
    fireEvent.change(emojiInput, { target: { value: '💼' } });
    fireEvent.click(screen.getByText('Apply Changes'));

    const [savedConfig] = onSave.mock.calls[0];
    expect(savedConfig['cal-work']?.emoji).toBe('💼');
  });

  it('removes the emoji key entirely when the emoji field is cleared (no empty string)', () => {
    const onSave = vi.fn();
    const configs = { 'cal-work': { selected: true, emoji: '💼' } };
    render(<CalendarSelectorModal {...defaultProps({ onSave, calendarConfigs: configs })} />);

    const emojiInput = screen.getByPlaceholderText('Prefix Emoji');
    fireEvent.change(emojiInput, { target: { value: '  ' } }); // whitespace → trimmed to empty
    fireEvent.click(screen.getByText('Apply Changes'));

    const [savedConfig] = onSave.mock.calls[0];
    expect(savedConfig['cal-work']).not.toHaveProperty('emoji');
  });

  it('shows the person dropdown when a calendar is selected and people exist', () => {
    const configs = { 'cal-work': { selected: true } };
    render(<CalendarSelectorModal {...defaultProps({ calendarConfigs: configs, people: PEOPLE })} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });
});
