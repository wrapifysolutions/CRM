import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageSquarePlus } from "lucide-react";
import { getStaffFeedback } from "@/actions/feedback";
import { requireProfile } from "@/lib/auth";
import { canViewClients } from "@/lib/rbac";
import { formatDateTime } from "@/lib/utils";
import { FeedbackStatusForm } from "@/components/features/feedback-status-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";

export const metadata = { title: "Client Feedback" };
export const dynamic = "force-dynamic";

const FILTERS = [
  ["", "All"],
  ["new", "New"],
  ["reviewed", "Reviewed"],
  ["planned", "Planned"],
  ["done", "Done"],
  ["dismissed", "Dismissed"],
] as const;

export default async function StaffFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const profile = await requireProfile();
  if (!canViewClients(profile.role)) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const items = await getStaffFeedback({
    status: params.status || undefined,
  });
  const openCount = items.filter((i) => i.status === "new").length;
  const activeFilter = params.status || "";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Voice of client"
        title="Feedback"
        description="Suggestions and comments from the client portal — review and update status"
      />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map(([value, label]) => {
          const active = activeFilter === value;
          return (
            <Button
              key={label}
              asChild
              size="sm"
              variant={active ? "default" : "outline"}
              className={cn(
                "rounded-xl",
                active && "shadow-sm"
              )}
            >
              <Link href={value ? `/feedback?status=${value}` : "/feedback"}>
                {label}
                {value === "new" && openCount > 0 ? ` (${openCount})` : ""}
              </Link>
            </Button>
          );
        })}
      </div>

      <div className="space-y-4">
        {items.length === 0 ? (
          <Card className="border-border/70">
            <EmptyState
              icon={<MessageSquarePlus className="h-5 w-5" />}
              title="No feedback in this filter"
              description="When clients submit feedback from the portal, it will show up here."
            />
          </Card>
        ) : (
          items.map((item) => (
            <Card
              key={item.id}
              className={cn(
                "overflow-hidden border-border/70",
                !item.is_seen && "ring-1 ring-brand/20"
              )}
            >
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 border-b border-border/60 bg-surface/30 px-5 py-4">
                <div className="min-w-0 space-y-1">
                  <CardTitle className="text-base font-semibold tracking-tight">
                    {item.title}
                  </CardTitle>
                  <p className="text-xs text-muted">
                    {item.client_name} · {formatDateTime(item.created_at)} ·{" "}
                    {item.type === "feature" ? "Feature suggestion" : "Feedback"}
                  </p>
                </div>
                <div className="flex flex-wrap justify-end gap-1.5">
                  <Badge
                    variant={item.is_seen ? "secondary" : "warning"}
                    className="rounded-md"
                  >
                    {item.is_seen ? "Seen" : "Unseen"}
                  </Badge>
                  <Badge variant="outline" className="rounded-md capitalize">
                    {item.type}
                  </Badge>
                  <Badge variant="secondary" className="rounded-md capitalize">
                    {item.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 p-5">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {item.message}
                </p>
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="-ml-2 rounded-lg"
                >
                  <Link href={`/clients/${item.client_id}`}>Open client →</Link>
                </Button>
                <FeedbackStatusForm
                  id={item.id}
                  status={item.status}
                  staffNotes={item.staff_notes}
                  reply={item.reply}
                  isSeen={item.is_seen}
                />
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
