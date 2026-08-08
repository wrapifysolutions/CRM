import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffGroups } from "@/actions/groups";
import { getProjectOptions } from "@/actions/options";
import { getEmployeesForGroups } from "@/actions/users";
import { CreateGroupForm } from "@/components/features/create-group-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";
import { hasPermission } from "@/lib/rbac";

export const metadata = { title: "Work Groups" };
export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  const profile = await requireProfile();
  if (!hasPermission(profile.role, "projects.view")) {
    redirect("/dashboard");
  }

  const canCreate = hasPermission(profile.role, "projects.update");
  const memberLabel =
    profile.role === "manager" ? "employees" : "managers";
  const [groups, projects, users] = await Promise.all([
    getStaffGroups(),
    canCreate ? getProjectOptions() : Promise.resolve([]),
    canCreate ? getEmployeesForGroups() : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Work groups</h1>
        <p className="text-muted">
          Add employees by name, chat live, share files — messages stay in the
          database after refresh.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {groups.length === 0 && (
            <Card className="border-border">
              <CardContent className="py-10 text-center text-sm text-muted">
                No groups yet
                {canCreate ? " — create one on the right." : "."}
              </CardContent>
            </Card>
          )}
          {groups.map((g) => (
            <Card
              key={g.id}
              className="border-border transition hover:border-brand/40"
            >
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
                <div>
                  <CardTitle className="text-base">
                    <Link href={`/groups/${g.id}`} className="hover:text-brand">
                      {g.name}
                    </Link>
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted">
                    {g.project?.name ?? "Project"} · {g.members_users.length}{" "}
                    employees
                  </p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/groups/${g.id}`}>Open</Link>
                </Button>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-2 pt-0 text-xs text-muted">
                <Badge variant="secondary">
                  Updated {formatDateTime(g.updated_at)}
                </Badge>
                {g.creator && <span>by {g.creator.full_name}</span>}
              </CardContent>
            </Card>
          ))}
        </div>

        {canCreate && (
          <Card className="h-fit border-border">
            <CardHeader>
              <CardTitle className="text-base">New group</CardTitle>
            </CardHeader>
            <CardContent>
              <CreateGroupForm
                projects={projects}
                users={users}
                memberLabel={memberLabel}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
