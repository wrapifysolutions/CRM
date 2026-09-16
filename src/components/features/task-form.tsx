"use client";

import { useRouter } from "next/navigation";
import { FormShell } from "@/components/forms/form-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { PRIORITIES, TASK_STATUSES } from "@/lib/constants";
import type { ActionResult } from "@/core/types/result";
import type { Task } from "@/types/database";

export function TaskForm({
  action,
  projects,
  users,
  task,
}: {
  action: (
    prev: ActionResult | null,
    formData: FormData
  ) => Promise<ActionResult>;
  projects: { id: string; name: string }[];
  users: { id: string; full_name: string }[];
  task?: {
    id?: string;
    title?: string;
    description?: string | null;
    project_id?: string;
    assigned_to?: string | null;
    due_date?: string | null;
    priority?: Task["priority"];
    status?: Task["status"];
  };
}) {
  const router = useRouter();
  const isCreate = !task?.id;

  return (
    <Card>
      <CardContent className="pt-6">
        <FormShell
          action={action}
          submitLabel={task ? "Update Task" : "Create Task"}
          onSuccess={() => router.push("/tasks")}
          className="grid gap-4 sm:grid-cols-2"
        >
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="title">Title *</Label>
            <Input id="title" name="title" required defaultValue={task?.title} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project_id">Project *</Label>
            <Select
              id="project_id"
              name="project_id"
              required
              defaultValue={task?.project_id ?? ""}
            >
              <option value="">Select project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="assigned_to">Assigned Employee</Label>
            <Select
              id="assigned_to"
              name="assigned_to"
              defaultValue={task?.assigned_to ?? ""}
            >
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="due_date">Due Date</Label>
            <Input
              id="due_date"
              name="due_date"
              type="date"
              defaultValue={task?.due_date ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select
              id="priority"
              name="priority"
              defaultValue={task?.priority ?? "medium"}
            >
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              id="status"
              name="status"
              defaultValue={task?.status ?? "todo"}
            >
              {TASK_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              rows={4}
              defaultValue={task?.description ?? ""}
            />
          </div>
          {isCreate && (
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="files">Attach files for employee</Label>
              <Input
                id="files"
                name="files"
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
              />
              <p className="text-xs text-muted">
                PDF, Word, Excel, images, or text — up to 5 files, 6MB each.
              </p>
            </div>
          )}
        </FormShell>
      </CardContent>
    </Card>
  );
}
