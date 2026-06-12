import Script from "next/script";

/**
 * Google Analytics 4 loader. Renders nothing when NEXT_PUBLIC_GA_ID is unset,
 * so dev and CI never load gtag.js. Outside production, debug_mode routes
 * events to GA DebugView instead of polluting reports.
 */
export function GoogleAnalytics() {
  const id = process.env.NEXT_PUBLIC_GA_ID;
  if (!id) return null;

  const config =
    process.env.NODE_ENV === "production" ? `'${id}'` : `'${id}', { debug_mode: true }`;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">{`
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', ${config});
      `}</Script>
    </>
  );
}
