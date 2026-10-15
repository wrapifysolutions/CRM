import Link from "next/link";
import { FolderKanban, Plus } from "lucide-react";
import { getProjects, softDeleteProjectAction } from "@/actions/projects";
import { requireProfile } from "@/lib/auth";
import { hasPermission, canViewFinance, canViewClients } from "@/lib/rbac";
import { PROJECT_STATUSES } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PriorityBadge, StatusBadge } from "@/components/shared/status-badges";
import { Pagination } from "@/components/shared/pagination";
import { ListFilters } from "@/components/shared/list-filters";
import { DeleteButton } from "@/components/shared/delete-button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";

export const metadata = { title: "Projects" };

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const profile = await requireProfile();
  const showFinance = canViewFinance(profile.role);
  const showClients = canViewClients(profile.role);
  const canCreate = hasPermission(profile.role, "projects.create");
  const result = await getProjects({
    page: Number(params.page || 1),
    search: params.search,
    status: params.status,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Delivery"
        title="Projects"
        description={
          showClients
            ? `${result.count} projects across your workspace`
            : `${result.count} projects assigned via your manager`
        }
        actions={
          canCreate ? (
            <Button asChild className="w-full rounded-xl sm:w-auto">
              <Link href="/projects/new">
                <Plus className="h-4 w-4" /> New project
              </Link>
            </Button>
          ) : undefined
        }
      />

      <Card className="overflow-hidden border-border/70">
        <CardHeader className="space-y-3 border-b border-border/60 bg-surface/35 px-5 py-4">
          <ListFilters
            statusOptions={PROJECT_STATUSES}
            searchPlaceholder="Search projects…"
          />
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Project</TableHead>
                {showClients && <TableHead>Client</TableHead>}
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Progress</TableHead>
                {showFinance && <TableHead>Budget</TableHead>}
                <TableHead>Deadline</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.data.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={
                      5 + (showClients ? 1 : 0) + (showFinance ? 1 : 0) + 1
                    }
                    className="p-0"
                  >
                    <EmptyState
                      icon={<FolderKanban className="h-5 w-5" />}
                      title="No projects found"
                      description="Create a project to start tracking delivery."
                      action={
                        canCreate ? (
                          <Button asChild size="sm" className="rounded-xl">
                            <Link href="/projects/new">
                              <Plus className="h-4 w-4" /> New project
                            </Link>
                          </Button>
                        ) : undefined
                      }
                    />
                  </TableCell>
                </TableRow>
              )}
              {result.data.map((project) => (
                <TableRow key={project.id}>
                  <TableCell>
                    <Link
                      href={`/projects/${project.id}`}
                      className="font-semibold text-foreground transition hover:text-brand"
                    >
                      {project.name}
                    </Link>
                  </TableCell>
                  {showClients && (
                    <TableCell className="text-muted">
                      {(project.client as { name?: string } | null)?.name ??
                        "—"}
                    </TableCell>
                  )}
                  <TableCell>
                    <StatusBadge value={project.status} />
                  </TableCell>
                  <TableCell>
                    <PriorityBadge value={project.priority} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface">
                        <div
                          className="h-full rounded-full bg-brand"
                          style={{
                            width: `${Math.min(100, Number(project.progress) || 0)}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs tabular-nums text-muted">
                        {project.progress}%
                      </span>
                    </div>
                  </TableCell>
                  {showFinance && (
                    <TableCell className="tabular-nums">
                      {formatCurrency(project.budget)}
                    </TableCell>
                  )}
                  <TableCell className="text-muted">
                    {formatDate(project.deadline)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button asChild variant="outline" size="sm" className="rounded-lg">
                        <Link href={`/projects/${project.id}`}>Open</Link>
                      </Button>
                      {hasPermission(profile.role, "projects.update") && (
                        <DeleteButton
                          action={softDeleteProjectAction.bind(null, project.id)}
                        />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="border-t border-border/60 px-4 py-3">
            <Pagination
              page={result.page}
              totalPages={result.totalPages}
              basePath="/projects"
              searchParams={params}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
