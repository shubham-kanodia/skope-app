import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { getInviteByToken } from "@/lib/team/invites";
import { LoginForm } from "@/app/login/login-form";

export const metadata: Metadata = { title: "Accept your invite, Skope", robots: { index: false, follow: false } };

const ROLE_LABEL: Record<string, string> = { admin: "admin", viewer: "viewer" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await getInviteByToken(token);

  return (
    <main className="flex min-h-screen flex-col px-6 py-8 sm:px-12">
      <Logo />
      <div className="flex flex-1 items-center py-12">
        <div className="w-full max-w-sm">
          {!invite ? (
            <>
              <h1 className="text-[2rem] leading-tight">Invite not found</h1>
              <p className="mt-2 text-body">
                This invite is invalid or has expired. Ask whoever invited you to send a new one.
              </p>
              <Link href="/login" className="mt-6 inline-block text-sm font-medium text-primary hover:text-primary-active">
                Go to sign in →
              </Link>
            </>
          ) : (
            <>
              <h1 className="text-[2rem] leading-tight">Join {invite.orgName}</h1>
              <p className="mt-2 text-body">
                You&apos;ve been invited to join {invite.orgName} on Skope as a{" "}
                <span className="text-ink">{ROLE_LABEL[invite.role] ?? invite.role}</span>. Sign in with{" "}
                <span className="text-ink">{invite.email}</span> to accept, we&apos;ll email you a one-time link.
              </p>
              <div className="mt-6">
                <Suspense>
                  <LoginForm fixedEmail={invite.email} />
                </Suspense>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
