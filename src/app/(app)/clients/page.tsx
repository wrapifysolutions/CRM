import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { getClients, softDeleteClientAction } from "@/actions/clients";
import { requireProfile } from "@/lib/auth";
import { hasPermission, canViewFinance } from "@/lib/rbac";
import { CLIENT_STATUSES, PRIORITIES } from "@/lib/constants";
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
import { ExportClientsButton } from "@/components/features/export-clients-button";
import { DeleteButton } from "@/components/shared/delete-button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";

export const metadata = { title: "Clients" };

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const profile = await requireProfile();
  if (!hasPermission(profile.role, "clients.view")) {
    redirect("/dashboard");
  }
  const showFinance = canViewFinance(profile.role);
  const canCreate = hasPermission(profile.role, "clients.create");
  const result = await getClients({
    page: Number(params.page || 1),
    search: params.search,
    status: params.status,
    priority: params.priority,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="CRM"
        title="Clients"
        description={`${result.count} total · manage relationships and account owners`}
        actions={
          <>
            {showFinance && <ExportClientsButton clients={result.data} />}
            {canCreate && (
              <Button asChild className="w-full rounded-xl sm:w-auto">
                <Link href="/clients/new">
                  <Plus className="h-4 w-4" /> New client
                </Link>
              </Button>
            )}
          </>
        }
      />

      <Card className="overflow-hidden border-border/70">
        <CardHeader className="space-y-3 border-b border-border/60 bg-surface/35 px-5 py-4">
          <ListFilters
            statusOptions={CLIENT_STATUSES}
            priorityOptions={PRIORITIES}
            searchPlaceholder="Search clients…"
          />
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                {showFinance && <TableHead>Budget</TableHead>}
                <TableHead>Manager</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.data.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={showFinance ? 8 : 7} className="p-0">
                    <EmptyState
                      icon={<Users className="h-5 w-5" />}
                      title="No clients found"
                      description="Try another search, or create a new client to get started."
                      action={
                        canCreate ? (
                          <Button asChild size="sm" className="rounded-xl">
                            <Link href="/clients/new">
                              <Plus className="h-4 w-4" /> New client
                            </Link>
                          </Button>
                        ) : undefined
                      }
                    />
                  </TableCell>
                </TableRow>
              )}
              {result.data.map((client) => (
                <TableRow key={client.id}>
                  <TableCell>
                    <Link
                      href={`/clients/${client.id}`}
                      className="font-semibold text-foreground transition hover:text-brand"
                    >
                      {client.name}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted">{client.email}</p>
                  </TableCell>
                  <TableCell className="text-muted">
                    {(client.company as { name?: string } | null)?.name ?? "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge value={client.status} />
                  </TableCell>
                  <TableCell>
                    <PriorityBadge value={client.priority} />
                  </TableCell>
                  {showFinance && (
                    <TableCell className="tabular-nums">
                      {formatCurrency(client.budget)}
                    </TableCell>
                  )}
                  <TableCell className="text-muted">
                    {(client.assigned_manager as { full_name?: string } | null)
                      ?.full_name ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted">
                    {formatDate(client.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button asChild variant="outline" size="sm" className="rounded-lg">
                        <Link href={`/clients/${client.id}`}>View</Link>
                      </Button>
                      {hasPermission(profile.role, "clients.delete") && (
                        <DeleteButton
                          action={softDeleteClientAction.bind(null, client.id)}
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
              basePath="/clients"
              searchParams={params}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
