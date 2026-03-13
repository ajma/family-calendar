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

    it('saves edited json data to localStorage and calls onBackendSave', async () => {
        const modifiedState = {
            calendar_configs: { cal1: { selected: true } },
            people: [{ email: 'alice@example.com', name: 'Alice Edited' }]
        };

        const onBackendSave = vi.fn().mockResolvedValue();
        render(<DebugModal isOpen={true} onClose={vi.fn()} onBackendSave={onBackendSave} />);

        const textarea = screen.getByRole('textbox');
        fireEvent.change(textarea, { target: { value: JSON.stringify(modifiedState, null, 2) } });

        fireEvent.click(screen.getByText('Save & Reload'));

        expect(onBackendSave).toHaveBeenCalledWith(modifiedState.calendar_configs, modifiedState.people);

        await waitFor(() => {
            expect(localStorage.getItem('calendar_configs')).toEqual(JSON.stringify(modifiedState.calendar_configs));
            expect(localStorage.getItem('people')).toEqual(JSON.stringify(modifiedState.people));
            expect(window.location.reload).toHaveBeenCalled();
        });
    });

    it('closes when Escape key is pressed', () => {
        const onClose = vi.fn();
        render(<DebugModal isOpen={true} onClose={onClose} />);
        
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledOnce();
    });
});
