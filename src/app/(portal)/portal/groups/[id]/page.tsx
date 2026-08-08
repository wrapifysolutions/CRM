import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getGroup,
  getGroupMessages,
  getGroupTasks,
} from "@/actions/groups";
import { GroupChatPanel } from "@/components/features/group-chat-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  try {
    const group = await getGroup(id);
    return { title: group.name };
  } catch {
    return { title: "Group" };
  }
}

export default async function PortalGroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireProfile();
  const { id } = await params;

  let group;
  try {
    group = await getGroup(id);
  } catch {
    notFound();
  }

  const [messages, tasks] = await Promise.all([
    getGroupMessages(id),
    getGroupTasks(id),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1">
          <Link href="/portal/groups">← Groups</Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">{group.name}</h1>
        <p className="text-sm text-muted">
          {group.project?.name ?? "Project"} · {group.members_users.length}{" "}
          team · {group.members_clients.length} clients
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <GroupChatPanel
          groupId={group.id}
          messages={messages}
          currentUserId={profile.id}
          title={group.name}
        />

        <div className="space-y-4">
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Members</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-muted">
                  Team
                </p>
                <ul className="space-y-1">
                  {group.members_users.map((u) => (
                    <li key={u.id}>{u.full_name}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-muted">
                  Clients
                </p>
                <ul className="space-y-1">
                  {group.members_clients.map((c) => (
                    <li key={c.id}>{c.name}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Group tasks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {tasks.length === 0 && (
                <p className="text-sm text-muted">No tasks posted yet.</p>
              )}
              {tasks.map((t) => (
                <div
                  key={t.id}
                  className="rounded-md border border-border p-3 text-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium">{t.title}</span>
                    <Badge variant="secondary">{t.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {t.assignees.map((a) => a.full_name).join(", ") ||
                      "Unassigned"}
                    {t.due_date ? ` · due ${formatDate(t.due_date)}` : ""}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
