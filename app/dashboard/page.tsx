import Link from "next/link";
import { Suspense } from "react";
import { requireSession } from "@/lib/auth/guard";
import { AuthEvent } from "@/components/analytics/auth-event";
import { listSitesForSetup } from "@/lib/orgs/queries";
import { getSetupState, type SetupState } from "@/lib/sites/setup";
import { isRecentlySeen } from "@/lib/sites/ping";
import { AddSiteForm } from "./add-site-form";
import { EmptyState } from "@/components/ui/empty-state";
import { ApertureMark } from "@/components/aperture/aperture";

export default async function DashboardPage() {
  const session = await requireSession();
  const sites = await listSitesForSetup(session.orgId);
  const withSetup = await Promise.all(
    sites.map(async (s) => ({ site: s, setup: await getSetupState(s.id, s.settings, s.last_seen_at) })),
  );

  return (
    <div className="space-y-8">
      <Suspense>
        <AuthEvent />
      </Suspense>
      <div>
        <h1 className="text-[2rem] leading-tight">Your sites</h1>
        <p className="mt-1 text-body">
          Each site gets one script tag, a guided setup, and its own consent records.
        </p>
      </div>

      <AddSiteForm />

      {withSetup.length === 0 ? (
        <EmptyState
          illustration={<ApertureMark tone="light" size={72} open={0.55} />}
          title="Welcome to Skope"
          hint="Add your domain above and the guided setup takes it from there: one script tag, a consent banner in every Indian language, and records that hold up."
        />
      ) : (
        <ul className="space-y-4">
          {withSetup.map(({ site, setup }) => (
            <li key={site.id}>
              <SiteCard
                siteId={site.id}
                domain={site.domain}
                setup={setup}
                live={isRecentlySeen(site.last_seen_at)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * One functional status pill per site. Colour carries meaning only:
 * green = script seen recently and setup complete; amber = setup pending;
 * red = setup says done but we haven't seen the script load lately.
 */
function statusPill(setup: SetupState, live: boolean): { label: string; cls: string; dot: string } {
  if (!setup.allComplete) {
    return { label: "Setup pending", cls: "bg-amber/15 text-amber-deep", dot: "bg-amber" };
  }
  if (!live) {
    return { label: "Script not detected", cls: "bg-danger/10 text-danger", dot: "bg-danger" };
  }
  return { label: "Live", cls: "bg-success/10 text-success", dot: "bg-success" };
}

function SiteCard({
  siteId,
  domain,
  setup,
  live,
}: {
  siteId: string;
  domain: string;
  setup: SetupState;
  live: boolean;
}) {
  const doneCount = setup.steps.filter((s) => s.done).length;
  const cta = setup.allComplete ? "Manage" : doneCount === 0 ? "Start setup" : "Resume setup";
  const pill = statusPill(setup, live);

  return (
    <Link
      href={`/dashboard/sites/${siteId}`}
      className="block rounded-3xl border border-hairline-soft bg-canvas p-6 shadow-card transition-all hover:border-primary/30 hover:shadow-card-hover"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2.5">
          <span className="text-ink">{domain}</span>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${pill.cls}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${pill.dot}`} />
            {pill.label}
          </span>
        </span>
        <span className="text-sm font-medium text-primary">{cta} →</span>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-strong">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${setup.percent}%` }} />
        </div>
        <span className="shrink-0 text-sm text-muted">
          {setup.allComplete ? "All set" : `${doneCount} of ${setup.steps.length} · ${setup.percent}%`}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {setup.steps.map((step) => (
          <span
            key={step.key}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${
              step.done ? "bg-success/10 text-success" : "bg-surface-strong text-muted"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${step.done ? "bg-success" : "bg-muted"}`} />
            {step.label}
          </span>
        ))}
      </div>
    </Link>
  );
}
