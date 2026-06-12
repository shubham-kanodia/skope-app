import { contactFromSettings, hasGrievanceContact } from "@/lib/contact/settings";
import { countDataItems } from "@/lib/data-items/store";
import { getLatestPublishedNotice } from "@/lib/notices/store";
import { isRecentlySeen } from "@/lib/sites/ping";

/**
 * The guided onboarding for a site: install the script, customise the banner,
 * add the contact, publish the privacy notice. Drives the wizard and the Sites
 * list progress cards.
 *
 * Completion is persisted in `sites.settings.setup` (a per-step boolean map) and
 * advanced explicitly by the wizard. Some steps also derive "done" from real
 * signals so progress never regresses or under-reports: install from a recent
 * observed load, contact from a saved grievance officer, policy from a published
 * notice.
 */
export type SetupStepKey = "install" | "banner" | "data" | "contact" | "policy";

export interface SetupStep {
  key: SetupStepKey;
  label: string;
  hint: string;
  done: boolean;
}

export interface SetupState {
  steps: SetupStep[];
  percent: number;
  /** First not-done step, the suggested next action. Null when all are done. */
  activeKey: SetupStepKey | null;
  allComplete: boolean;
}

export interface SetupFlags {
  install?: boolean;
  banner?: boolean;
  data?: boolean;
  contact?: boolean;
  policy?: boolean;
  completedAt?: string;
}

export function setupFlags(settings: Record<string, unknown>): SetupFlags {
  const raw = (settings as { setup?: unknown }).setup;
  return raw && typeof raw === "object" ? (raw as SetupFlags) : {};
}

const META: Record<SetupStepKey, { label: string; hint: string }> = {
  install: {
    label: "Install Skope",
    hint: "Add one script tag so the banner shows and trackers stay blocked until consent.",
  },
  banner: {
    label: "Customize your banner",
    hint: "Make the consent banner match your brand and explain what you collect.",
  },
  data: {
    label: "Declare the data you collect",
    hint: "List the personal data your forms collect, DPDP requires your notice to itemize it.",
  },
  contact: {
    label: "Add your contact",
    hint: "Publish a grievance officer so people can reach you, DPDP requires this.",
  },
  policy: {
    label: "Publish your privacy notice",
    hint: "Generate a DPDP privacy notice from your settings and publish it.",
  },
};

export async function getSetupState(
  siteId: string,
  settings: Record<string, unknown>,
  lastSeenAt?: string | null,
): Promise<SetupState> {
  const flags = setupFlags(settings);

  const installDone = !!flags.install || isRecentlySeen(lastSeenAt);
  const bannerDone = !!flags.banner;
  const dataDone = !!flags.data || (await countDataItems(siteId)) > 0;
  const contactDone = !!flags.contact || hasGrievanceContact(contactFromSettings(settings));
  const policyDone = !!flags.policy || (await getLatestPublishedNotice(siteId)) !== null;

  const order: { key: SetupStepKey; done: boolean }[] = [
    { key: "install", done: installDone },
    { key: "banner", done: bannerDone },
    { key: "data", done: dataDone },
    { key: "contact", done: contactDone },
    { key: "policy", done: policyDone },
  ];

  const steps: SetupStep[] = order.map(({ key, done }) => ({ key, label: META[key].label, hint: META[key].hint, done }));
  const doneCount = steps.filter((s) => s.done).length;
  const percent = Math.round((doneCount / steps.length) * 100);
  const activeKey = steps.find((s) => !s.done)?.key ?? null;

  return { steps, percent, activeKey, allComplete: doneCount === steps.length };
}
