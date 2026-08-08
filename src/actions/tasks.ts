"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { logActivity, createNotification } from "@/lib/activity";
import { hasPermission } from "@/lib/rbac";
import { connectMongo } from "@/lib/mongodb";
import {
  ProjectModel,
  TaskCommentModel,
  TaskModel,
  newId,
  toIso,
} from "@/lib/db/models";
import { UserModel } from "@/lib/auth/user-model";
import { commentSchema, taskSchema } from "@/lib/validations";
import type { ActionResult } from "@/core/types/result";
import type { PriorityLevel, TaskStatus } from "@/types/database";
import { PAGE_SIZE } from "@/lib/constants";
import { CACHE_TTL, CRM_TAGS, cachedQuery, bustTasks } from "@/lib/cache";

async function attachTask(
  task: Record<string, unknown>,
  options?: { includeComments?: boolean }
) {
  const includeComments = options?.includeComments !== false;
  const [project, assignee, comments] = await Promise.all([
    ProjectModel.findOne({ id: task.project_id }).select("id name").lean(),
    task.assigned_to
      ? UserModel.findOne({ id: task.assigned_to })
          .select("id full_name")
          .lean()
      : null,
    includeComments
      ? TaskCommentModel.find({ task_id: task.id })
          .sort({ created_at: 1 })
          .lean()
      : Promise.resolve([]),
  ]);

  const commentUsers =
    comments.length > 0
      ? await UserModel.find({
          id: { $in: comments.map((c) => c.user_id) },
        })
          .select("id full_name")
          .lean()
      : [];
  const userMap = new Map(commentUsers.map((u) => [String(u.id), u]));

  return {
    id: String(task.id),
    title: String(task.title),
    description: (task.description as string | null) ?? null,
    project_id: String(task.project_id),
    assigned_to: (task.assigned_to as string | null) ?? null,
    assignee_ids: Array.isArray(task.assignee_ids)
      ? (task.assignee_ids as string[]).map(String)
      : task.assigned_to
        ? [String(task.assigned_to)]
        : [],
    group_id: (task.group_id as string | null) ?? null,
    due_date: (task.due_date as string | null) ?? null,
    priority: task.priority as PriorityLevel,
    status: task.status as TaskStatus,
    created_by: (task.created_by as string | null) ?? null,
    created_at: toIso(task.created_at as Date) ?? new Date().toISOString(),
    updated_at: toIso(task.updated_at as Date) ?? new Date().toISOString(),
    deleted_at: toIso(task.deleted_at as Date | null),
    project: project
      ? { id: String(project.id), name: String(project.name) }
      : null,
    assignee: assignee
      ? { id: String(assignee.id), full_name: String(assignee.full_name) }
      : null,
    comments: comments.map((c) => ({
      id: String(c.id),
      task_id: String(c.task_id),
      user_id: String(c.user_id),
      content: String(c.content),
      created_at: toIso(c.created_at) ?? new Date().toISOString(),
      profile: userMap.get(String(c.user_id))
        ? {
            id: String(userMap.get(String(c.user_id))!.id),
            full_name: String(userMap.get(String(c.user_id))!.full_name),
          }
        : null,
    })),
  };
}

