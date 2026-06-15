import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Consent-mechanics conformity (DPDP §6(1)-(2)), asserted on the rendered banner:
 *   - non-essential purposes are never pre-ticked (clear affirmative action),
 *   - essential is shown locked/always-on,
 *   - "Reject non-essential" is present alongside "Accept", as a real choice,
 *   - clicking Save with nothing ticked grants only essential (no silent opt-in).
 * Mirrors blocking.spec.ts: skope.js is tested in isolation with mocked network.
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
</head><body><h1>Test site</h1></body></html>`;

async function setup(page: Page): Promise<Array<Record<string, unknown>>> {
  const consents: Array<Record<string, unknown>> = [];
  await page.route("http://cmp.test/skope.js", (r) =>
    r.fulfill({ contentType: "application/javascript", body: skopeJs }),
  );
  await page.route("http://cmp.test/api/cfg/**", (r) =>
    r.fulfill({ contentType: "application/json", body: JSON.stringify(CFG) }),
  );
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
  await page.route("http://site.test/", (r) => r.fulfill({ contentType: "text/html", body: FIXTURE }));
  return consents;
}

test("non-essential purposes are not pre-ticked, essential is locked", async ({ page }) => {
  await setup(page);
  await page.goto("http://site.test/");
  await page.getByText("Manage choices").click();

  await expect(page.locator('[data-purpose="analytics"]')).not.toBeChecked();
  await expect(page.locator('[data-purpose="marketing"]')).not.toBeChecked();

  // Essential is checked and cannot be toggled off.
  await expect(page.locator('[data-purpose="necessary"]')).toBeChecked();
  await expect(page.locator('[data-purpose="necessary"]')).toBeDisabled();
});

test("Reject is presented as a real choice next to Accept", async ({ page }) => {
  await setup(page);
  await page.goto("http://site.test/");
  await expect(page.getByText("Accept all")).toBeVisible();
  await expect(page.getByText("Reject non-essential")).toBeVisible();
});

test("saving the manage view with nothing ticked grants only essential", async ({ page }) => {
  const consents = await setup(page);
  await page.goto("http://site.test/");
  await page.getByText("Manage choices").click();
  await page.getByText("Save choices").click();

  await expect
    .poll(() => consents.find((c) => c.action === "update"))
    .toBeTruthy();
  const update = consents.find((c) => c.action === "update")!;
  expect(update.purposesGranted).toEqual(["necessary"]);
  expect(update.purposesDenied).toEqual(expect.arrayContaining(["analytics", "marketing"]));
});
