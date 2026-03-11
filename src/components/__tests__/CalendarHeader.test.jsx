import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CalendarHeader from '../CalendarHeader';

describe('CalendarHeader', () => {
    it('renders correctly with current date in the same month', () => {
        // March 10, 2026 is Tuesday. Monday = March 9, Sunday = March 15
        const date = new Date('2026-03-10T12:00:00.000Z');
        render(<CalendarHeader currentDate={date} onPrev={vi.fn()} onNext={vi.fn()} onToday={vi.fn()} onRefresh={vi.fn()} />);

        expect(screen.getByText('March 9-15, 2026')).toBeInTheDocument();
    });

    it('renders correctly across month boundary', () => {
        // Feb 26, 2026 is Thursday. Monday = Feb 23, Sunday = Mar 1
        const date = new Date('2026-02-26T12:00:00.000Z');
        render(<CalendarHeader currentDate={date} onPrev={vi.fn()} onNext={vi.fn()} onToday={vi.fn()} onRefresh={vi.fn()} />);

        expect(screen.getByText('Feb 23 - Mar 1, 2026')).toBeInTheDocument();
    });

    it('renders correctly across year boundary', () => {
        // Jan 1, 2026 is Thursday. Monday = Dec 29, 2025, Sunday = Jan 4, 2026
        const date = new Date('2026-01-01T12:00:00.000Z');
        render(<CalendarHeader currentDate={date} onPrev={vi.fn()} onNext={vi.fn()} onToday={vi.fn()} onRefresh={vi.fn()} />);

        expect(screen.getByText('Dec 29, 2025 - Jan 4, 2026')).toBeInTheDocument();
    });

    it('calls callbacks when controls are clicked', () => {
        const onNext = vi.fn();
        const onPrev = vi.fn();
        const onToday = vi.fn();
        const onRefresh = vi.fn();
        const date = new Date('2026-03-10T12:00:00.000Z');

        const { getByLabelText, getByText } = render(
            <CalendarHeader
                currentDate={date}
                onPrev={onPrev}
                onNext={onNext}
                onToday={onToday}
                onRefresh={onRefresh}
            />
        );

        fireEvent.click(getByLabelText('Next Week'));
        expect(onNext).toHaveBeenCalledOnce();

        fireEvent.click(getByLabelText('Previous Week'));
        expect(onPrev).toHaveBeenCalledOnce();

        fireEvent.click(getByText('This Week'));
        expect(onToday).toHaveBeenCalledOnce();

        fireEvent.click(getByLabelText('Refresh Calendar'));
        expect(onRefresh).toHaveBeenCalledOnce();
    });
});
