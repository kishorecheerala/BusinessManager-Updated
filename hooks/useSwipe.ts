import { useEffect, useRef } from 'react';

interface SwipeInput {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

export const useSwipe = ({ onSwipeLeft, onSwipeRight }: SwipeInput) => {
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  
  // Store handlers in a ref. This allows us to bind the event listeners ONLY ONCE
  // but still execute the *latest* version of the callback functions (with current state).
  const handlersRef = useRef({ onSwipeLeft, onSwipeRight });

  // Update the ref on every render so it always has the freshest closures
  useEffect(() => {
    handlersRef.current = { onSwipeLeft, onSwipeRight };
  });

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      // Use screen coordinates to avoid issues with scrolling affecting calculation
      touchStartX.current = e.changedTouches[0].screenX;
      touchStartY.current = e.changedTouches[0].screenY;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (touchStartX.current === null || touchStartY.current === null) return;

      const touchEndX = e.changedTouches[0].screenX;
      const touchEndY = e.changedTouches[0].screenY;

      const distanceX = touchStartX.current - touchEndX;
      const distanceY = touchStartY.current - touchEndY;

      const absX = Math.abs(distanceX);
      const absY = Math.abs(distanceY);
      
      const minSwipeDistance = 50; // 50px threshold
      const slope = 1.2; // Allow slightly diagonal swipes (X must be > 1.2 * Y)

      // 1. Must be long enough
      // 2. Must be dominantly horizontal
      if (absX > minSwipeDistance && absX > absY * slope) {
        if (distanceX > 0) {
          // Swiped Left (Finger moved Right to Left)
          if (handlersRef.current.onSwipeLeft) handlersRef.current.onSwipeLeft();
        } else {
          // Swiped Right (Finger moved Left to Right)
          if (handlersRef.current.onSwipeRight) handlersRef.current.onSwipeRight();
        }
      }

      // Reset
      touchStartX.current = null;
      touchStartY.current = null;
    };

    // Attach listeners globally with passive: true for performance
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, []); // Empty dependency array ensures listeners are bound only once
};
