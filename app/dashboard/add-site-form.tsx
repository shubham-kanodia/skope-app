"use client";

import { useActionState, useEffect } from "react";
import { addSite, type AddSiteState } from "./actions";
import { track } from "@/lib/analytics/gtag";
import { FieldHint } from "@/components/ui/field-hint";
import { Tooltip } from "@/components/ui/tooltip";

const initial: AddSiteState = {};

export function AddSiteForm() {
  const [state, formAction, pending] = useActionState(addSite, initial);

  // Each submission returns a fresh state object, so this fires once per added site.
  useEffect(() => {
    if (state.ok) track("site_created", {});
  }, [state]);

  return (
    <form action={formAction} className="rounded-3xl border border-hairline-soft bg-canvas p-6 shadow-card">
      <label htmlFor="domain" className="flex items-center gap-1.5 text-sm font-medium text-ink">
        Add a site
        <Tooltip term="siteKey" />
      </label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          id="domain"
          name="domain"
          type="text"
          required
          placeholder="yourstore.in"
          className="flex-1 rounded-xl border border-hairline bg-canvas px-4 py-3 text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-primary px-5 py-3 font-medium text-white transition-colors hover:bg-primary-active disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add site"}
        </button>
      </div>
      <FieldHint>
        Just the domain, we generate your install snippet next. You can change the
        banner and languages anytime.
      </FieldHint>
      {state.error && <p className="mt-2 text-sm text-ink">{state.error}</p>}
    </form>
  );
}
