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

    // GA (gtag.js + ga-init) loads with strategy="afterInteractive", so on this
    // first post-login render window.gtag often isn't defined yet — track() would
    // silently no-op and the sign-in would be lost. Wait for gtag, then fire, and
    // only then strip the param so a refresh can't double-fire.
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const fire = () => {
      if (typeof window.gtag === "function") {
        track(auth === "signup" ? "sign_up" : "login", { method: "magic_link" });
        router.replace(pathname, { scroll: false });
      } else if (tries++ < 50) {
        timer = setTimeout(fire, 100); // retry for up to ~5s
      } else {
        router.replace(pathname, { scroll: false }); // give up waiting, still clean the URL
      }
    };
    fire();

    return () => clearTimeout(timer);
  }, [auth, pathname, router]);

  return null;
}
