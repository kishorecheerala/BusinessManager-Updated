import { useEffect, DependencyList } from 'react';

// Effect callback that receives an abort signal
type EffectCallback = (signal: AbortSignal) => void | (() => void) | Promise<void>;

/**
 * A wrapper around useEffect that provides an AbortSignal.
 * Automatically aborts the signal when the component unmounts or deps change.
 * Useful for fetch requests or heavy async operations.
 */
export const useAbortableEffect = (effect: EffectCallback, deps: DependencyList) => {
  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    const cleanupFn = effect(signal);

    return () => {
      controller.abort();
      if (typeof cleanupFn === 'function') {
        cleanupFn();
      }
    };
  }, deps);
};