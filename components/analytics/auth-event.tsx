"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { track } from "@/lib/analytics/gtag";

/**
 * Fires the GA sign_up / login event after the magic-link callback redirects to
 * the dashboard with ?auth=signup|login, then strips the param so a refresh or
 * bookmark can't double-fire. Renders nothing; mount inside <Suspense>.
 */
export function AuthEvent() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const auth = params.get("auth");

  useEffect(() => {
    if (auth !== "signup" && auth !== "login") return;
    track(auth === "signup" ? "sign_up" : "login", { method: "magic_link" });
    router.replace(pathname, { scroll: false });
  }, [auth, pathname, router]);

  return null;
}
