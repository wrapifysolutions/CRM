import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  getGroup,
  getGroupMessages,
  getGroupTasks,
} from "@/actions/groups";
import { getEmployeesForGroups } from "@/actions/users";
import { GroupChatPanel } from "@/components/features/group-chat-panel";
import { GroupMembersForm } from "@/components/features/group-members-form";
import { GroupTaskForm } from "@/components/features/group-task-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { hasPermission } from "@/lib/rbac";

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

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireProfile();
  if (!hasPermission(profile.role, "projects.view")) {
    redirect("/dashboard");
  }

  const { id } = await params;
  let group;
  try {
    group = await getGroup(id);
  } catch {
    notFound();
  }

  const canEditMembers = hasPermission(profile.role, "projects.update");
  const canCreateTask = hasPermission(profile.role, "tasks.create");
  const memberLabel =
    profile.role === "manager" ? "Employees" : "Managers";

  const [messages, tasks, users] = await Promise.all([
    getGroupMessages(id),
    getGroupTasks(id),
    canEditMembers || canCreateTask
      ? getEmployeesForGroups()
      : Promise.resolve([]),
  ]);

  const memberOptions = group.members_users.filter((u) =>
    profile.role === "manager" ? u.role === "employee" : true
  );

  // Picker list: only role-allowed people (employees for manager, managers for SA)
  const allUsersForPicker = users;
  return (
    <div className="animate-fade-up space-y-5">
      <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card px-5 py-5 shadow-sm">
        <div
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            background:
              "radial-gradient(ellipse 70% 80% at 0% 0%, color-mix(in srgb, var(--brand) 14%, transparent), transparent 55%)",
          }}
        />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div>
            <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
              <Link href="/groups">← Groups</Link>
            </Button>
            <h1 className="text-2xl font-bold tracking-tight">{group.name}</h1>
            <p className="mt-1 text-sm text-muted">
              {group.project ? (
                <Link
                  href={`/projects/${group.project.id}`}
                  className="hover:text-brand"
                >
                  {group.project.name}
                </Link>
              ) : (
                "Project"
              )}
              <span className="text-border"> · </span>
              {group.members_users.length} members
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)_280px] lg:items-start">
        <Card className="order-2 border-border/70 shadow-sm lg:order-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{memberLabel}</CardTitle>
          </CardHeader>
          <CardContent>
            <GroupMembersForm
              groupId={group.id}
              users={allUsersForPicker}
              selectedUserIds={group.member_user_ids}
              canEdit={canEditMembers}
              memberLabel={memberLabel}
            />
          </CardContent>
        </Card>

        <div className="order-1 lg:order-2">
          <GroupChatPanel
            groupId={group.id}
            messages={messages}
            currentUserId={profile.id}
            title={group.name}
          />
        </div>

        <div className="order-3 space-y-4">
          {canCreateTask && (
            <Card className="border-border/70 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Assign task</CardTitle>
              </CardHeader>
              <CardContent>
                <GroupTaskForm groupId={group.id} members={memberOptions} />
              </CardContent>
            </Card>
          )}

          <Card className="border-border/70 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Group tasks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {tasks.length === 0 && (
                <p className="text-sm text-muted">No tasks in this group yet.</p>
              )}
              {tasks.map((t) => (
                <div
                  key={t.id}
                  className="rounded-xl border border-border/70 bg-surface/30 p-3 text-sm transition hover:border-brand/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/tasks/${t.id}`}
                      className="font-medium hover:text-brand"
                    >
                      {t.title}
                    </Link>
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
