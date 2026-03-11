import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import DebugModal from '../DebugModal';

describe('DebugModal', () => {
    let originalLocation;

    beforeEach(() => {
        localStorage.clear();
        originalLocation = window.location;
        delete window.location;
        window.location = { reload: vi.fn() };
    });

    afterEach(() => {
        window.location = originalLocation;
    });

    it('loads localStorage data into textarea', () => {
        localStorage.setItem('people', JSON.stringify([{ id: '1', name: 'Alice' }]));

        render(<DebugModal isOpen={true} onClose={vi.fn()} onBackendSave={vi.fn()} />);

        const textarea = screen.getByRole('textbox');
        expect(textarea.value).toContain('Alice');
    });

    it('saves edited json data to localStorage and calls onBackendSave (e.g. edit an attendee and edit selection of a calendar)', async () => {
        const initialState = {
            calendar_configs: { cal1: { assignments: {} } },
            people: [{ id: '1', name: 'Alice', color: '#000' }]
        };
        localStorage.setItem('stateDump', JSON.stringify(initialState));

        const onBackendSave = vi.fn().mockResolvedValue();
        render(<DebugModal isOpen={true} onClose={vi.fn()} onBackendSave={onBackendSave} />);

        const textarea = screen.getByRole('textbox');

        // User edits the JSON text in the debug modal (e.g. edit attendee name, edit calendar selection)
        const modifiedState = {
            calendar_configs: { cal1: { assignments: {}, selection: true } },
            people: [{ id: '1', name: 'Alice Edited', color: '#111' }]
        };

        fireEvent.change(textarea, { target: { value: JSON.stringify(modifiedState, null, 2) } });

        fireEvent.click(screen.getByText('Save & Reload'));

        // Assert onBackendSave was called with new configs and people array
        expect(onBackendSave).toHaveBeenCalledWith(modifiedState.calendar_configs, modifiedState.people);

        // Assert localStorage is updated with the modified state properties
        await waitFor(() => {
            // It sets each object property individually according to handleSave:
            // localStorage.setItem(key, valToStore);
            expect(localStorage.getItem('calendar_configs')).toEqual(JSON.stringify(modifiedState.calendar_configs));
            expect(localStorage.getItem('people')).toEqual(JSON.stringify(modifiedState.people));

            expect(window.location.reload).toHaveBeenCalled();
        });
    });
});
