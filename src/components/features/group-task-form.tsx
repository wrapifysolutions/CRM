"use client";

import { useRouter } from "next/navigation";
import { createGroupTaskAction } from "@/actions/groups";
import { FormShell } from "@/components/forms/form-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type StaffOption = { id: string; full_name: string };

export function GroupTaskForm({
  groupId,
  members,
}: {
  groupId: string;
  members: StaffOption[];
}) {
  const router = useRouter();

  return (
    <FormShell
      action={createGroupTaskAction}
      submitLabel="Assign task"
      onSuccess={() => router.refresh()}
    >
      <input type="hidden" name="group_id" value={groupId} />
      <div className="space-y-2">
        <Label htmlFor="title">Task title *</Label>
        <Input id="title" name="title" required minLength={2} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Details</Label>
        <Textarea id="description" name="description" rows={2} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="priority">Priority</Label>
          <Select id="priority" name="priority" defaultValue="medium">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="due_date">Due date</Label>
          <Input id="due_date" name="due_date" type="date" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Assignees *</Label>
        <div className="max-h-36 space-y-1 overflow-y-auto rounded-md border border-border p-2">
          {members.map((m) => (
            <label
              key={m.id}
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <input type="checkbox" name="assignee_ids" value={m.id} />
              <span>{m.full_name}</span>
            </label>
          ))}
        </div>
        <p className="text-xs text-muted">
          Select one or more employees to assign this task.
        </p>
      </div>
    </FormShell>
  );
}
