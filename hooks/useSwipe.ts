import React, { useState } from 'react';

interface SwipeInput {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
}

export const useSwipe = ({ onSwipeLeft, onSwipeRight }: SwipeInput) => {
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);

  // The minimum distance in pixels for a swipe to be registered
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    // Resetting touchEnd to prevent click events from triggering swipe
    setTouchEndX(null); 
    setTouchStartX(e.targetTouches[0].clientX);
    setTouchStartY(e.targetTouches[0].clientY);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEndX(e.targetTouches[0].clientX);
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartX || !touchEndX || !touchStartY) return;

    const distanceX = touchStartX - touchEndX;
    const isLeftSwipe = distanceX > minSwipeDistance;
    const isRightSwipe = distanceX < -minSwipeDistance;

    const touchEndY = e.changedTouches[0].clientY;
    const distanceY = Math.abs(touchStartY - touchEndY);

    // To be a valid swipe, the horizontal distance must be greater than the vertical distance
    // This prevents triggering swipes when the user is scrolling vertically
    if (Math.abs(distanceX) > distanceY) {
      if (isLeftSwipe) {
        onSwipeLeft();
      } else if (isRightSwipe) {
        onSwipeRight();
      }
    }

    // Reset values
    setTouchStartX(null);
    setTouchEndX(null);
    setTouchStartY(null);
  };

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };
};
