"use client";

import { useState } from "react";
import Link from "next/link";
import { ApertureMark } from "@/components/aperture/aperture";
import { IntegrationGuide } from "@/components/integration-guide";
import { markStepComplete } from "./setup-actions";
import { BannerCustomizer } from "./banner-customizer";
import { ContactForm } from "./contact/contact-form";
import { DataItemsEditor } from "./data/data-items-editor";
import { PolicyEditor } from "./policy/policy-editor";
import type { SetupState, SetupStep, SetupStepKey } from "@/lib/sites/setup";
import type { BannerSettings } from "@/lib/banner/settings";
import type { ContactSettings } from "@/lib/contact/settings";
import type { DataItem } from "@/lib/data-items/types";
import type { NoticeRow } from "@/lib/notices/store";

interface WizardData {
  siteId: string;
  siteKey: string;
  domain: string;
  banner: BannerSettings;
  contact: ContactSettings;
  dataItems: DataItem[];
  latestNotice: NoticeRow | null;
  contactReady: boolean;
  initial: SetupState;
}

export function SiteWizard(props: WizardData) {
  const { siteId, siteKey, domain, banner, contact, dataItems, latestNotice, contactReady, initial } = props;

  const [done, setDone] = useState<Record<SetupStepKey, boolean>>(() => {
    const map = { install: false, banner: false, data: false, contact: false, policy: false } as Record<SetupStepKey, boolean>;
    for (const s of initial.steps) map[s.key] = s.done;
    return map;
  });
  const [bannerSaved, setBannerSaved] = useState(false);

  const order = initial.steps;
  const doneCount = order.filter((s) => done[s.key]).length;
  const percent = Math.round((doneCount / order.length) * 100);
  const allComplete = doneCount === order.length;
  const activeKey = order.find((s) => !done[s.key])?.key ?? null;

  const [open, setOpen] = useState<SetupStepKey | null>(activeKey ?? null);

  async function complete(step: SetupStepKey) {
    const nextDone = { ...done, [step]: true };
    setDone(nextDone);
    // Open the next not-yet-done step (or collapse when everything's done).
    setOpen(order.find((s) => !nextDone[s.key])?.key ?? null);
    await markStepComplete(siteId, step);
  }

  function toggle(step: SetupStepKey) {
    setOpen((o) => (o === step ? null : step));
  }

  return (
    <div className="space-y-6">
      <ProgressHeader percent={percent} doneCount={doneCount} total={order.length} allComplete={allComplete} />

      <ol className="space-y-3">
        {order.map((step, i) => (
          <StepRow
            key={step.key}
            step={step}
            index={i}
            done={done[step.key]}
            isActive={step.key === activeKey}
            isOpen={open === step.key}
            onToggle={() => toggle(step.key)}
          >
            {renderBody(step.key)}
          </StepRow>
        ))}
      </ol>

      {allComplete && <CompletionPanel />}
    </div>
  );

  function renderBody(key: SetupStepKey) {
    switch (key) {
      case "install":
        return (
          <div className="space-y-3">
            <p className="text-sm text-body">
              Add the tag below, open your site, and we&apos;ll detect it automatically. This step
              completes once we see Skope running live.
            </p>
            <IntegrationGuide
              siteKey={siteKey}
              siteId={siteId}
              domain={domain}
              onVerified={() => complete("install")}
            />
          </div>
        );
      case "banner":
        return (
          <div className="space-y-5">
            <BannerCustomizer
              siteId={siteId}
              initial={banner}
              dataItems={dataItems.map((d) => ({ key: d.key, name: d.name, purposeKey: d.purposeKey, source: d.sourceLabel }))}
              onSaved={() => setBannerSaved(true)}
            />
            <div className="flex items-center gap-3 border-t border-hairline pt-4">
              <button
                onClick={() => complete("banner")}
                className="rounded-full bg-primary px-5 py-2.5 font-medium text-white transition-colors hover:bg-primary-active"
              >
                Looks good, continue
              </button>
              {!bannerSaved && <span className="text-sm text-muted">Save your changes above first.</span>}
            </div>
          </div>
        );
      case "data":
        return <DataItemsEditor siteId={siteId} initial={dataItems} onSaved={() => complete("data")} />;
      case "contact":
        return <ContactForm siteId={siteId} initial={contact} onSaved={() => complete("contact")} />;
      case "policy":
        return (
          <PolicyEditor
            siteId={siteId}
            siteKey={siteKey}
            initial={latestNotice}
            contactReady={contactReady}
            onPublished={() => complete("policy")}
          />
        );
    }
  }
}

function ProgressHeader({
  percent,
  doneCount,
  total,
  allComplete,
}: {
  percent: number;
  doneCount: number;
  total: number;
  allComplete: boolean;
}) {
  const headline = allComplete
    ? "You're compliance-ready."
    : doneCount === 0
      ? "Let's get you set up."
      : "Nice progress, keep going.";
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-ink">{headline}</p>
        <p className="text-sm text-muted">
          {doneCount} of {total} done · {percent}%
        </p>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-strong">
        <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function StepRow({
  step,
  index,
  done,
  isActive,
  isOpen,
  onToggle,
  children,
}: {
  step: SetupStep;
  index: number;
  done: boolean;
  isActive: boolean;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const action = done ? "Update" : isActive ? "Continue" : "Open";
  return (
    <li className={`rounded-2xl border bg-canvas shadow-card ${isOpen ? "border-primary/40" : "border-hairline-soft"}`}>
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-5 py-4 text-left"
        aria-expanded={isOpen}
      >
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-medium ${
            done ? "bg-primary text-white" : isActive ? "border border-primary text-primary" : "border border-hairline text-muted"
          }`}
        >
          {done ? <Check /> : index + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className={done || isActive ? "text-ink" : "text-body"}>{step.label}</span>
            {done && <span className="text-xs text-success">Done</span>}
          </span>
          <span className="mt-0.5 block text-sm text-muted">{step.hint}</span>
        </span>
        <span className={`shrink-0 text-sm font-medium ${isActive && !done ? "text-primary" : "text-muted"}`}>
          {isOpen ? "Close" : action}
        </span>
      </button>
      {isOpen && <div className="border-t border-hairline px-5 py-5">{children}</div>}
    </li>
  );
}

function CompletionPanel() {
  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-surface-dark p-8 text-center">
        <div className="mx-auto w-fit">
          <ApertureMark tone="dark" size={64} />
        </div>
        <h2 className="mt-5 text-2xl text-white">You&apos;re compliance-ready</h2>
        <p className="mx-auto mt-2 max-w-md text-on-dark-soft">
          Your banner is live, trackers stay blocked until consent, your privacy notice is published,
          and every choice is recorded as a tamper-evident receipt.
        </p>
      </div>

      <div className="rounded-2xl border border-hairline border-l-2 border-l-primary bg-surface-soft p-6">
        <h3 className="text-base text-ink">What happens next: handling requests</h3>
        <p className="mt-2 text-sm text-body">
          Under DPDP, visitors can ask to access, correct, or erase their data, nominate someone, or
          raise a grievance. They submit these from their privacy preferences page, and each one lands
          in your <span className="text-ink">Requests</span> queue with a due-date clock so you respond
          in time. You confirm it&apos;s them by email, work it, and close it with a note.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/dashboard/requests"
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-active"
          >
            Go to Requests
          </Link>
          <Link
            href="/dashboard/records"
            className="rounded-full border border-hairline px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-surface-strong"
          >
            View consent records
          </Link>
        </div>
      </div>
    </div>
  );
}

function Check() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
