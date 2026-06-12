import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The banner's manage view renders the site's declared data items (DPDP §5)
 * under each purpose, with language fallback, and tolerates cfg payloads that
 * predate the dataItems field. Network is mocked like blocking.spec.ts.
 */
const skopeJs = readFileSync(join(__dirname, "..", "public", "skope.js"), "utf8");

const BASE_CFG = {
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
</head><body><h1>Test site</h1></body></html>`;

async function setup(page: Page, cfg: Record<string, unknown>) {
  await page.route("http://cmp.test/skope.js", (r) =>
    r.fulfill({ contentType: "application/javascript", body: skopeJs }),
  );
  await page.route("http://cmp.test/api/cfg/**", (r) =>
    r.fulfill({ contentType: "application/json", body: JSON.stringify(cfg) }),
  );
  await page.route("http://cmp.test/api/v1/consent", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' }),
  );
  await page.route("http://site.test/", (r) => r.fulfill({ contentType: "text/html", body: FIXTURE }));
}

test("manage view lists declared data items under their purpose", async ({ page }) => {
  await setup(page, {
    ...BASE_CFG,
    dataItems: [
      { key: "email", name: { en: "Email address" }, purposeKey: "necessary" },
      { key: "phone", name: { en: "Phone number" }, purposeKey: "necessary" },
      { key: "device", name: { en: "Device data" }, purposeKey: "analytics" },
    ],
  });
  await page.goto("http://site.test/");
  await page.getByText("Manage choices").click();

  await expect(page.getByText("Data collected: Email address, Phone number")).toBeVisible();
  await expect(page.getByText("Data collected: Device data")).toBeVisible();
  // Marketing has no declared items: exactly two "Data collected" lines render.
  await expect(page.getByText(/^Data collected:/)).toHaveCount(2);
});

test("item names fall back to English when the language has no translation", async ({ page }) => {
  await setup(page, {
    ...BASE_CFG,
    banner: { ...BASE_CFG.banner, languages: ["hi"] },
    defaultLanguage: "hi",
    dataItems: [
      { key: "email", name: { en: "Email address", hi: "ईमेल पता" }, purposeKey: "necessary" },
      { key: "pan", name: { en: "PAN" }, purposeKey: "necessary" }, // no hi translation
    ],
  });
  await page.goto("http://site.test/");
  await page.getByText("Manage choices").click();

  await expect(page.getByText("Data collected: ईमेल पता, PAN")).toBeVisible();
});

test("cfg without dataItems (older cache) renders the manage view fine", async ({ page }) => {
  await setup(page, BASE_CFG); // no dataItems key at all
  await page.goto("http://site.test/");
  await page.getByText("Manage choices").click();

  await expect(page.getByText("Save choices")).toBeVisible();
  await expect(page.getByText(/^Data collected:/)).toHaveCount(0);
});
