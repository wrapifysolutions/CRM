import { Building2, Plus } from "lucide-react";
import {
  createCompanyAction,
  getCompanies,
  softDeleteCompanyAction,
} from "@/actions/companies";
import { requireProfile } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pagination } from "@/components/shared/pagination";
import { ListFilters } from "@/components/shared/list-filters";
import { DeleteButton } from "@/components/shared/delete-button";
import { CompanyCreateForm } from "@/components/features/company-create-form";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";

export const metadata = { title: "Companies" };

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const profile = await requireProfile();
  if (!hasPermission(profile.role, "companies.manage")) {
    return (
      <EmptyState
        title="Permission denied"
        description="You do not have access to manage companies."
      />
    );
  }

  const result = await getCompanies({
    page: Number(params.page || 1),
    search: params.search,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="CRM"
        title="Companies"
        description="Organizations linked to your clients and projects"
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <Card className="h-fit min-w-0 border-border/70">
          <CardHeader className="border-b border-border/60 bg-surface/35 px-5 py-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-soft text-brand">
                <Plus className="h-4 w-4" />
              </span>
              Add company
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <CompanyCreateForm action={createCompanyAction} />
          </CardContent>
        </Card>

        <Card className="min-w-0 overflow-hidden border-border/70">
          <CardHeader className="space-y-3 border-b border-border/60 bg-surface/35 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-sm font-semibold">
                All companies
              </CardTitle>
              <span className="text-xs text-muted">{result.count} total</span>
            </div>
            <ListFilters searchPlaceholder="Search companies…" />
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Name</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.data.length === 0 && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={5} className="p-0">
                      <EmptyState
                        icon={<Building2 className="h-5 w-5" />}
                        title="No companies yet"
                        description="Add an organization on the left to link it to clients."
                      />
                    </TableCell>
                  </TableRow>
                )}
                {result.data.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell className="font-semibold">{company.name}</TableCell>
                    <TableCell className="text-muted">
                      {company.industry ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted">
                      {company.email ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted">
                      {formatDate(company.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DeleteButton
                        action={softDeleteCompanyAction.bind(null, company.id)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="border-t border-border/60 px-4 py-3">
              <Pagination
                page={result.page}
                totalPages={result.totalPages}
                basePath="/companies"
                searchParams={params}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
