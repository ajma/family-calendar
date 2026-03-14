import { useState, useEffect } from 'react';

/**
 * Hook to manage Presentation Mode state, keyboard listeners, and event navigation.
 */
export function usePresentationMode(isActive: boolean) {
  const [revealedCount, setRevealedCount] = useState<number>(0);

  // Reset revealed count when presentation starts
  useEffect(() => {
    if (isActive) {
      setRevealedCount(0);
    }
  }, [isActive]);

  const nextEvent = () => setRevealedCount(prev => prev + 1);
  const prevEvent = () => setRevealedCount(prev => Math.max(0, prev - 1));

  return {
    revealedCount,
    setRevealedCount,
    nextEvent,
    prevEvent
  };
}
