"use client";

import { useEffect, useRef } from "react";
import Navbar from "../Navbar";
import GuestBanner from "./GuestBanner";

export default function StickyHeader() {
  const ref = useRef<HTMLElement>(null);

  // The guest banner comes and goes, so anything sticking under the header
  // reads its live height from --sticky-header-h instead of a fixed top.
  useEffect(() => {
    const header = ref.current;
    if (!header) return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => {
      root.style.setProperty("--sticky-header-h", `${header.offsetHeight}px`);
    });
    observer.observe(header);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--sticky-header-h");
    };
  }, []);

  return (
    <header ref={ref} className="sticky top-0 z-50">
      <GuestBanner />
      <Navbar />
    </header>
  );
}
