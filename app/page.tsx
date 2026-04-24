"use client";

import { useState, useCallback } from "react";
import DashboardShell from "../components/dashboard/DashboardShell";
import HeroSection from "../components/dashboard/HeroSection";

export default function Home() {
  const [selectedMoods, setSelectedMoods] = useState<Set<string>>(new Set());

  const handleSelectMood = useCallback((key: string) => {
    setSelectedMoods((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handlePreselectMood = useCallback((key: string) => {
    setSelectedMoods((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    document.getElementById("dashboard")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  return (
    <main
      className="min-h-screen font-sans"
      style={{
        background: "var(--bg)",
        color: "var(--t1)",
        paddingBottom: 80,
      }}
    >
      <HeroSection onPreselectMood={handlePreselectMood} />
      <DashboardShell
        selectedMoods={selectedMoods}
        onSelectMood={handleSelectMood}
      />
    </main>
  );
}
