import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/guard";
import { AssistantChat } from "./assistant-chat";

export const metadata: Metadata = { title: "Compliance assistant" };

export default async function AssistantPage() {
  await requireSession();

  return (
    <div className="flex h-full flex-col space-y-6">
      <div>
        <h1 className="text-[2rem] leading-tight">Compliance assistant</h1>
        <p className="mt-1 text-body">
          Ask anything about DPDP or your setup, answers use your sites&apos; actual state.
        </p>
        <p className="mt-1 text-sm text-muted">
          General guidance about DPDP, not legal advice. For high-stakes calls, talk to your lawyer.
        </p>
      </div>

      <AssistantChat />
    </div>
  );
}
