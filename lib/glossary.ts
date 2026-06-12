/**
 * One place for every DPDP/product term we explain in tooltips, so the same
 * word always gets the same plain-language definition across the app.
 * Voice per BRAND.md: short, plain, no filler.
 */
export const glossary = {
  dataFiduciary:
    "You, if you decide why and how personal data gets collected. Collecting even a name and email makes you one.",
  dataPrincipal: "The person whose data you collect, your customer or visitor.",
  purpose:
    "A specific reason you collect data, like 'send order updates' or 'show ads'. DPDP needs consent per purpose, not one blanket yes.",
  notice:
    "The plain-language summary shown in your banner: what you collect and why. Consent is tied to the exact notice a visitor saw.",
  noticeVersion:
    "Each time you publish your notice it gets a version. If the notice changes, visitors are asked again, that's the law.",
  geoMode:
    "Who sees the banner. 'India only' (default) shows it to visitors in India; your global users stay untouched.",
  consentReceipt:
    "A timestamped record of one consent decision, what was granted, when, in which language, under which notice version.",
  hashChain:
    "Each receipt is cryptographically linked to the one before it, so the record can't be altered without detection. This is the 'tamper-evident' part.",
  trackerBlocking:
    "We hold scripts like GA or Meta Pixel until the visitor consents, nothing fires before that.",
  preferenceCenter:
    "A hosted page where your visitors view, change, or withdraw consent. Withdrawing is as easy as agreeing, because that's the law.",
  siteKey:
    "The id in your install snippet that ties the script to this site. Safe to put in public HTML.",
  dataItem:
    "One piece of personal data you collect, like a name, email, or PAN. DPDP requires your notice to list each one.",
  retention:
    "How long you keep a piece of data before deleting it. Keeping data only as long as needed is a DPDP duty.",
  launchOffer:
    "Sign up during the launch window and compliance is free for 6 months, no card needed.",
} as const;

export type GlossaryTerm = keyof typeof glossary;
