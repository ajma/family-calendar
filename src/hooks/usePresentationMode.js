import { useState, useEffect } from 'react';

/**
 * Hook to manage Presentation Mode state, keyboard listeners, and event navigation.
 */
export function usePresentationMode() {
  const [presentationMode, setPresentationMode] = useState(false);
  const [revealedCount, setRevealedCount] = useState(0);

  const togglePresentationMode = () => {
    if (!presentationMode) {
      setRevealedCount(0);
    }
    setPresentationMode(!presentationMode);
  };

  const nextEvent = () => setRevealedCount(prev => prev + 1);
  const prevEvent = () => setRevealedCount(prev => Math.max(0, prev - 1));

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!presentationMode) return;

      if (e.key === 'ArrowRight') {
        nextEvent();
      } else if (e.key === 'ArrowLeft') {
        prevEvent();
      } else if (e.key === 'Escape') {
        setPresentationMode(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [presentationMode]);

  return {
    presentationMode,
    setPresentationMode,
    revealedCount,
    setRevealedCount,
    togglePresentationMode,
    nextEvent,
    prevEvent
  };
}
