import React from 'react';

// Icons as simple SVG to avoid extra dependencies for now
const ChevronLeft = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 18-6-6 6-6" />
  </svg>
);

const ChevronRight = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 18 6-6-6-6" />
  </svg>
);

const RefreshIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
  </svg>
);

const CalendarHeader = ({ currentDate, onPrev, onNext, onToday, onRefresh, prevRef, nextRef }) => {
  // Compute start (Monday) and end (Sunday) of the week
  const dayOfWeek = currentDate.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const startOfWeek = new Date(currentDate);
  startOfWeek.setDate(currentDate.getDate() + mondayOffset);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  const startMonth = startOfWeek.toLocaleDateString('default', { month: 'short' });
  const endMonth = endOfWeek.toLocaleDateString('default', { month: 'short' });
  const startDay = startOfWeek.getDate();
  const endDay = endOfWeek.getDate();
  const year = startOfWeek.getFullYear(); // For simplicity, assume same year, or use endOfWeek.getFullYear()
  const endYear = endOfWeek.getFullYear();

  let dateRangeStr = '';
  if (startMonth === endMonth) {
    // Same month: March 9-15, 2026
    dateRangeStr = `${startOfWeek.toLocaleDateString('default', { month: 'long' })} ${startDay}-${endDay}, ${year}`;
  } else if (year === endYear) {
    // Different month, same year: Feb 23 - Mar 1, 2026
    dateRangeStr = `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
  } else {
    // Different year: Dec 28, 2025 - Jan 3, 2026
    dateRangeStr = `${startMonth} ${startDay}, ${year} - ${endMonth} ${endDay}, ${endYear}`;
  }

  return (
    <div className="calendar-controls">
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <button onClick={onToday} className="control-btn glass">This Week</button>
        <button onClick={onRefresh} className="control-btn glass" style={{ padding: '0.4rem 0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-label="Refresh Calendar" title="Refresh Calendar">
          <RefreshIcon />
        </button>
      </div>
      <div className="nav-group glass">
        <button ref={prevRef} onClick={onPrev} className="icon-btn" aria-label="Previous Week"><ChevronLeft /></button>
        <button ref={nextRef} onClick={onNext} className="icon-btn" aria-label="Next Week"><ChevronRight /></button>
      </div>
      <h2 className="current-month">{dateRangeStr}</h2>
    </div>
  );
};

export default CalendarHeader;
