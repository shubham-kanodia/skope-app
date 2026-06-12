import { redirect } from "next/navigation";

// The marketing site lives at skope.network; this app's front door is the
// dashboard. Unauthenticated visitors get bounced to login by the dashboard layout.
export default function Home() {
  redirect("/dashboard");
}
