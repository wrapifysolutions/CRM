import Link from "next/link";
import { getPortalGroups } from "@/actions/groups";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Groups" };
export const dynamic = "force-dynamic";

export default async function PortalGroupsPage() {
  const groups = await getPortalGroups();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Work groups</h1>
        <p className="text-muted">
          Chat with your project team in groups you have been added to.
        </p>
      </div>

      <div className="space-y-3">
        {groups.length === 0 && (
          <Card className="border-border">
            <CardContent className="py-10 text-center text-sm text-muted">
              You are not in any groups yet. Your manager can add you from the
              CRM.
            </CardContent>
          </Card>
        )}
        {groups.map((g) => (
          <Card key={g.id} className="border-border">
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="text-base">
                  <Link
                    href={`/portal/groups/${g.id}`}
                    className="hover:text-brand"
                  >
                    {g.name}
                  </Link>
                </CardTitle>
                <p className="mt-1 text-sm text-muted">
                  {g.project?.name ?? "Project"}
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href={`/portal/groups/${g.id}`}>Open chat</Link>
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              <Badge variant="secondary">
                Updated {formatDateTime(g.updated_at)}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
