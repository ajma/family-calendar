import React from 'react';

/**
 * Component for the floating presentation controls.
 */
function PresentationControls({ revealedCount, onPrev, onNext }) {
  return (
    <div className="presentation-controls">
      <div className="presentation-nav-group">
        <button 
          className="presentation-btn prev" 
          onClick={onPrev}
          title="Previous (Left Arrow)"
        >
          &lt;
        </button>
        <button 
          className="presentation-btn next" 
          onClick={onNext}
          title="Next (Right Arrow)"
        >
          &gt;
        </button>
      </div>
    </div>
  );
}

export default PresentationControls;
