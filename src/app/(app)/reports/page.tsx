import { redirect } from "next/navigation";
import { getDashboardStats } from "@/actions/dashboard";
import { requireProfile } from "@/lib/auth";
import { canViewFinance, hasPermission } from "@/lib/rbac";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExportReportButton } from "@/components/features/export-report-button";

export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  const profile = await requireProfile();
  if (!hasPermission(profile.role, "reports.view")) {
    redirect("/dashboard");
  }

  const showFinance = canViewFinance(profile.role);
  const stats = await getDashboardStats();

  const reportRows = [
    { metric: "Total Clients", value: stats.total_clients },
    { metric: "Active Projects", value: stats.active_projects },
    { metric: "Completed Projects", value: stats.completed_projects },
    { metric: "Pending Tasks", value: stats.pending_tasks },
    ...(showFinance ? [{ metric: "Revenue", value: stats.revenue }] : []),
    ...stats.employee_performance.map((e) => ({
      metric: `Employee: ${e.name}`,
      value: `${e.done}/${e.total} tasks done`,
    })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-slate-500">
            {showFinance
              ? "Performance and revenue overview"
              : "Team and project performance overview"}
          </p>
        </div>
        <ExportReportButton rows={reportRows} />
      </div>

      <div
        className={`grid gap-4 sm:grid-cols-2 ${showFinance ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-slate-500">Clients</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">
            {stats.total_clients}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-slate-500">
              Active Projects
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">
            {stats.active_projects}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-slate-500">
              Completed Projects
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">
            {stats.completed_projects}
          </CardContent>
        </Card>
        {showFinance ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-slate-500">Revenue</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold">
              {formatCurrency(stats.revenue)}
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Employee completion rates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {stats.employee_performance.length === 0 && (
            <p className="text-sm text-slate-500">No employee task data yet.</p>
          )}
          {stats.employee_performance.map((emp) => {
            const pct =
              emp.total === 0 ? 0 : Math.round((emp.done / emp.total) * 100);
            return (
              <div key={emp.name}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="font-medium">{emp.name}</span>
                  <span>
                    {emp.done}/{emp.total} ({pct}%)
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
