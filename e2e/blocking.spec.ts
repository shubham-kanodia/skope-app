import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Proves the tracker-blocking guarantee end-to-end in a real browser:
 *   - tagged tracker scripts DO NOT execute or make network requests before consent,
 *   - they run immediately when their purpose is granted,
 *   - reject / per-purpose choices are honoured,
 *   - Google Consent Mode v2 defaults to denied,
 *   - a prior decision is re-applied on reload without re-prompting.
 *
 * All network is mocked, so this tests skope.js in isolation (no server/DB).
 */
const skopeJs = readFileSync(join(__dirname, "..", "public", "skope.js"), "utf8");

const CFG = {
  siteKey: "sk_test",
  banner: {
    layout: "bar",
    accent: "#0052ff",
    heading: "Your privacy, your choice",
    description: "We use cookies.",
    acceptLabel: "Accept all",
    rejectLabel: "Reject non-essential",
    manageLabel: "Manage choices",
    showLangSwitcher: false,
    languages: ["en"],
  },
  purposes: [
    { key: "necessary", isEssential: true, name: { en: "Necessary" }, description: { en: "x" } },
    { key: "analytics", isEssential: false, name: { en: "Analytics" }, description: { en: "x" } },
    { key: "marketing", isEssential: false, name: { en: "Marketing" }, description: { en: "x" } },
  ],
  noticeVersion: 1,
  defaultLanguage: "en",
  geo: { region: "IN", showBanner: true, nonTargetBehavior: "allow_all" },
};

const FIXTURE = `<!doctype html><html><head>
<script src="http://cmp.test/skope.js" data-site="sk_test"></script>
</head><body><h1>Test site</h1>
<script type="text/plain" data-skope data-skope-purpose="analytics">
  window.__analyticsRan = true; new Image().src = "https://tracker.test/collect?p=ga";
</script>
<script type="text/plain" data-skope data-skope-purpose="marketing">
  window.__marketingRan = true; new Image().src = "https://tracker.test/collect?p=ads";
</script>
</body></html>`;

async function setup(page: Page): Promise<string[]> {
  const hits: string[] = [];
  await page.route("http://cmp.test/skope.js", (r) =>
    r.fulfill({ contentType: "application/javascript", body: skopeJs }),
  );
  await page.route("http://cmp.test/api/cfg/**", (r) =>
    r.fulfill({ contentType: "application/json", body: JSON.stringify(CFG) }),
  );
  await page.route("http://cmp.test/api/v1/consent", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' }),
  );
  await page.route("http://site.test/", (r) => r.fulfill({ contentType: "text/html", body: FIXTURE }));
  await page.route("https://tracker.test/**", (r) => {
    hits.push(r.request().url());
    return r.fulfill({ status: 200, body: "" });
  });
  return hits;
}

const ran = (page: Page, flag: "__analyticsRan" | "__marketingRan") =>
  page.evaluate((f) => (window as unknown as Record<string, boolean>)[f], flag);

test("trackers are blocked before any consent", async ({ page }) => {
  const hits = await setup(page);
  await page.goto("http://site.test/");
  await expect(page.getByText("Accept all")).toBeVisible();

  expect(await ran(page, "__analyticsRan")).toBeFalsy();
  expect(await ran(page, "__marketingRan")).toBeFalsy();
  expect(hits).toHaveLength(0);

  // Google Consent Mode v2 defaulted to denied.
  const denied = await page.evaluate(() =>
    (window as unknown as { dataLayer?: unknown[][] }).dataLayer?.some(
      (a) => a[0] === "consent" && a[1] === "default" && (a[2] as { analytics_storage?: string })?.analytics_storage === "denied",
    ),
  );
  expect(denied).toBeTruthy();
});

test("Accept all releases every tracker", async ({ page }) => {
  const hits = await setup(page);
  await page.goto("http://site.test/");
  await page.getByText("Accept all").click();

  await expect.poll(() => ran(page, "__analyticsRan")).toBe(true);
  await expect.poll(() => ran(page, "__marketingRan")).toBe(true);
  await expect.poll(() => hits.some((h) => h.includes("p=ga"))).toBe(true);
  await expect.poll(() => hits.some((h) => h.includes("p=ads"))).toBe(true);
});

test("Reject keeps trackers blocked", async ({ page }) => {
  const hits = await setup(page);
  await page.goto("http://site.test/");
  await page.getByText("Reject non-essential").click();
  await page.waitForTimeout(300);

  expect(await ran(page, "__analyticsRan")).toBeFalsy();
  expect(await ran(page, "__marketingRan")).toBeFalsy();
  expect(hits).toHaveLength(0);
});

test("Manage: granting analytics only releases analytics, not marketing", async ({ page }) => {
  const hits = await setup(page);
  await page.goto("http://site.test/");
  await page.getByText("Manage choices").click();
  await page.locator('[data-purpose="marketing"]').uncheck();
  await page.getByText("Save choices").click();

  await expect.poll(() => ran(page, "__analyticsRan")).toBe(true);
  await expect.poll(() => hits.some((h) => h.includes("p=ga"))).toBe(true);
  await page.waitForTimeout(300);
  expect(await ran(page, "__marketingRan")).toBeFalsy();
  expect(hits.some((h) => h.includes("p=ads"))).toBeFalsy();
});

test("openPreferences withdraw_all reduces consent and denies GCM in place", async ({ page }) => {
  await setup(page);
  // Capture consent receipts. This route is registered after setup, so it wins.
  const consents: Array<Record<string, unknown>> = [];
  await page.route("http://cmp.test/api/v1/consent", (r) => {
    const body = r.request().postData();
    if (body) {
      try {
        consents.push(JSON.parse(body));
      } catch {
        /* ignore */
      }
    }
    return r.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
  });

  await page.goto("http://site.test/");
  await page.getByText("Accept all").click();
  await expect.poll(() => ran(page, "__analyticsRan")).toBe(true);

  // Re-open the preference center and withdraw everything.
  await page.evaluate(() => (window as unknown as { skope: { openPreferences(): void } }).skope.openPreferences());
  await page.getByText("Withdraw all").click();

  // A withdraw_all receipt was sent from the preference center.
  await expect
    .poll(() => consents.some((c) => c.action === "withdraw_all" && c.method === "preference_center"))
    .toBe(true);

  // Consent now excludes the non-essential purposes (re-applied without reload).
  const granted = (await page.evaluate(() =>
    (window as unknown as { skope: { getConsent(): string[] } }).skope.getConsent(),
  )) as string[];
  expect(granted).not.toContain("analytics");
  expect(granted).not.toContain("marketing");

  // Google Consent Mode was updated to denied after the withdrawal.
  const denied = await page.evaluate(() => {
    const dl = (window as unknown as { dataLayer?: unknown[][] }).dataLayer ?? [];
    const updates = dl.filter((a) => a[0] === "consent" && a[1] === "update");
    const last = updates[updates.length - 1] as [string, string, { analytics_storage?: string; ad_storage?: string }];
    return last && last[2].analytics_storage === "denied" && last[2].ad_storage === "denied";
  });
  expect(denied).toBeTruthy();
});

test("a prior decision is re-applied on reload without re-prompting", async ({ page }) => {
  await setup(page);
  await page.goto("http://site.test/");
  await page.getByText("Accept all").click();
  await expect.poll(() => ran(page, "__analyticsRan")).toBe(true);

  await page.reload();
  await expect(page.getByText("Accept all")).toHaveCount(0); // no banner
  await expect.poll(() => ran(page, "__analyticsRan")).toBe(true); // released on load
});
