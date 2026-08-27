"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  forgotPasswordSchema,
  type ForgotPasswordFormData,
} from "@/lib/validations";
import { authErrorMessage } from "@/lib/auth-errors";
import AuthCinemaPanel from "@/components/auth/AuthCinemaPanel";
import { authInputClass } from "@/components/auth/authInputClass";

export default function ForgotPasswordPage() {
  const [formData, setFormData] = useState<ForgotPasswordFormData>({
    email: "",
  });
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<string, string[]>>
  >({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setGeneralError(null);

    const result = forgotPasswordSchema.safeParse(formData);
    if (!result.success) {
      setFieldErrors(result.error.flatten().fieldErrors);
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(
      result.data.email,
      { redirectTo: `${window.location.origin}/reset-password` },
    );
    setLoading(false);

    if (error) {
      setGeneralError(authErrorMessage(error));
      return;
    }

    // Shown even for addresses with no account;
    //  telling them apart would turn this form into an account-enumeration oracle.
    setSent(true);
  };


  return (
    <main
      className="flex min-h-screen"
      style={{ background: "var(--bg)", color: "var(--t1)" }}
    >
      <AuthCinemaPanel />

      <div className="flex flex-1 items-center justify-center overflow-y-auto px-5 py-12 lg:px-12">
        <div className="w-full max-w-100">
          <div className="mb-7">
            <h1
              className="font-serif mb-2 text-[28px] font-semibold leading-[1.2]"
              style={{ color: "var(--t1)" }}
            >
              Reset your password
            </h1>
            <p className="text-sm" style={{ color: "var(--t2)" }}>
              Remembered it?{" "}
              <Link
                href="/login"
                className="font-medium no-underline hover:underline"
                style={{ color: "var(--gold)" }}
              >
                Back to log in
              </Link>
            </p>
          </div>

          <div role="alert" aria-live="assertive">
            {generalError && (
              <div
                className="mb-5 rounded-xl border px-4 py-3 text-sm"
                style={{
                  background: "var(--rose-soft)",
                  borderColor: "rgba(var(--rose-rgb), 0.2)",
                  color: "var(--rose)",
                }}
              >
                {generalError}
              </div>
            )}
          </div>

          {sent ? (
            <div
              className="rounded-xl border px-4 py-4 text-sm leading-relaxed"
              style={{
                background: "var(--teal-soft)",
                borderColor: "rgba(var(--teal-rgb), 0.2)",
                color: "var(--teal)",
              }}
              role="status"
            >
              If an account exists for{" "}
              <strong>{formData.email}</strong>, a reset link is on its way.
              The link expires in an hour.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p
                className="text-sm leading-relaxed"
                style={{ color: "var(--t2)" }}
              >
                Enter the email you signed up with and we&rsquo;ll send you a
                link to choose a new password.
              </p>

              <div>
                <label
                  htmlFor="forgot-email"
                  className="mb-1.5 block text-xs font-medium"
                  style={{ color: "var(--t2)" }}
                >
                  Email address
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ email: e.target.value })}
                  placeholder="you@example.com"
                  className={authInputClass(!!fieldErrors.email)}
                  style={{ background: "var(--surface)", color: "var(--t1)" }}
                />
                {fieldErrors.email && (
                  <p
                    className="mt-1 text-[11px]"
                    style={{ color: "var(--rose)" }}
                  >
                    {fieldErrors.email[0]}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full cursor-pointer rounded-xl border-none py-3.5 text-sm font-semibold transition-all hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  background: "var(--gold)",
                  color: "var(--accent-ink)",
                }}
              >
                {loading ? "Sending link..." : "Send reset link"}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
