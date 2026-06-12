"use client";

import { useState } from "react";
import { CodeBlock } from "@/components/ui/code-block";
import { VerifyInstall } from "@/components/verify-install";

interface Step {
  title: string;
  desc?: string;
  code?: string;
  label?: string;
}
interface Platform {
  id: string;
  label: string;
  status: "ready" | "soon";
  /** Shown above the steps for 'soon' platforms (what's coming, what to do meanwhile). */
  note?: string;
  steps: Step[];
}

function buildPlatforms(cdn: string, siteKey: string): Platform[] {
  const tag = `<script src="${cdn}/skope.js" data-site="${siteKey}" defer></script>`;

  return [
    {
      id: "html",
      label: "HTML / JS",
      status: "ready",
      steps: [
        {
          title: "Paste the tag",
          desc: "Add this once, just before </head>. Skope finds your trackers and shows the banner to visitors in India, no other code needed.",
          label: "index.html",
          code: tag,
        },
      ],
    },
    {
      id: "nextjs",
      label: "Next.js",
      status: "ready",
      steps: [
        {
          title: "Add the script to your root layout",
          desc: "App Router shown below. On the Pages Router, put the same <Script> tag in pages/_app.tsx.",
          label: "app/layout.tsx",
          code: `import Script from "next/script";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <Script
          src="${cdn}/skope.js"
          data-site="${siteKey}"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}`,
        },
      ],
    },
    {
      id: "react",
      label: "React",
      status: "ready",
      steps: [
        {
          title: "Add the tag to your HTML entry",
          desc: "Drop it in <head>. No npm install, the banner mounts in its own shadow DOM, so it won't touch your styles.",
          label: "index.html (Vite) · public/index.html (CRA)",
          code: tag,
        },
      ],
    },
    {
      id: "angular",
      label: "Angular",
      status: "ready",
      steps: [
        {
          title: "Add the tag to src/index.html",
          desc: "Place it inside <head>. Works the same across Angular versions.",
          label: "src/index.html",
          code: tag,
        },
      ],
    },
    {
      id: "wordpress",
      label: "WordPress",
      status: "soon",
      note: "One-click plugin is coming soon. Until then, add the tag manually:",
      steps: [
        {
          title: "Insert the tag in your header",
          desc: "Appearance → Theme File Editor → header.php, just before </head>. Or use a header-injection plugin like “Insert Headers and Footers”.",
          label: "header.php",
          code: tag,
        },
      ],
    },
    {
      id: "shopify",
      label: "Shopify",
      status: "soon",
      note: "Shopify app is coming soon. Until then, add the tag to your theme:",
      steps: [
        {
          title: "Edit theme.liquid",
          desc: "Online Store → Themes → Edit code → theme.liquid, just before </head>.",
          label: "theme.liquid",
          code: tag,
        },
      ],
    },
    {
      id: "react-native",
      label: "React Native",
      status: "soon",
      note: "Native SDK is coming soon. Skope's banner is a web script, so React Native apps need a native module, we're building it. Want early access? Tell us at support@skope.network.",
      steps: [],
    },
  ];
}

export function IntegrationGuide({
  siteKey,
  siteId,
  domain,
  onVerified,
}: {
  siteKey: string;
  siteId: string;
  domain: string;
  /** Forwarded to VerifyInstall, fires when the script is detected live. */
  onVerified?: () => void;
}) {
  const cdn = process.env.NEXT_PUBLIC_CDN_URL ?? "https://cdn.skope.network";
  const platforms = buildPlatforms(cdn, siteKey);
  const [active, setActive] = useState(platforms[0].id);
  const platform = platforms.find((p) => p.id === active) ?? platforms[0];

  return (
    <div className="rounded-2xl border border-hairline">
      {/* Platform tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-hairline px-2">
        {platforms.map((p) => {
          const isActive = p.id === active;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setActive(p.id)}
              className={`relative whitespace-nowrap px-3 py-3 text-sm transition-colors ${
                isActive ? "text-ink" : "text-muted hover:text-ink"
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                {p.label}
                {p.status === "soon" && (
                  <span className="rounded-full bg-surface-strong px-1.5 py-0.5 text-[10px] font-medium text-muted">
                    Soon
                  </span>
                )}
              </span>
              {isActive && (
                <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>

      {/* Steps */}
      <div className="space-y-5 p-5">
        {platform.note && (
          <p className="rounded-xl border border-l-2 border-hairline border-l-primary bg-surface-soft px-4 py-3 text-sm text-body">
            {platform.note}
          </p>
        )}
        {platform.steps.map((step, i) => (
          <div key={i} className="flex gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-strong font-mono text-xs text-ink">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-sm font-medium text-ink">{step.title}</p>
              {step.desc && <p className="text-sm text-body">{step.desc}</p>}
              {step.code && <CodeBlock code={step.code} label={step.label} />}
            </div>
          </div>
        ))}

        {platform.steps.some((s) => s.code) && (
          <div className="flex gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-strong font-mono text-xs text-ink">
              {platform.steps.length + 1}
            </span>
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-sm font-medium text-ink">Verify it&apos;s live</p>
              <p className="text-sm text-body">
                Added the tag and deployed? Check that Skope is running on your site.
              </p>
              <VerifyInstall siteId={siteId} domain={domain} onVerified={onVerified} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
