import { useEffect, useRef } from 'react';

export type ActivityBackHandler = () => boolean;
export type ActivityBackRegistration = (handler: ActivityBackHandler | null) => void;

/** Register only while the activity is mounted, without capturing an old step. */
export function useActivityBack(register: ActivityBackRegistration | undefined, handler: ActivityBackHandler) {
  const current = useRef(handler);
  current.current = handler;
  useEffect(() => {
    if (!register) return;
    register(() => current.current());
    return () => register(null);
  }, [register]);
}
