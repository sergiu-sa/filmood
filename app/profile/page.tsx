"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import Breadcrumb from "@/components/Breadcrumb";
import ProfileHero from "@/components/profile/ProfileHero";
import ProfileTabs, {
  useProfileTab,
  type ProfileTab,
} from "@/components/profile/ProfileTabs";
import TasteFingerprint from "@/components/profile/TasteFingerprint";
import RecentGroupSessions from "@/components/profile/RecentGroupSessions";
import WatchlistPreview from "@/components/profile/WatchlistPreview";
import ContinueResearching from "@/components/profile/ContinueResearching";
import ActivityTimeline from "@/components/profile/ActivityTimeline";
import AccountSettings from "@/components/profile/AccountSettings";
import StreamingPreferences from "@/components/profile/StreamingPreferences";
import DangerZone from "@/components/profile/DangerZone";

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useProfileTab();

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--bg)" }}
      >
        <p style={{ fontSize: "13px", color: "var(--t3)" }}>Loading…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen" style={{ background: "var(--bg)" }}>
      <div className="mx-auto max-w-275 px-7 pt-8 pb-16 md:px-3.5 md:pt-5 md:pb-12">
        <div style={{ marginBottom: "16px" }}>
          <Breadcrumb
            items={[{ label: "Home", href: "/" }, { label: "Profile" }]}
          />
        </div>

        <ProfileHero user={user} />

        <ProfileTabs active={tab} onChange={(t: ProfileTab) => setTab(t)} />

        {tab === "taste" && (
          <section aria-labelledby="taste-heading">
            <p
              id="taste-heading"
              style={{
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "1.8px",
                textTransform: "uppercase",
                color: "var(--t3)",
                margin: "0 0 12px",
              }}
            >
              Your Filmood fingerprint
            </p>
            <TasteFingerprint />
          </section>
        )}

        {tab === "films" && (
          <section aria-labelledby="films-heading">
            <p
              id="films-heading"
              style={{
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "1.8px",
                textTransform: "uppercase",
                color: "var(--t3)",
                margin: "0 0 12px",
              }}
            >
              Films
            </p>
            <ContinueResearching />
            <WatchlistPreview />
            <RecentGroupSessions />
          </section>
        )}

        {tab === "activity" && (
          <section aria-labelledby="activity-heading">
            <p
              id="activity-heading"
              style={{
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "1.8px",
                textTransform: "uppercase",
                color: "var(--t3)",
                margin: "0 0 12px",
              }}
            >
              Activity
            </p>
            <ActivityTimeline />
          </section>
        )}

        {tab === "account" && (
          <section
            aria-labelledby="account-heading"
            className="grid grid-cols-1 gap-5 lg:grid-cols-[340px_1fr]"
          >
            <p id="account-heading" className="sr-only">
              Account
            </p>
            <div>
              <AccountSettings user={user} />
            </div>
          </section>
        )}

        {tab === "settings" && (
          <section
            aria-labelledby="settings-heading"
            className="grid grid-cols-1 gap-5 lg:grid-cols-[340px_1fr]"
          >
            <p id="settings-heading" className="sr-only">
              Settings
            </p>
            <div>
              <StreamingPreferences />
              <DangerZone />
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