async function attachTasksListBatch(rows: Record<string, unknown>[]) {
  const projectIds = [
    ...new Set(rows.map((r) => String(r.project_id)).filter(Boolean)),
  ];
  const assigneeIds = [
    ...new Set(
      rows
        .map((r) => r.assigned_to as string | null)
        .filter(Boolean) as string[]
    ),
  ];

  const [projects, assignees] = await Promise.all([
    projectIds.length
      ? ProjectModel.find({ id: { $in: projectIds } })
          .select("id name")
          .lean()
      : Promise.resolve([]),
    assigneeIds.length
      ? UserModel.find({ id: { $in: assigneeIds } })
          .select("id full_name")
          .lean()
      : Promise.resolve([]),
  ]);

  const projectMap = new Map(projects.map((p) => [String(p.id), p]));
  const assigneeMap = new Map(assignees.map((u) => [String(u.id), u]));

  return rows.map((task) => {
    const project = projectMap.get(String(task.project_id));
    const assignee = task.assigned_to
      ? assigneeMap.get(String(task.assigned_to))
      : null;
    return {
      id: String(task.id),
      title: String(task.title),
      description: (task.description as string | null) ?? null,
      project_id: String(task.project_id),
      assigned_to: (task.assigned_to as string | null) ?? null,
      assignee_ids: Array.isArray(task.assignee_ids)
        ? (task.assignee_ids as string[]).map(String)
        : task.assigned_to
          ? [String(task.assigned_to)]
          : [],
      group_id: (task.group_id as string | null) ?? null,
      due_date: (task.due_date as string | null) ?? null,
      priority: task.priority as PriorityLevel,
      status: task.status as TaskStatus,
      created_by: (task.created_by as string | null) ?? null,
      created_at: toIso(task.created_at as Date) ?? new Date().toISOString(),
      updated_at: toIso(task.updated_at as Date) ?? new Date().toISOString(),
      deleted_at: toIso(task.deleted_at as Date | null),
      project: project
        ? { id: String(project.id), name: String(project.name) }
        : null,
      assignee: assignee
        ? { id: String(assignee.id), full_name: String(assignee.full_name) }
        : null,
      comments: [] as {
        id: string;
        task_id: string;
        user_id: string;
        content: string;
        created_at: string;
        profile: { id: string; full_name: string } | null;
      }[],
    };
  });
}

export async function getTasks(params?: {
  page?: number;
  search?: string;
  status?: string;
  project_id?: string;
  assigned_to?: string;
  mine?: boolean;
}) {
  const profile = await requireProfile();
  if (profile.role === "client") {
    throw new Error("Use the client portal for your tasks");
  }

  const scopedMine = Boolean(params?.mine || profile.role === "employee");

  return cachedQuery(
    [
      "tasks-list",
      profile.id,
      String(params?.page ?? 1),
      params?.search ?? "",
      params?.status ?? "",
      params?.project_id ?? "",
      params?.assigned_to ?? "",
      scopedMine ? "1" : "0",
    ],
    [CRM_TAGS.tasks],
    async () => {
      await connectMongo();
      const page = params?.page ?? 1;
      const filter: Record<string, unknown> = { deleted_at: null };

      if (params?.search) filter.title = { $regex: params.search, $options: "i" };
      if (params?.status) filter.status = params.status;
      if (params?.project_id) filter.project_id = params.project_id;
      if (params?.assigned_to) filter.assigned_to = params.assigned_to;
      if (scopedMine) {
        filter.$or = [
          { assigned_to: profile.id },
          { assignee_ids: profile.id },
        ];
      }

      const count = await TaskModel.countDocuments(filter);
      const rows = await TaskModel.find(filter)
        .sort({ created_at: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .lean();

      const data = await attachTasksListBatch(rows as Record<string, unknown>[]);

      return {
        data,
        count,
        page,
        pageSize: PAGE_SIZE,
        totalPages: Math.max(1, Math.ceil(count / PAGE_SIZE)),
      };
    },
    CACHE_TTL.list
  );
}

export async function getTask(id: string) {
  await connectMongo();
  const task = await TaskModel.findOne({ id, deleted_at: null }).lean();
  if (!task) throw new Error("Task not found");
  return attachTask(task as Record<string, unknown>);
}

export async function createTaskAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const profile = await requireProfile();
  if (!hasPermission(profile.role, "tasks.create")) {
    return { success: false, error: "Permission denied" };
  }

  const parsed = taskSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || "",
    project_id: formData.get("project_id"),
    assigned_to: formData.get("assigned_to") || null,
    due_date: formData.get("due_date") || null,
    priority: formData.get("priority") || "medium",
    status: formData.get("status") || "todo",
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message };
  }

  await connectMongo();
  const id = newId();
  const assigneeIds = [
    ...new Set(
      [
        parsed.data.assigned_to,
        ...(formData.getAll("assignee_ids") as string[]),
      ].filter(Boolean) as string[]
    ),
  ];
  const primary = parsed.data.assigned_to || assigneeIds[0] || null;

  await TaskModel.create({
    id,
    ...parsed.data,
    assigned_to: primary,
    assignee_ids: assigneeIds,
    due_date: parsed.data.due_date || null,
    created_by: profile.id,
  });

  for (const uid of assigneeIds) {
    await createNotification({
      user_id: uid,
      title: "New task assigned",
      message: `You were assigned: ${parsed.data.title}`,
      link: `/tasks/${id}`,
    });
  }

  await logActivity({
    action: "created",
    entity_type: "task",
    entity_id: id,
    metadata: { title: parsed.data.title },
  });

  bustTasks();
  return { success: true, data: { id } };
}

