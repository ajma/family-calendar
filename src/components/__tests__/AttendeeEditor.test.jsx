import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AttendeeEditor from '../AttendeeEditor';

describe('AttendeeEditor', () => {
    it('does not render when isOpen is false', () => {
        const { container } = render(<AttendeeEditor isOpen={false} people={[]} onSave={vi.fn()} onClose={vi.fn()} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('renders people and allows adding a new person', () => {
        const people = [
            { email: 'bob@example.com', name: 'Bob', initials: 'BO', color: '#ff0000', show: true }
        ];
        render(<AttendeeEditor isOpen={true} people={people} onSave={vi.fn()} onClose={vi.fn()} />);

        expect(screen.getByDisplayValue('Bob')).toBeInTheDocument();

        // Add person
        fireEvent.click(screen.getByText('+ Add Person'));

        expect(screen.getByDisplayValue('New Person')).toBeInTheDocument();
    });

    it('allows editing an existing person and saving', () => {
        const people = [
            { email: 'bob@example.com', name: 'Bob', initials: 'BO', color: '#ff0000', show: true }
        ];
        const onSave = vi.fn();
        render(<AttendeeEditor isOpen={true} people={people} onSave={onSave} onClose={vi.fn()} />);

        const nameInput = screen.getByDisplayValue('Bob');
        fireEvent.change(nameInput, { target: { value: 'Bobby' } });

        fireEvent.click(screen.getByText('Save Changes'));

        expect(onSave).toHaveBeenCalledOnce();
        const savedData = onSave.mock.calls[0][0];
        expect(savedData[0].name).toBe('Bobby');
    });
});
