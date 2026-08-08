import { NextRequest } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import {
  assertCanAccessGroup,
  getGroupMessages,
} from "@/actions/groups";
import { connectMongo } from "@/lib/mongodb";
import { WorkGroupModel } from "@/lib/db/models";
import { subscribeGroupChat } from "@/lib/groups/chat-bus";

const notDeleted = {
  $or: [{ deleted_at: null }, { deleted_at: { $exists: false } }],
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id: groupId } = await context.params;
  await connectMongo();
  const group = await WorkGroupModel.findOne({
    id: groupId,
    ...notDeleted,
  }).lean();
  if (!group) {
    return new Response("Not found", { status: 404 });
  }

  try {
    await assertCanAccessGroup(profile, group);
  } catch {
    return new Response("Forbidden", { status: 403 });
  }

  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          closed = true;
        }
      };

      send("ready", { groupId, at: new Date().toISOString() });

      const after = request.nextUrl.searchParams.get("after");
      if (after) {
        try {
          const missed = await getGroupMessages(groupId, { after });
          for (const msg of missed) send("chat", msg);
        } catch {
          // ignore catch-up errors
        }
      }

      cleanup = subscribeGroupChat(groupId, (payload) => {
        send("chat", payload);
      });

      heartbeat = setInterval(() => {
        send("ping", { t: Date.now() });
      }, 25000);

      request.signal.addEventListener("abort", () => {
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        cleanup?.();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
    cancel() {
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
