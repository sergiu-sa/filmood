"use client";

import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";
import { useEffect } from "react";
import ProfileHero from "@/components/profile/ProfileHero";
import AccountSettings from "@/components/profile/AccountSettings";
import StreamingPreferences from "@/components/profile/StreamingPreferences";
import MoodHistory from "@/components/profile/MoodHistory";
import WatchlistPreview from "@/components/profile/WatchlistPreview";
import DangerZone from "@/components/profile/DangerZone";
import RecentGroupSessions from "@/components/profile/RecentGroupSessions";

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <main className="min-h-screen bg-(--bg) flex items-center justify-center">
        <p className="text-[14px] text-(--t3)">Loading...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-(--bg)">
      <div className="mx-auto max-w-275 px-7 pt-8 pb-16 md:px-3.5 md:pt-5 md:pb-12">
        <div style={{ marginBottom: "16px" }}>
          <Breadcrumb
            items={[
              { label: "Home", href: "/" },
              { label: "Profile" },
            ]}
          />
        </div>
        <ProfileHero user={user} />

        <div className="mt-5 grid grid-cols-1 gap-5 items-start lg:grid-cols-[340px_1fr]">
          <div>
            <AccountSettings user={user} />
            <StreamingPreferences />
            <DangerZone />
          </div>
          <div>
            <MoodHistory />
            <WatchlistPreview />
            <RecentGroupSessions />
          </div>
        </div>
      </div>
    </main>
  );
}
