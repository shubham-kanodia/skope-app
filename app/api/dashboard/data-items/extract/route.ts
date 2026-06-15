import { getSession } from "@/lib/auth/session";
import { getSiteForOrg } from "@/lib/orgs/queries";
import { rateLimit } from "@/lib/rate-limit";
import { extractFieldsFromImage } from "@/lib/data-items/extract";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;
const MIMES = new Set(["image/png", "image/jpeg", "image/webp"]);

/**
 * Suggest data items from a form screenshot. The image is read into memory,
 * sent to the vision model once, and discarded, nothing is saved by this
 * route; the user reviews suggestions in the editor before saving.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Sign in to do this." }, { status: 401 });
  }

  // Vision calls cost money; keep a sane per-org ceiling.
  const limit = await rateLimit(`extract:${session.orgId}`, 10, 3600);
  if (!limit.ok) {
    return Response.json(
      { error: "That's a lot of screenshots in one hour. Add items manually, or try later." },
      { status: 429 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Send the image as multipart form data." }, { status: 400 });
  }

  const siteId = form.get("siteId");
  if (typeof siteId !== "string" || !(await getSiteForOrg(siteId, session.orgId))) {
    return Response.json({ error: "Site not found." }, { status: 404 });
  }

  const file = form.get("image");
  if (!(file instanceof File) || !MIMES.has(file.type)) {
    return Response.json({ error: "Upload a PNG, JPEG, or WebP screenshot." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "That image is over 5 MB. Try a smaller screenshot." }, { status: 400 });
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const items = await extractFieldsFromImage({ mime: file.type, base64 });
  if (!items) {
    return Response.json(
      { error: "Couldn't read the screenshot. Add items manually below." },
      { status: 502 },
    );
  }

  return Response.json({ items });
}