export async function updateTaskAction(
  id: string,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const profile = await requireProfile();
  if (!hasPermission(profile.role, "tasks.update")) {
    return { success: false, error: "Permission denied" };
  }

  const parsed = taskSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || "",
    project_id: formData.get("project_id"),
    assigned_to: formData.get("assigned_to") || null,
    due_date: formData.get("due_date") || null,
    priority: formData.get("priority") || "medium",
    status: formData.get("status") || "todo",
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message };
  }

  const assigneeIds = [
    ...new Set(
      [
        parsed.data.assigned_to,
        ...(formData.getAll("assignee_ids") as string[]),
      ].filter(Boolean) as string[]
    ),
  ];
  const primary = parsed.data.assigned_to || assigneeIds[0] || null;

  await connectMongo();
  const previous = await TaskModel.findOne({ id, deleted_at: null })
    .select("assignee_ids assigned_to")
    .lean();
  if (!previous) return { success: false, error: "Task not found" };

  const updated = await TaskModel.findOneAndUpdate(
    { id, deleted_at: null },
    {
      ...parsed.data,
      assigned_to: primary,
      assignee_ids: assigneeIds,
      due_date: parsed.data.due_date || null,
    },
    { new: true }
  ).lean();

  if (!updated) return { success: false, error: "Task not found" };

  const prevIds = new Set(
    [
      ...(Array.isArray(previous.assignee_ids)
        ? (previous.assignee_ids as string[])
        : []),
      previous.assigned_to ? String(previous.assigned_to) : "",
    ].filter(Boolean)
  );
  for (const uid of assigneeIds) {
    if (prevIds.has(uid)) continue;
    await createNotification({
      user_id: uid,
      title: "Task assigned to you",
      message: `You were assigned: ${parsed.data.title}`,
      link: `/tasks/${id}`,
    });
  }

  await logActivity({
    action: "updated",
    entity_type: "task",
    entity_id: id,
    metadata: { title: updated.title, status: updated.status },
  });

  bustTasks();
  revalidatePath(`/tasks/${id}`);
  return { success: true, data: { id } };
}

export async function addTaskCommentAction(
  taskId: string,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const profile = await requireProfile();
  const parsed = commentSchema.safeParse({
    content: formData.get("content"),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message };
  }

  await connectMongo();
  const id = newId();
  await TaskCommentModel.create({
    id,
    task_id: taskId,
    user_id: profile.id,
    content: parsed.data.content,
  });

  bustTasks();
  revalidatePath(`/tasks/${taskId}`);
  return { success: true, data: { id } };
}

export async function softDeleteTaskAction(id: string): Promise<ActionResult> {
  const profile = await requireProfile();
  if (!hasPermission(profile.role, "tasks.create")) {
    return { success: false, error: "Permission denied" };
  }

  await connectMongo();
  await TaskModel.updateOne({ id }, { deleted_at: new Date() });
  await logActivity({
    action: "soft_deleted",
    entity_type: "task",
    entity_id: id,
  });
  bustTasks();
  return { success: true };
}
