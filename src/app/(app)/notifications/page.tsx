import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import {
  getNotifications,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/actions/dashboard";
import { formatDate } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MarkReadButton } from "@/components/features/mark-read-button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const notifications = await getNotifications();
  const unread = notifications.filter((n) => !n.read_at).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Inbox"
        title="Notifications"
        description={
          unread > 0
            ? `${unread} unread · stay on top of assignments and updates`
            : "You're all caught up"
        }
        actions={
          notifications.length > 0 ? (
            <form action={markAllNotificationsReadAction}>
              <Button
                type="submit"
                variant="outline"
                className="rounded-xl"
              >
                <CheckCheck className="h-4 w-4" />
                Mark all read
              </Button>
            </form>
          ) : undefined
        }
      />

      <Card className="overflow-hidden border-border/70">
        <CardContent className="p-0">
          {notifications.length === 0 ? (
            <EmptyState
              icon={<Bell className="h-5 w-5" />}
              title="No notifications yet"
              description="Updates about tasks, approvals, and assignments will show up here."
            />
          ) : (
            <ul className="divide-y divide-border/60">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className={`flex flex-col gap-3 px-4 py-4 transition sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:px-5 ${
                    n.read_at
                      ? "bg-card"
                      : "bg-brand-soft/50"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-foreground">{n.title}</p>
                      {!n.read_at && (
                        <Badge className="rounded-md bg-brand text-[10px] text-white">
                          New
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed text-muted">
                      {n.message}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <span className="text-xs text-muted">
                        {formatDate(n.created_at)}
                      </span>
                      {n.link ? (
                        <Link
                          href={n.link}
                          className="text-xs font-semibold text-brand hover:underline"
                        >
                          Open →
                        </Link>
                      ) : null}
                    </div>
                  </div>
                  {!n.read_at && (
                    <MarkReadButton
                      action={markNotificationReadAction.bind(null, n.id)}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
