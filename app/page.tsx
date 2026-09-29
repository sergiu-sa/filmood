"use client";

import { useState, useCallback } from "react";
import DashboardShell from "../components/dashboard/DashboardShell";
import HeroSection from "../components/dashboard/HeroSection";
import { MAX_MOODS } from "@/lib/moodMap";

export default function Home() {
  const [selectedMoods, setSelectedMoods] = useState<Set<string>>(new Set());

  const handleSelectMood = useCallback((key: string) => {
    setSelectedMoods((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else if (next.size < MAX_MOODS) next.add(key);
      return next;
    });
  }, []);

  // At the cap a hero chip only scrolls: swapping out a pick the user can't
  // see from the hero would be a surprise.
  const handlePreselectMood = useCallback((key: string) => {
    setSelectedMoods((prev) =>
      prev.has(key) || prev.size >= MAX_MOODS ? prev : new Set(prev).add(key),
    );
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
