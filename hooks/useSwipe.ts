
import React, { useRef } from 'react';

interface SwipeInput {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

export const useSwipe = ({ onSwipeLeft, onSwipeRight }: SwipeInput) => {
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  // Thresholds
  const minSwipeDistance = 50;
  const maxVerticalDistance = 60; // Allow some vertical movement naturally

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

    // Check if vertical movement was too much (user probably scrolling)
    if (Math.abs(distanceY) > maxVerticalDistance) return;

    // Check if horizontal movement is enough
    if (Math.abs(distanceX) > minSwipeDistance) {
        if (distanceX > 0) {
            // Swiped Left (Drag Content Left)
            onSwipeLeft?.();
        } else {
            // Swiped Right (Drag Content Right)
            onSwipeRight?.();
        }
    }
  };

  return {
    onTouchStart,
    onTouchEnd,
  };
};
