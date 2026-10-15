import Link from "next/link";
import {
  FolderKanban,
  CheckCircle2,
  Activity,
  ListTodo,
  FileText,
  CalendarDays,
} from "lucide-react";
import { getPortalOverview } from "@/actions/portal";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AnimatedStat } from "@/components/features/animated-stat";

export const metadata = { title: "My Dashboard" };
export const dynamic = "force-dynamic";

export default async function PortalHomePage() {
  const {
    client,
    projects,
    active,
    completed,
    avgProgress,
    openTasks,
    doneTasks,
    documentCount,
    recentDocuments,
    upcomingMeetings,
    meetingCount,
  } = await getPortalOverview();

  return (
    <div className="space-y-8">
      <div className="animate-rise">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">
          {client.name} · Private dashboard
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
          Welcome back
        </h1>
        <p className="mt-1 text-muted">
          Apne projects ki progress, tasks, files aur manager meetings yahan
          dekho.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <AnimatedStat
          label="Total projects"
          value={projects.length}
          accent="bg-brand"
          icon={<FolderKanban className="h-4 w-4" />}
        />
        <AnimatedStat
          label="Active"
          value={active}
          accent="bg-teal-600"
          icon={<Activity className="h-4 w-4" />}
        />
        <AnimatedStat
          label="Completed"
          value={completed}
          accent="bg-[#1a3d68]"
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <AnimatedStat
          label="Avg progress"
          value={`${avgProgress}%`}
          accent="bg-brand"
          icon={<Activity className="h-4 w-4" />}
        />
        <AnimatedStat
          label="Open tasks"
          value={openTasks}
          accent="bg-teal-600"
          icon={<ListTodo className="h-4 w-4" />}
        />
        <AnimatedStat
          label="Meetings"
          value={meetingCount}
          accent="bg-[#1a3d68]"
          icon={<CalendarDays className="h-4 w-4" />}
        />
      </div>

      <Card className="border-border border-brand/30 bg-brand-soft/20">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-brand" />
            Upcoming meetings with manager
          </CardTitle>
          <Button asChild variant="outline" size="sm">
            <Link href="/portal/meetings">All meetings</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {upcomingMeetings.length === 0 && (
            <p className="py-4 text-center text-sm text-muted">
              Abhi koi meeting schedule nahi. Manager jab set karega, yahan
              dikhegi.
            </p>
          )}
          {upcomingMeetings.map((m) => (
            <div
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
            >
              <div>
                <p className="font-semibold text-foreground">{m.title}</p>
                <p className="text-xs text-muted">
                  {formatDateTime(m.scheduled_at)} · {m.duration_minutes} min
                </p>
              </div>
              <div className="flex items-center gap-2">
                {m.meeting_url && (
                  <Button asChild size="sm">
                    <a href={m.meeting_url} target="_blank" rel="noreferrer">
                      Join
                    </a>
                  </Button>
                )}
                <Button asChild size="sm" variant="outline">
                  <Link href={`/portal/projects/${m.project_id}`}>
                    Progress
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-border lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Your projects</CardTitle>
            <Button asChild variant="outline" size="sm">
              <Link href="/portal/projects">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {projects.length === 0 && (
              <p className="py-8 text-center text-sm text-muted">
                No projects assigned yet. Your team will add work here soon.
              </p>
            )}
            {projects.slice(0, 5).map((project) => (
              <Link
                key={project.id}
                href={`/portal/projects/${project.id}`}
                className="block rounded-xl border border-border bg-card p-4 transition hover:border-brand/40 hover:bg-brand-soft/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">{project.name}</p>
                    <p className="text-xs text-muted">
                      Updated {formatDate(project.updated_at)}
                      {project.deadline ? ` · Due ${project.deadline}` : ""}
                    </p>
                  </div>
                  <Badge variant="secondary" className="capitalize">
                    {project.status.replace(/_/g, " ")}
                  </Badge>
                </div>
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-xs text-muted">
                    <span>Progress</span>
                    <span>{project.progress}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-brand-soft/60">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${Math.min(100, project.progress)}%` }}
                    />
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted">
                  Budget {formatCurrency(project.budget)}
                </p>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base">Workspace snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="rounded-xl border border-border bg-brand-soft/20 p-3">
              <p className="text-xs uppercase tracking-wide text-muted">Client</p>
              <p className="mt-1 font-semibold text-foreground">{client.name}</p>
              {client.industry && (
                <p className="text-xs text-muted">{client.industry}</p>
              )}
              <p className="mt-2 text-sm font-medium text-foreground">
                Budget {formatCurrency(client.budget)}
              </p>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Tasks done</span>
              <span className="font-medium">{doneTasks}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Tasks open</span>
              <span className="font-medium">{openTasks}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Files shared</span>
              <span className="font-medium">{documentCount}</span>
            </div>
            <div>
              <p className="mb-2 font-medium text-foreground">Recent files</p>
              {recentDocuments.length === 0 && (
                <p className="text-xs text-muted">No shared files yet.</p>
              )}
              <ul className="space-y-2">
                {recentDocuments.map((doc) => (
                  <li key={doc.id}>
                    <a
                      href={doc.file_url || `/api/files/${doc.file_path}`}
                      className="text-sm text-brand hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {doc.file_name}
                    </a>
                    <p className="text-[11px] text-muted">
                      {formatDate(doc.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
