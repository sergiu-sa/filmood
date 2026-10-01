"use client";

import { useEffect, type RefObject } from "react";

/**
 * Closes a popover on Escape or on a pointerdown outside `ref`. Focus moving
 * outside `ref` (Tab past the last control) calls `onFocusOut` instead, which
 * closes without pulling focus back.
 */
export function useDismiss(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
  onFocusOut: () => void,
) {
  useEffect(() => {
    if (!open) return;
    const outside = (target: EventTarget | null) => ref.current !== null && !ref.current.contains(target as Node);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onPointer = (e: PointerEvent) => {
      if (outside(e.target)) onClose();
    };
    const onFocus = (e: FocusEvent) => {
      if (outside(e.target)) onFocusOut();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("focusin", onFocus);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("focusin", onFocus);
    };
  }, [ref, open, onClose, onFocusOut]);
}
