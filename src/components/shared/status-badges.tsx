import { PriorityLevel, ClientStatus, ProjectStatus, TaskStatus } from "@/types/database";
import { Badge } from "@/components/ui/badge";

export function PriorityBadge({ value }: { value: PriorityLevel }) {
  const map = {
    low: "secondary",
    medium: "default",
    high: "warning",
    urgent: "danger",
  } as const;
  return (
    <Badge variant={map[value]} className="capitalize rounded-md">
      {value}
    </Badge>
  );
}

export function StatusBadge({
  value,
}: {
  value: ClientStatus | ProjectStatus | TaskStatus | string;
}) {
  const success = ["active", "completed", "done"].includes(value);
  const warning = ["lead", "planning", "review", "on_hold", "in_progress"].includes(
    value
  );
  const danger = ["cancelled", "inactive", "archived"].includes(value);

  return (
    <Badge
      variant={success ? "success" : danger ? "danger" : warning ? "warning" : "secondary"}
      className="capitalize rounded-md"
    >
      {value.replaceAll("_", " ")}
    </Badge>
  );
}
