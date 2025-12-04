import React, { useEffect, useState } from 'react';

// CSS variables for foldable devices
const setFoldableStyles = (isFolded: boolean, isDualScreen: boolean) => {
  const root = document.documentElement;
  if (isDualScreen) {
    root.style.setProperty('--layout-cols', '2');
    root.style.setProperty('--sidebar-width', '80px');
    root.setAttribute('data-device', 'foldable-open');
  } else {
    root.style.removeProperty('--layout-cols');
    root.style.removeProperty('--sidebar-width');
    root.setAttribute('data-device', 'standard');
  }
};

const FoldableDetector: React.FC = () => {
  const [screenState, setScreenState] = useState({
    isDualScreen: false,
    isFolded: false
  });

  useEffect(() => {
    const checkScreen = () => {
      // Check for dual screen using window segments API (if available)
      const segments = (window as any).visualViewport?.segments;
      const isDual = segments && segments.length > 1;
      
      // Basic check for very wide screens on mobile UA often implies open fold
      const isWideMobile = window.innerWidth > 600 && /Android|webOS|iPhone|iPad|iPod/i.test(navigator.userAgent);
      
      const newState = {
        isDualScreen: !!isDual || isWideMobile,
        isFolded: window.innerWidth < 400
      };

      setScreenState(newState);
      setFoldableStyles(newState.isFolded, newState.isDualScreen);
    };

    checkScreen();
    window.addEventListener('resize', checkScreen);
    
    // Use matchMedia for specific spanning features if supported
    const foldQuery = window.matchMedia('(horizontal-viewport-segments: 2)');
    foldQuery.addEventListener('change', checkScreen);

    return () => {
      window.removeEventListener('resize', checkScreen);
      foldQuery.removeEventListener('change', checkScreen);
    };
  }, []);

  // Invisible component, logic only
  return null;
};

export default FoldableDetector;