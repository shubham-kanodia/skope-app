import { afterEach, describe, expect, it, vi } from "vitest";

// SSRF guard just echoes a parsed URL in tests (no DNS / network).
vi.mock("@/lib/http/ssrf", () => ({
  assertPublicUrl: async (raw: string) => new URL(raw),
}));

import { analyzeSite } from "./analyze";

const HOMEPAGE = `<!doctype html><html lang="en"><body>
  <a href="/privacy">Privacy policy</a>
</body></html>`;

const FULL_NOTICE = `<!doctype html><html><body>
  <h1>Privacy notice</h1>
  <select><option value="en">English</option><option value="hi">हिन्दी</option></select>
  <h2>Who we share data with</h2><p>We share data with third parties and our data processors.</p>
  <h2>International transfers</h2><p>Some data may be transferred outside India.</p>
  <h2>Complaints</h2><p>You may complain to the Data Protection Board of India.</p>
  <h2>Your rights</h2><p>You have the right to access, correct and erasure of your data, and to raise a grievance.</p>
  <h2>Children</h2><p>For users under 18 we require verifiable parental consent.</p>
  <h2>Grievance officer</h2><p>Our grievance officer is reachable at privacy@example.in.</p>
</body></html>`;

// A real notice (passes the looksLikeNotice guard) but missing the DPDP disclosures.
const BARE_NOTICE = `<!doctype html><html><body><h1>Privacy notice</h1>
  <p>We collect your personal data to run our service.</p></body></html>`;

function res(html: string, ok = true) {
  return {
    ok,
    status: ok ? 200 : 404,
    text: async () => html,
    headers: { getSetCookie: () => [] as string[] },
  };
}

function status(findings: { id: string; status: string }[], id: string) {
  return findings.find((f) => f.id === id)?.status;
}

afterEach(() => vi.restoreAllMocks());

describe("analyzeSite notice checks", () => {
  it("reads the linked notice and passes the disclosures it contains", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: URL | string) => {
        const u = input.toString();
        return res(u.endsWith("/privacy") ? FULL_NOTICE : HOMEPAGE);
      }),
    );

    const report = await analyzeSite("example.in");

    expect(report.signals.noticeFetched).toBe(true);
    expect(status(report.findings, "notice_recipients")).toBe("pass");
    expect(status(report.findings, "notice_cross_border")).toBe("pass");
    expect(status(report.findings, "notice_dpb")).toBe("pass");
    expect(status(report.findings, "notice_rights")).toBe("pass");
    expect(status(report.findings, "notice_children")).toBe("pass");
    // Grievance contact and language live in the notice (homepage is English, no contact).
    expect(status(report.findings, "grievance")).toBe("pass");
    expect(status(report.findings, "language")).toBe("pass");
  });

  it("fails the disclosures a thin notice is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: URL | string) => {
        const u = input.toString();
        return res(u.endsWith("/privacy") ? BARE_NOTICE : HOMEPAGE);
      }),
    );

    const report = await analyzeSite("example.in");

    expect(report.signals.noticeFetched).toBe(true);
    expect(status(report.findings, "notice_dpb")).toBe("fail");
    expect(status(report.findings, "notice_cross_border")).toBe("fail");
  });

  it("degrades to a warning (not a hard fail) when the notice can't be opened", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: URL | string) => {
        const u = input.toString();
        return res(u.endsWith("/privacy") ? "" : HOMEPAGE, !u.endsWith("/privacy"));
      }),
    );

    const report = await analyzeSite("example.in");

    expect(report.signals.privacyPolicyFound).toBe(true);
    expect(report.signals.noticeFetched).toBe(false);
    // Collapses to a single honest row rather than five identical yellow ones.
    expect(status(report.findings, "notice_contents")).toBe("warn");
    expect(status(report.findings, "notice_recipients")).toBeUndefined();
  });

  it("flags a broken privacy link (linked notice 404s)", async () => {
    // Homepage links /privacy, but every privacy path 404s — like skope.network did.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: URL | string) => {
        const u = input.toString();
        return /privacy/.test(u) ? res("<html>not found</html>", false) : res(HOMEPAGE);
      }),
    );

    const report = await analyzeSite("example.in");

    expect(report.signals.noticeFetched).toBe(false);
    const contents = report.findings.find((f) => f.id === "notice_contents");
    expect(contents?.status).toBe("warn");
    expect(contents?.detail).toMatch(/broken/i);
  });

  it("collapses to one warning when there's no privacy link at all", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => res("<html><body>no policy here</body></html>")));

    const report = await analyzeSite("example.in");

    expect(report.signals.privacyPolicyFound).toBe(false);
    expect(status(report.findings, "notice_contents")).toBe("warn");
    expect(status(report.findings, "notice_children")).toBeUndefined();
  });
});

describe("analyzeSite tracker gating", () => {
  // A Skope-style page: banner present, GA only preloaded (not executed).
  const PRELOADED = `<!doctype html><html lang="en"><head>
    <link rel="preload" href="https://www.googletagmanager.com/gtag/js?id=G-XXXX" as="script"/>
    <script src="https://app.skope.network/skope.js" data-site="sk_test"></script>
  </head><body>cookie consent</body></html>`;

  // GA gated the Skope way — present in HTML but won't run before consent.
  const GATED = `<!doctype html><html lang="en"><head>
    <script type="text/plain" data-skope="analytics" src="https://www.googletagmanager.com/gtag/js?id=G-XXXX"></script>
    <script src="https://app.skope.network/skope.js" data-site="sk_test"></script>
  </head><body>cookie consent</body></html>`;

  // GA loading unconditionally — a real gap.
  const ACTIVE = `<!doctype html><html lang="en"><head>
    <script src="https://www.googletagmanager.com/gtag/js?id=G-XXXX"></script>
    <script src="https://app.skope.network/skope.js" data-site="sk_test"></script>
  </head><body>cookie consent</body></html>`;

  it("passes trackers that are only preloaded", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => res(PRELOADED)));
    const report = await analyzeSite("example.in");
    expect(status(report.findings, "trackers")).toBe("pass");
    expect(report.trackers.length).toBe(1); // still listed for transparency
  });

  it("passes trackers that are CMP-gated", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => res(GATED)));
    const report = await analyzeSite("example.in");
    expect(status(report.findings, "trackers")).toBe("pass");
  });

  it("warns on an ungated tracker that loads on open", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => res(ACTIVE)));
    const report = await analyzeSite("example.in");
    expect(status(report.findings, "trackers")).toBe("warn");
  });
});
