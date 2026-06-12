"use client";

import { useState } from "react";
import { FieldHint } from "@/components/ui/field-hint";
import { Callout } from "@/components/ui/callout";
import { saveContactSettings } from "../actions";
import type { ContactSettings } from "@/lib/contact/settings";

export function ContactForm({
  siteId,
  initial,
  onSaved,
}: {
  siteId: string;
  initial: ContactSettings;
  /** Called after a successful save with a valid grievance contact. */
  onSaved?: () => void;
}) {
  const [c, setC] = useState<ContactSettings>(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  function set<K extends keyof ContactSettings>(key: K, value: ContactSettings[K]) {
    setC((prev) => ({ ...prev, [key]: value }));
    setState("idle");
    setMessage(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("saving");
    setMessage(null);
    const res = await saveContactSettings(siteId, c);
    if (res.error) {
      setState("error");
      setMessage(res.error);
      return;
    }
    if (res.contact) setC(res.contact);
    setState("saved");
    onSaved?.();
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-8">
      <section className="space-y-4">
        <div>
          <h2 className="text-lg text-ink">Your organisation</h2>
          <p className="mt-1 text-sm text-body">
            The legal name of the business responsible for this site. It appears in your privacy
            notice as the Data Fiduciary.
          </p>
        </div>
        <Field label="Organisation name" hint="For example, XYZ Pvt Ltd.">
          <Input value={c.entityName} onChange={(v) => set("entityName", v)} placeholder="Acme Retail Pvt Ltd" />
        </Field>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg text-ink">Grievance officer</h2>
          <p className="mt-1 text-sm text-body">
            DPDP §13 requires a readily-available way for people to raise a grievance about how you
            handle their data. This contact is published on your privacy notice.
          </p>
        </div>

        <Field label="Name" hint="The person or role responsible for grievance redressal.">
          <Input value={c.grievanceName} onChange={(v) => set("grievanceName", v)} placeholder="Priya Sharma" />
        </Field>
        <Field label="Email" hint="People reach the grievance officer here. A monitored inbox.">
          <Input type="email" value={c.grievanceEmail} onChange={(v) => set("grievanceEmail", v)} placeholder="grievance@yourstore.in" />
        </Field>
        <Field label="Phone" hint="Optional. A number people can call if they prefer.">
          <Input value={c.grievancePhone} onChange={(v) => set("grievancePhone", v)} placeholder="+91 98765 43210" />
        </Field>
        <Field label="Address" hint="Optional. A postal address for formal notices.">
          <Textarea value={c.grievanceAddress} onChange={(v) => set("grievanceAddress", v)} placeholder="Registered office address" />
        </Field>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg text-ink">Data Protection Officer</h2>
          <p className="mt-1 text-sm text-body">
            Optional for most businesses, mandatory if you are a Significant Data Fiduciary. If you
            have a DPO, list them so people can reach the person who answers rights questions.
          </p>
        </div>
        <Field label="DPO name" hint="Leave blank if you don't have a designated DPO.">
          <Input value={c.dpoName} onChange={(v) => set("dpoName", v)} placeholder="Optional" />
        </Field>
        <Field label="DPO email" hint="Optional.">
          <Input type="email" value={c.dpoEmail} onChange={(v) => set("dpoEmail", v)} placeholder="dpo@yourstore.in" />
        </Field>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg text-ink">Response window</h2>
          <p className="mt-1 text-sm text-body">
            How many days you commit to respond to a data-subject request. This sets the due-date
            clock on each request in your queue.
          </p>
        </div>
        <Field label="Days to respond" hint="Confirm the right window with your lawyer before launch.">
          <input
            type="number"
            min={1}
            max={180}
            value={c.responseDays}
            onChange={(e) => set("responseDays", Number(e.target.value))}
            className="w-32 rounded-xl border border-hairline bg-canvas px-4 py-2.5 text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </Field>
      </section>

      <Callout tone="warn" title="Get this reviewed">
        These details are used in your privacy notice. Review and confirm them before launch.
      </Callout>

      {message && <p className="text-sm text-ink">{message}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={state === "saving"}
          className="rounded-full bg-primary px-6 py-2.5 font-medium text-white transition-colors hover:bg-primary-active disabled:opacity-60"
        >
          {state === "saving" ? "Saving…" : "Save contact"}
        </button>
        {state === "saved" && <span className="text-sm text-success">Saved.</span>}
      </div>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-ink">{label}</label>
      <div className="mt-1.5">{children}</div>
      {hint && <FieldHint>{hint}</FieldHint>}
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl border border-hairline bg-canvas px-4 py-2.5 text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
    />
  );
}

function Textarea({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={2}
      className="w-full rounded-xl border border-hairline bg-canvas px-4 py-2.5 text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
    />
  );
}
