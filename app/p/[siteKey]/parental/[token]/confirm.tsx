"use client";

import { useState } from "react";
import { confirmParentalConsent } from "../actions";

export function ParentalConfirm({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setState("saving");
    setError(null);
    const res = await confirmParentalConsent(token);
    if (res.error) {
      setState("error");
      setError(res.error);
      return;
    }
    setState("done");
  }

  if (state === "done") {
    return (
      <div className="rounded-2xl border border-hairline bg-surface-soft p-6">
        <p className="text-ink">Thank you, your consent is recorded.</p>
        <p className="mt-1 text-sm text-body">
          You can withdraw it at any time by contacting the grievance officer in the privacy notice.
        </p>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={confirm}
        disabled={state === "saving"}
        className="rounded-full bg-primary px-5 py-2.5 font-medium text-white hover:bg-primary-active disabled:opacity-60"
      >
        {state === "saving" ? "Confirming…" : "I am the parent/guardian and I consent"}
      </button>
      {state === "error" && error && <p className="mt-3 text-sm text-amber">{error}</p>}
    </div>
  );
}
