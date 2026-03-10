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

const CalendarHeader = ({ currentDate, onPrev, onNext, onToday }) => {
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
      <button onClick={onToday} className="control-btn glass">This Week</button>
      <div className="nav-group glass">
        <button onClick={onPrev} className="icon-btn" aria-label="Previous Week"><ChevronLeft /></button>
        <button onClick={onNext} className="icon-btn" aria-label="Next Week"><ChevronRight /></button>
      </div>
      <h2 className="current-month">{dateRangeStr}</h2>
    </div>
  );
};

export default CalendarHeader;
