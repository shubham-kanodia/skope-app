import Link from "next/link";
import { requireSession } from "@/lib/auth/guard";
import { getOrgGate, blockedReason } from "@/lib/billing/gate";
import { EntitlementBanner } from "@/components/entitlement-banner";
import { Logo } from "@/components/ui/logo";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const gate = await getOrgGate(session.orgId);
  const reason = gate ? blockedReason(gate) : null;

  return (
    <div className="flex min-h-screen">
      {/* Sidebar (lg and up) */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-hairline lg:flex">
        <div className="px-5 py-5">
          <Logo />
        </div>
        <div className="flex-1 px-3 py-2">
          <SidebarNav canTeam={gate?.limits.teamSeats ? gate.limits.teamSeats > 1 : false} />
        </div>
        <div className="border-t border-hairline px-5 py-4">
          <p className="truncate text-sm text-ink">{gate?.org.name}</p>
          <form action="/api/auth/logout" method="post">
            <button className="mt-1 text-sm text-muted hover:text-ink" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Content column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar + nav (below lg) */}
        <header className="flex items-center justify-between border-b border-hairline px-5 py-3 lg:hidden">
          <Logo />
          <form action="/api/auth/logout" method="post">
            <button className="text-sm text-muted hover:text-ink" type="submit">
              Sign out
            </button>
          </form>
        </header>
        <div className="overflow-x-auto border-b border-hairline px-3 py-2 lg:hidden">
          <SidebarNav orientation="horizontal" canTeam={gate?.limits.teamSeats ? gate.limits.teamSeats > 1 : false} />
        </div>

        {gate && <EntitlementBanner entitlement={gate.entitlement} />}

        {reason && (
          <div className="border-b border-amber/30 bg-amber/10 px-6 py-3 sm:px-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-ink">{reason}</p>
              <Link
                href="/dashboard/billing"
                className="shrink-0 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-active"
              >
                See plans
              </Link>
            </div>
          </div>
        )}

        <main className="px-6 py-10 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
