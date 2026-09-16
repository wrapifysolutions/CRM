import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { connectMongo } from "@/lib/mongodb";
import { ChatFileModel, WorkGroupModel } from "@/lib/db/models";
import { assertCanAccessGroup } from "@/actions/groups";
import { rateLimit } from "@/core/security/rate-limit";

const notDeleted = {
  $or: [{ deleted_at: null }, { deleted_at: { $exists: false } }],
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = rateLimit(`api:group-files:${profile.id}`, {
    limit: 120,
    windowMs: 60_000,
  });
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Too many file requests. Try again shortly." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const { id } = await context.params;
  await connectMongo();
  const file = await ChatFileModel.findOne({ id }).lean();
  if (!file || !file.data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const group = await WorkGroupModel.findOne({
    id: file.group_id,
    ...notDeleted,
  }).lean();
  if (!group) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await assertCanAccessGroup(profile, group);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bytes = Buffer.isBuffer(file.data)
    ? file.data
    : Buffer.from(file.data as ArrayBuffer);

  return new NextResponse(bytes, {
    headers: {
      "Content-Type": String(file.mime_type || "application/octet-stream"),
      "Content-Length": String(bytes.length),
      "Content-Disposition": `inline; filename="${encodeURIComponent(String(file.file_name || "file"))}"`,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
