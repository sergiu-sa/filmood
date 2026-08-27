"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import { signupSchema, type SignupFormData } from "@/lib/validations";
import { authErrorMessage } from "@/lib/auth-errors";
import AuthCinemaPanel from "@/components/auth/AuthCinemaPanel";
import { authInputClass } from "@/components/auth/authInputClass";
import Icon from "@/components/ui/Icon";

export default function SignupPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && user) router.push("/");
  }, [user, authLoading, router]);

  const [formData, setFormData] = useState<SignupFormData>({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<string, string[]>>
  >({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setGeneralError(null);

    const result = signupSchema.safeParse(formData);
    if (!result.success) {
      setFieldErrors(result.error.flatten().fieldErrors);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: result.data.email,
      password: result.data.password,
      options: { data: { name: result.data.name } },
    });

    setLoading(false);

    if (error) {
      setGeneralError(authErrorMessage(error));
      return;
    }

    // A session in the response means email confirmation is off;
    //    the user is already signed in, so send them into the app.
    // No session means a confirmation link was mailed; tell them to check it.
    // (An existing-account signup also lands here with no session and empty identities;
    //   the message stays deliberately vague so it can't confirm the address is registered.)
    if (data.session) {
      router.push("/");
      return;
    }

    setSuccess(true);
    setTimeout(() => router.push("/login"), 2000);
  };


  return (
    <main
      className="flex min-h-screen"
      style={{ background: "var(--bg)", color: "var(--t1)" }}
    >
      <AuthCinemaPanel />

      {/* ── Right: form panel ── */}
      <div className="flex flex-1 items-center justify-center overflow-y-auto px-5 py-12 lg:px-12">
        <div className="w-full max-w-100">
          {/* Header */}
          <div className="mb-7">
            <h1
              className="font-serif mb-2 text-[28px] font-semibold leading-[1.2]"
              style={{ color: "var(--t1)" }}
            >
              Create your account
            </h1>
            <p className="text-sm" style={{ color: "var(--t2)" }}>
              Already have one?{" "}
              <Link
                href="/login"
                className="font-medium no-underline hover:underline"
                style={{ color: "var(--gold)" }}
              >
                Log in
              </Link>
            </p>
          </div>

          {/* Success */}
          {success && (
            <div
              className="mb-5 rounded-xl border px-4 py-3 text-sm text-center"
              style={{
                background: "var(--teal-soft)",
                borderColor: "rgba(var(--teal-rgb), 0.2)",
                color: "var(--teal)",
              }}
            >
              Account created! Check your email for a confirmation link, then
              log in.
            </div>
          )}

          {/* General error */}
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

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label
                htmlFor="signup-name"
                className="mb-1.5 block text-xs font-medium"
                style={{ color: "var(--t2)" }}
              >
                Full name
              </label>
              <input
                id="signup-name"
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Your name"
                className={authInputClass(!!fieldErrors.name)}
                style={{ background: "var(--surface)", color: "var(--t1)" }}
              />
              {fieldErrors.name && (
                <p
                  className="mt-1 text-[11px]"
                  style={{ color: "var(--rose)" }}
                >
                  {fieldErrors.name[0]}
                </p>
              )}
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="signup-email"
                className="mb-1.5 block text-xs font-medium"
                style={{ color: "var(--t2)" }}
              >
                Email address
              </label>
              <input
                id="signup-email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
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

            {/* Password */}
            <div>
              <label
                htmlFor="signup-password"
                className="mb-1.5 block text-xs font-medium"
                style={{ color: "var(--t2)" }}
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="signup-password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  placeholder="At least 8 characters"
                  className={authInputClass(!!fieldErrors.password)}
                  style={{ background: "var(--surface)", color: "var(--t1)" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 cursor-pointer border-none bg-transparent text-sm"
                  style={{ color: "var(--t3)" }}
                >
                  <Icon name={showPassword ? "eye-off" : "eye"} size={16} />
                </button>
              </div>
              {fieldErrors.password && (
                <p
                  className="mt-1 text-[11px]"
                  style={{ color: "var(--rose)" }}
                >
                  {fieldErrors.password[0]}
                </p>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label
                htmlFor="signup-confirm-password"
                className="mb-1.5 block text-xs font-medium"
                style={{ color: "var(--t2)" }}
              >
                Confirm password
              </label>
              <div className="relative">
                <input
                  id="signup-confirm-password"
                  type={showConfirm ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      confirmPassword: e.target.value,
                    })
                  }
                  placeholder="Re-enter your password"
                  className={authInputClass(!!fieldErrors.confirmPassword)}
                  style={{ background: "var(--surface)", color: "var(--t1)" }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  aria-label={showConfirm ? "Hide password confirmation" : "Show password confirmation"}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 cursor-pointer border-none bg-transparent text-sm"
                  style={{ color: "var(--t3)" }}
                >
                  <Icon name={showConfirm ? "eye-off" : "eye"} size={16} />
                </button>
              </div>
              {fieldErrors.confirmPassword && (
                <p
                  className="mt-1 text-[11px]"
                  style={{ color: "var(--rose)" }}
                >
                  {fieldErrors.confirmPassword[0]}
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || success}
              className="w-full cursor-pointer rounded-xl border-none py-3.5 text-sm font-semibold transition-all hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: "var(--gold)", color: "var(--accent-ink)" }}
            >
              {loading ? "Creating account..." : "Sign up"}
            </button>
          </form>

          <p
            className="mt-4 text-center text-xs"
            style={{ color: "var(--t3)" }}
          >
            By signing up you agree to our{" "}
            <a
              href="#"
              className="hover:underline"
              style={{ color: "var(--gold)" }}
            >
              Terms
            </a>{" "}
            and{" "}
            <a
              href="#"
              className="hover:underline"
              style={{ color: "var(--gold)" }}
            >
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
