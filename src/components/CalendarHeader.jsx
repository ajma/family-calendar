import React from 'react';

// Icons as simple SVG to avoid extra dependencies for now
const ChevronLeft = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 18-6-6 6-6"/>
  </svg>
);

const ChevronRight = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 18 6-6-6-6"/>
  </svg>
);

const CalendarHeader = ({ currentDate, onPrev, onNext, onToday }) => {
  const monthYearStr = currentDate.toLocaleDateString('default', { month: 'long', year: 'numeric' });

  return (
    <div className="calendar-controls">
      <button onClick={onToday} className="control-btn glass">Today</button>
      <div className="nav-group glass">
        <button onClick={onPrev} className="icon-btn" aria-label="Previous Week"><ChevronLeft /></button>
        <button onClick={onNext} className="icon-btn" aria-label="Next Week"><ChevronRight /></button>
      </div>
      <h2 className="current-month">{monthYearStr}</h2>
    </div>
  );
};

export default CalendarHeader;
