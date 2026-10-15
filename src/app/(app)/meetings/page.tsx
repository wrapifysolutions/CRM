import { redirect } from "next/navigation";
import Link from "next/link";
import { CalendarDays, FolderKanban } from "lucide-react";
import { getMeetings } from "@/actions/meetings";
import { getProjectOptions } from "@/actions/options";
import { getManagersAndEmployees } from "@/actions/users";
import { requireProfile } from "@/lib/auth";
import { summarizeMeetingsByParty } from "@/lib/meetings/stats";
import { formatDateTime } from "@/lib/utils";
import { hasPermission } from "@/lib/rbac";
import { MeetingCountSummary } from "@/components/features/meeting-count-summary";
import { ScheduleMeetingForm } from "@/components/features/schedule-meeting-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";

export const metadata = { title: "Meetings" };
export const dynamic = "force-dynamic";

export default async function MeetingsPage() {
  const profile = await requireProfile();
  if (!hasPermission(profile.role, "clients.view")) {
    redirect("/dashboard");
  }

  if (!hasPermission(profile.role, "projects.view")) {
    return (
      <EmptyState
        title="No access"
        description="You do not have permission to view meetings."
      />
    );
  }

  const canSchedule = hasPermission(profile.role, "projects.update");
  const [meetings, projects, users] = await Promise.all([
    getMeetings(),
    getProjectOptions(),
    getManagersAndEmployees(),
  ]);
  const managers = users.filter((u) =>
    ["manager", "admin", "super_admin"].includes(u.role)
  );
  const upcoming = meetings.filter((m) => m.status === "scheduled");
  const past = meetings.filter((m) => m.status !== "scheduled");
  const { byManager, byClient } = summarizeMeetingsByParty(meetings);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Schedule"
        title="Meetings"
        description="Schedule client sessions by project — they also appear on the client portal"
      />

      <MeetingCountSummary byManager={byManager} byClient={byClient} />

      {canSchedule && (
        <ScheduleMeetingForm
          projects={projects}
          managers={managers.map((m) => ({
            id: m.id,
            full_name: m.full_name,
          }))}
          defaultManagerId={profile.role === "manager" ? profile.id : null}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/70">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/60 bg-surface/35 px-5 py-4">
            <CardTitle className="text-sm font-semibold">Upcoming</CardTitle>
            <Badge variant="secondary" className="rounded-lg tabular-nums">
              {upcoming.length}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            {upcoming.length === 0 ? (
              <EmptyState
                icon={<CalendarDays className="h-5 w-5" />}
                title="No upcoming meetings"
                description="Use the schedule form above. Creating a project alone does not add a meeting."
                action={
                  <Button asChild variant="outline" size="sm" className="rounded-xl">
                    <Link href="/projects">
                      <FolderKanban className="h-4 w-4" /> View projects
                    </Link>
                  </Button>
                }
                className="py-10"
              />
            ) : (
              upcoming.map((m) => (
                <div
                  key={m.id}
                  className="rounded-2xl border border-border/70 bg-card p-4 transition hover:border-brand/30"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="font-semibold text-foreground">{m.title}</p>
                      <p className="text-xs text-muted">
                        {formatDateTime(m.scheduled_at)} · {m.duration_minutes}{" "}
                        min
                      </p>
                      <p className="text-sm text-muted">
                        {m.client?.name ? `${m.client.name} · ` : ""}
                        {m.project?.name ?? "Project"}
                        {m.manager ? ` · ${m.manager.full_name}` : ""}
                      </p>
                    </div>
                    <Button asChild size="sm" variant="outline" className="rounded-lg">
                      <Link href={`/projects/${m.project_id}`}>Open</Link>
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader className="border-b border-border/60 bg-surface/35 px-5 py-4">
            <CardTitle className="text-sm font-semibold">Past meetings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            {past.length === 0 ? (
              <EmptyState
                title="No past meetings"
                description="Completed, cancelled, or expired meetings appear here."
                className="py-10"
              />
            ) : (
              past.map((m) => (
                <div
                  key={m.id}
                  className="rounded-2xl border border-border/70 bg-card p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="font-semibold text-foreground">{m.title}</p>
                      <p className="text-xs text-muted">
                        {formatDateTime(m.scheduled_at)} · {m.project?.name}
                      </p>
                      {m.notes ? (
                        <p className="mt-2 text-sm text-muted">{m.notes}</p>
                      ) : null}
                    </div>
                    <Badge variant="secondary" className="shrink-0 capitalize rounded-lg">
                      {m.notes?.startsWith("Auto-closed")
                        ? "expired"
                        : m.status}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
