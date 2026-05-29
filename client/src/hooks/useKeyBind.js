import { useEffect, useRef, useCallback } from "react";

/**
 * useKeyBind — attach keydown/keyup handlers to a single key code.
 *
 * @param {string}   code     - KeyboardEvent.code value, e.g. "Space", "KeyV"
 * @param {Function} onDown   - called on first keydown (not on repeat)
 * @param {Function} onUp     - called on keyup
 * @param {boolean}  enabled  - when false the listeners are a no-op
 */
export function useKeyBind(code, onDown, onUp, enabled = true) {
  // Keep stable refs so the effect doesn't re-run when callbacks change identity
  const downRef = useRef(onDown);
  const upRef   = useRef(onUp);
  downRef.current = onDown;
  upRef.current   = onUp;

  useEffect(() => {
    if (!code || !enabled) return;

    const handleDown = (e) => {
      // Ignore repeat events and ignore when user is typing in an input/textarea
      if (e.repeat) return;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
      if (e.code === code) {
        e.preventDefault();
        downRef.current(e);
      }
    };

    const handleUp = (e) => {
      if (e.code === code) upRef.current(e);
    };

    window.addEventListener("keydown", handleDown);
    window.addEventListener("keyup",   handleUp);

    return () => {
      window.removeEventListener("keydown", handleDown);
      window.removeEventListener("keyup",   handleUp);
    };
  }, [code, enabled]);
}

/**
 * useKeyCapture — one-shot key capture for rebinding.
 * Returns [capturing, startCapture, capturedCode].
 *
 * @param {Function} onCapture  - called with the new KeyboardEvent.code
 */
export function useKeyCapture(onCapture) {
  const capturing = useRef(false);

  const start = useCallback(() => {
    if (capturing.current) return;
    capturing.current = true;

    const handler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      capturing.current = false;
      window.removeEventListener("keydown", handler, { capture: true });
      onCapture(e.code);
    };

    window.addEventListener("keydown", handler, { capture: true });
  }, [onCapture]);

  return { start, isCapturing: () => capturing.current };
}
