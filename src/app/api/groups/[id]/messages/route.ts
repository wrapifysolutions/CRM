import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { getGroupMessages } from "@/actions/groups";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const after = request.nextUrl.searchParams.get("after") || undefined;

  try {
    const messages = await getGroupMessages(id, { after });
    return NextResponse.json(messages);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed";
    const status =
      msg.includes("not found") || msg.includes("Not found")
        ? 404
        : msg.includes("member") || msg.includes("Access")
          ? 403
          : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
