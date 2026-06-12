import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth/session";

export async function POST(request: Request) {
  await clearSession();
  return NextResponse.redirect(new URL("/login", new URL(request.url).origin), {
    status: 303,
  });
}
