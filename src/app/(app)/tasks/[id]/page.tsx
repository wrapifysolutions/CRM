import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addTaskCommentAction,
  getTask,
  updateTaskAction,
} from "@/actions/tasks";
import { getProjectOptions } from "@/actions/options";
import { getTaskAssignees } from "@/actions/users";
import { requireProfile } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { TaskForm } from "@/components/features/task-form";
import { DocumentUploader } from "@/components/features/document-uploader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PriorityBadge, StatusBadge } from "@/components/shared/status-badges";
import { CommentForm } from "@/components/features/comment-form";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireProfile();

  let task;
  try {
    task = await getTask(id);
  } catch {
    notFound();
  }

  const [projects, users] = await Promise.all([
    getProjectOptions(),
    getTaskAssignees(),
  ]);

  const comments = (task.comments ?? []).sort(
    (a: { created_at: string }, b: { created_at: string }) =>
      a.created_at.localeCompare(b.created_at)
  );

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link href="/tasks">← Back</Link>
        </Button>
        <h1 className="text-2xl font-bold">{task.title}</h1>
        <div className="mt-2 flex gap-2">
          <StatusBadge value={task.status} />
          <PriorityBadge value={task.priority} />
        </div>
      </div>

      <TaskForm
        action={updateTaskAction.bind(null, id)}
        projects={projects}
        users={users}
        task={task}
      />

      <Card>
        <CardHeader>
          <CardTitle>Comments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {comments.map((c) => (
              <div
                key={c.id}
                className="rounded-lg border border-slate-100 p-3 dark:border-slate-800"
              >
                <div className="mb-1 flex justify-between text-xs text-slate-500">
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {c.profile?.full_name ?? "User"}
                  </span>
                  <span>{formatDate(c.created_at)}</span>
                </div>
                <p className="text-sm">{c.content}</p>
              </div>
            ))}
          <CommentForm action={addTaskCommentAction.bind(null, id)} />
        </CardContent>
      </Card>

      <DocumentUploader entityType="task" entityId={id} />
    </div>
  );
}
