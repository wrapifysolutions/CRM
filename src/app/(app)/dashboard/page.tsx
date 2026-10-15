import Link from "next/link";
import {
  Users,
  FolderKanban,
  CheckSquare,
  Plus,
  UserCheck,
  Briefcase,
  TrendingUp,
  CalendarDays,
} from "lucide-react";
import { getDashboardStats } from "@/actions/dashboard";
import { getPendingUsers } from "@/actions/approvals";
import { requireProfile } from "@/lib/auth";
import { hasPermission, canViewFinance, canViewClients } from "@/lib/rbac";
import { formatCurrency, formatDate } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AnimatedStat } from "@/components/features/animated-stat";
import { DashboardChartsLazy } from "@/components/features/dashboard-charts-lazy";
import { PageHeader } from "@/components/shared/page-header";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const profile = await requireProfile();
  const canSeePending = ["super_admin", "admin", "manager"].includes(
    profile.role
  );
  const [stats, pending] = await Promise.all([
    getDashboardStats(),
    canSeePending ? getPendingUsers() : Promise.resolve([]),
  ]);
  const showFinance = canViewFinance(profile.role);
  const showClients = canViewClients(profile.role);

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={`${APP_NAME} workspace`}
        title="Dashboard"
        description={
          showClients
            ? `Hello ${profile.full_name} — live analytics for clients, projects & team`
            : `Hello ${profile.full_name} — your projects, tasks & team workload`
        }
        actions={
          <>
            {pending.length > 0 && (
              <Button asChild variant="outline">
                <Link href="/approvals">
                  <UserCheck className="h-4 w-4" />
                  {pending.length} pending
                </Link>
              </Button>
            )}
            {hasPermission(profile.role, "clients.create") && (
              <Button asChild>
                <Link href="/clients/new">
                  <Plus className="h-4 w-4" /> New client
                </Link>
              </Button>
            )}
            {hasPermission(profile.role, "projects.create") && (
              <Button asChild variant="outline">
                <Link href="/projects/new">
                  <Plus className="h-4 w-4" /> New project
                </Link>
              </Button>
            )}
          </>
        }
      />

      <div
        className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-4 ${
          showFinance || showClients ? "2xl:grid-cols-6" : "2xl:grid-cols-4"
        }`}
      >
        {showClients && (
          <>
            <AnimatedStat
              label="Total Clients"
              value={stats.total_clients}
              accent="bg-brand"
              icon={<Users className="h-4 w-4" />}
            />
            <AnimatedStat
              label="Active Clients"
              value={stats.active_clients}
              accent="bg-teal-600"
              icon={<Briefcase className="h-4 w-4" />}
            />
          </>
        )}
        <AnimatedStat
          label="Active Projects"
          value={stats.active_projects}
          accent="bg-slate-800 dark:bg-teal-400"
          icon={<FolderKanban className="h-4 w-4" />}
        />
        <AnimatedStat
          label="Completed"
          value={stats.completed_projects}
          accent="bg-teal-500"
          icon={<FolderKanban className="h-4 w-4" />}
        />
        <AnimatedStat
          label="Pending Tasks"
          value={stats.pending_tasks}
          accent="bg-slate-500"
          icon={<CheckSquare className="h-4 w-4" />}
        />
        {showClients && (
          <AnimatedStat
            label="Meetings"
            value={stats.meetings_scheduled}
            accent="bg-emerald-600"
            icon={<CalendarDays className="h-4 w-4" />}
          />
        )}
        {showFinance && (
          <AnimatedStat
            label="Pipeline"
            value={formatCurrency(stats.pipeline_value)}
            accent="bg-brand"
            icon={<TrendingUp className="h-4 w-4" />}
            href="#pipeline"
          />
        )}
      </div>

      {showFinance && showClients && (
        <Card id="pipeline" className="scroll-mt-24 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/60 bg-surface/40">
            <div>
              <CardTitle>Pipeline clients</CardTitle>
              <p className="mt-1.5 text-sm text-muted">
                Lead & active clients with their budgets — click for details.
              </p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/clients">All clients</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3 pt-5">
            {stats.pipeline_clients.length === 0 && (
              <p className="text-sm text-muted">
                No lead/active clients yet. Add a client budget to see it here.
              </p>
            )}
            {stats.pipeline_clients.map((client) => (
              <Link
                key={client.id}
                href={`/clients/${client.id}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border/80 bg-surface/40 px-4 py-3.5 transition hover:border-brand/30 hover:bg-brand-soft/40"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">
                    {client.name}
                  </p>
                  <p className="text-xs capitalize text-muted">
                    {client.status.replace(/_/g, " ")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-extrabold text-brand">
                    {formatCurrency(client.budget)}
                  </p>
                  <p className="text-[11px] text-muted">Budget</p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <DashboardChartsLazy
        monthly_trend={stats.monthly_trend}
        project_completion_rate={stats.project_completion_rate}
        completion_rate={stats.completion_rate}
        clients_by_status={stats.clients_by_status}
        projects_by_status={stats.projects_by_status}
        tasks_by_status={stats.tasks_by_status}
        budget_mix={stats.budget_mix}
        progress_leaders={stats.progress_leaders}
        employee_performance={stats.employee_performance}
        showFinance={showFinance}
        showClients={showClients}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/60 bg-surface/40">
            <CardTitle>Live projects</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/projects">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3 pt-5">
            {stats.recent_projects.length === 0 && (
              <p className="text-sm text-muted">No projects yet.</p>
            )}
            {stats.recent_projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="block rounded-2xl border border-border/80 bg-surface/40 p-3.5 transition hover:border-brand/30 hover:bg-brand-soft/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">
                      {project.name}
                    </p>
                    {showClients && project.client_name !== "—" && (
                      <p className="text-xs text-muted">
                        {project.client_name}
                        {showFinance
                          ? ` · ${formatCurrency(project.budget)}`
                          : ""}
                      </p>
                    )}
                    {showFinance && !showClients && (
                      <p className="text-xs text-muted">
                        {formatCurrency(project.budget)}
                      </p>
                    )}
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
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/60 bg-surface/40">
            <CardTitle>Recent activity</CardTitle>
            {hasPermission(profile.role, "activity.view") && (
              <Button asChild variant="ghost" size="sm">
                <Link href="/activity">View all</Link>
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-0 divide-y divide-border/60 p-0">
            {stats.recent_activity.length === 0 && (
              <p className="p-5 text-sm text-muted">No activity yet.</p>
            )}
            {stats.recent_activity.map((log) => (
              <div
                key={String(log.id)}
                className="flex items-start justify-between gap-3 px-5 py-3.5"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {(log.actor as { full_name?: string } | null)?.full_name ??
                      "System"}{" "}
                    <span className="font-normal text-muted">
                      {String(log.action)} {String(log.entity_type)}
                    </span>
                  </p>
                  <p className="text-xs text-muted">
                    {formatDate(String(log.created_at))}
                  </p>
                </div>
                <Badge variant="outline" className="capitalize">
                  {String(log.entity_type)}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
