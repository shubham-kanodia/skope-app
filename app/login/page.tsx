import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { Logo } from "@/components/ui/logo";
import { ApertureMark } from "@/components/aperture/aperture";

export const metadata: Metadata = { title: "Sign in, Skope" };

const ERRORS: Record<string, string> = {
  expired: "That link expired or was already used. Enter your email for a fresh one.",
  missing: "That link was incomplete. Enter your email to get a new one.",
  server: "Something broke on our side. Try again in a minute.",
};

const VALUE_ROWS = [
  { text: "One script tag", emphasis: false },
  { text: "Live in 30 minutes, no demo calls", emphasis: false },
  { text: "Founding members → 6 months free", emphasis: true },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ref?: string }>;
}) {
  const { error, ref } = await searchParams;
  const errorMessage = error ? (ERRORS[error] ?? ERRORS.server) : null;

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Left, form */}
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Logo />
        <div className="flex flex-1 items-center py-12">
          <div className="w-full max-w-sm">
            <h1 className="text-[2rem] leading-tight">Sign in</h1>
            <p className="mt-2 text-body">No passwords. We email you a one-time link.</p>

            {errorMessage && (
              <div className="mt-5 rounded-2xl border border-hairline bg-surface-soft px-4 py-3 text-sm text-ink">
                {errorMessage}
              </div>
            )}

            {ref && (
              <p className="mt-4 rounded-2xl border border-hairline bg-surface-soft px-4 py-3 text-sm text-body">
                You were invited with a referral, you&apos;ll get an extra month free when you sign up.
              </p>
            )}

            <div className="mt-6">
              <Suspense>
                <LoginForm refCode={ref ?? null} />
              </Suspense>
            </div>

            <p className="mt-6 text-sm text-muted">
              New here? The same link creates your account. Our founding members get
              <span className="text-ink"> 6 months free</span>, every other account starts
              with a 30-day trial.
            </p>
            <p className="mt-4 text-sm text-muted">
              Not ready yet?{" "}
              <a href="/compliance-checker" className="font-medium text-primary hover:text-primary-active">
                Check your site&apos;s DPDP compliance →
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* Right, brand panel */}
      <div className="relative hidden overflow-hidden bg-surface-dark lg:flex lg:flex-col lg:justify-center lg:px-14">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(420px circle at 28% 32%, rgba(60,125,255,0.20), transparent 62%)",
          }}
        />
        <div className="relative">
          <ApertureMark tone="dark" size={112} />
          <h2 className="mt-9 max-w-md text-[2.6rem] leading-[1.04] text-white">
            Consent, handled.
          </h2>
          <p className="mt-3 max-w-sm text-on-dark-soft">
            DPDP compliance for small Indian teams, without the demo calls or the
            six-figure quotes.
          </p>
          <ul className="mt-9 space-y-3.5">
            {VALUE_ROWS.map((row) => (
              <li key={row.text} className="flex items-center gap-3">
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                  style={{ background: "rgba(60,125,255,0.14)" }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#3c7dff" strokeWidth="3" aria-hidden>
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </span>
                <span className={row.emphasis ? "text-white" : "text-on-dark-soft"}>
                  {row.text}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
