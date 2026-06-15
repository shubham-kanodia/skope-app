"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type IconProps = { className?: string };

type NavItem = { href: string; label: string; exact?: boolean; Icon: (p: IconProps) => React.ReactNode };

const BASE_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Sites", exact: true, Icon: SitesIcon },
  { href: "/dashboard/records", label: "Records", Icon: RecordsIcon },
  { href: "/dashboard/requests", label: "Requests", Icon: RequestsIcon },
  { href: "/dashboard/compliance", label: "Compliance", Icon: ComplianceIcon },
  { href: "/dashboard/assistant", label: "Assistant", Icon: AssistantIcon },
];
const TEAM_ITEM: NavItem = { href: "/dashboard/team", label: "Team", Icon: TeamIcon };
const BILLING_ITEM: NavItem = { href: "/dashboard/billing", label: "Billing", Icon: BillingIcon };

export function SidebarNav({
  orientation = "vertical",
  canTeam = false,
}: {
  orientation?: "vertical" | "horizontal";
  canTeam?: boolean;
}) {
  const pathname = usePathname();
  const horizontal = orientation === "horizontal";
  const items = [...BASE_ITEMS, ...(canTeam ? [TEAM_ITEM] : []), BILLING_ITEM];

  return (
    <nav className={horizontal ? "flex gap-1" : "space-y-1"}>
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors ${
              active
                ? "bg-primary/10 font-medium text-primary"
                : "text-body hover:bg-surface-soft hover:text-ink"
            }`}
          >
            <item.Icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SitesIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18" />
    </svg>
  );
}

function RecordsIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M6 3h8l5 5v13H6z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h6" />
    </svg>
  );
}

function RequestsIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M4 5h16M4 12h16M4 19h10" />
      <circle cx="19" cy="19" r="2.5" />
    </svg>
  );
}

function AssistantIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M21 12a8 8 0 0 1-8 8H4l2.2-2.8A8 8 0 1 1 21 12z" />
      <path d="M9 11h6M9 14.5h3.5" />
    </svg>
  );
}

function ComplianceIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function TeamIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <path d="M16 5.5a3 3 0 0 1 0 5.5M17 14a6 6 0 0 1 4 6" />
    </svg>
  );
}

function BillingIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18" />
    </svg>
  );
}
