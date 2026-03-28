import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CalendarHeader from '../CalendarHeader';

const mockUseCalendarContext = vi.fn();
vi.mock('../../context/CalendarContext', () => ({
    useCalendarContext: () => mockUseCalendarContext()
}));

describe('CalendarHeader', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const defaultProps = {
        sessionToken: 'fake',
        hasRefreshToken: true,
        login: vi.fn(),
        togglePresentationMode: vi.fn(),
    } as any;

    it('renders correctly with current date in the same month', () => {
        const date = new Date('2026-03-10T12:00:00.000Z');
        mockUseCalendarContext.mockReturnValue({ currentDate: date });
        render(<CalendarHeader {...defaultProps} />);
        expect(screen.getByText('March 9-15, 2026')).toBeInTheDocument();
    });

    it('renders correctly across month boundary', () => {
        const date = new Date('2026-02-26T12:00:00.000Z');
        mockUseCalendarContext.mockReturnValue({ currentDate: date });
        render(<CalendarHeader {...defaultProps} />);
        expect(screen.getByText('Feb 23 - Mar 1, 2026')).toBeInTheDocument();
    });

    it('renders correctly across year boundary', () => {
        const date = new Date('2026-01-01T12:00:00.000Z');
        mockUseCalendarContext.mockReturnValue({ currentDate: date });
        render(<CalendarHeader {...defaultProps} />);
        expect(screen.getByText('Dec 29, 2025 - Jan 4, 2026')).toBeInTheDocument();
    });

    it('calls callbacks when controls are clicked', () => {
        const onNext = vi.fn();
        const onPrev = vi.fn();
        const onToday = vi.fn();
        const onRefresh = vi.fn();
        const date = new Date('2026-03-10T12:00:00.000Z');

        mockUseCalendarContext.mockReturnValue({
            currentDate: date,
            handleNextWeek: onNext,
            handlePrevWeek: onPrev,
            handleToday: onToday,
            loadEvents: onRefresh
        });

        const { getByLabelText, getByText } = render(<CalendarHeader {...defaultProps} />);

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
