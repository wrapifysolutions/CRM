import type { MeetingCountRow } from "@/lib/meetings/stats";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function CountList({
  title,
  rows,
  emptyLabel,
}: {
  title: string;
  rows: MeetingCountRow[];
  emptyLabel: string;
}) {
  return (
    <Card className="border-border/70">
      <CardHeader className="border-b border-border/60 bg-surface/35 px-5 py-4">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 p-4">
        {rows.length === 0 && (
          <p className="py-6 text-center text-sm text-muted">{emptyLabel}</p>
        )}
        {rows.map((row) => (
          <div
            key={row.id}
            className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card px-3.5 py-3 transition hover:border-brand/25"
          >
            <div className="min-w-0">
              <p className="truncate font-semibold text-foreground">{row.name}</p>
              <p className="text-xs text-muted">
                {row.upcoming} upcoming · {row.past} past
              </p>
            </div>
            <Badge variant="secondary" className="shrink-0 rounded-lg tabular-nums">
              {row.total}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function MeetingCountSummary({
  byManager,
  byClient,
  showClients = true,
  managerTitle = "By manager",
  clientTitle = "By client",
}: {
  byManager: MeetingCountRow[];
  byClient?: MeetingCountRow[];
  showClients?: boolean;
  managerTitle?: string;
  clientTitle?: string;
}) {
  return (
    <div className={`grid gap-6 ${showClients ? "lg:grid-cols-2" : ""}`}>
      <CountList
        title={managerTitle}
        rows={byManager}
        emptyLabel="No meetings with managers yet."
      />
      {showClients && (
        <CountList
          title={clientTitle}
          rows={byClient ?? []}
          emptyLabel="No client meetings yet."
        />
      )}
    </div>
  );
}
