
import React, { useRef } from 'react';

interface SwipeInput {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

export const useSwipe = ({ onSwipeLeft, onSwipeRight }: SwipeInput) => {
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  // Thresholds
  const minSwipeDistance = 40;

  const onTouchStart = (e: React.TouchEvent) => {
    // We only care about the first touch
    if (e.touches.length !== 1) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;

    const distanceX = touchStartX.current - touchEndX;
    const distanceY = touchStartY.current - touchEndY;

    // Reset
    touchStartX.current = null;
    touchStartY.current = null;

    const absX = Math.abs(distanceX);
    const absY = Math.abs(distanceY);

    // Check if horizontal movement is dominant and sufficient
    if (absX > absY && absX > minSwipeDistance) {
        if (distanceX > 0) {
            // Swiped Left (Drag Content Left -> Move Right)
            onSwipeLeft?.();
        } else {
            // Swiped Right (Drag Content Right -> Move Left)
            onSwipeRight?.();
        }
    }
  };

  return {
    onTouchStart,
    onTouchEnd,
  };
};
