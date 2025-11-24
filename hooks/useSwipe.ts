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
      // Ensure we only track single-finger swipes to avoid conflict with pinch-zoom etc.
      if (e.touches.length !== 1) return;
      
      // Use client coordinates for viewport-relative tracking
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (touchStartX.current === null || touchStartY.current === null) return;

      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;

      const distanceX = touchStartX.current - touchEndX;
      const distanceY = touchStartY.current - touchEndY;

      const absX = Math.abs(distanceX);
      const absY = Math.abs(distanceY);
      
      const minSwipeDistance = 50; // 50px threshold

      // 1. Must be long enough (minSwipeDistance)
      // 2. Must be dominantly horizontal (absX > absY)
      // We use a relaxed slope check (1:1) to allow for natural diagonal thumb movements
      if (absX > minSwipeDistance && absX > absY) {
        if (distanceX > 0) {
          // Dragged from Right to Left (positive diff) -> Next
          if (handlersRef.current.onSwipeLeft) handlersRef.current.onSwipeLeft();
        } else {
          // Dragged from Left to Right (negative diff) -> Back
          if (handlersRef.current.onSwipeRight) handlersRef.current.onSwipeRight();
        }
      }

      // Reset
      touchStartX.current = null;
      touchStartY.current = null;
    };

    const onTouchCancel = () => {
        touchStartX.current = null;
        touchStartY.current = null;
    };

    // Attach listeners globally to document with passive: true for performance
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    document.addEventListener('touchcancel', onTouchCancel, { passive: true });

    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchCancel);
    };
  }, []); // Empty dependency array ensures listeners are bound only once
};