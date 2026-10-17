"use client";
import { createContext, useContext, useSyncExternalStore } from "react";
const query = "(prefers-reduced-motion: reduce)";
const subscribe = (notify: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
export function useReducedMotion() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => true,
  );
}
export const MotionSettings = createContext({ paused: false, toggle: () => {} });
export const useMotionSettings = () => useContext(MotionSettings);
export function motionDuration(ms: number) {
  return window.matchMedia(query).matches ? 0 : ms;
}
