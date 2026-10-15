"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { logActivity, createNotification } from "@/lib/activity";
import { connectMongo } from "@/lib/mongodb";
import { ClientModel, ProjectModel, newId, toIso } from "@/lib/db/models";
import { UserModel } from "@/lib/auth/user-model";
import { projectSchema } from "@/lib/validations";
import type { ActionResult } from "@/core/types/result";
import type { PriorityLevel, ProjectStatus } from "@/types/database";
import { PAGE_SIZE } from "@/lib/constants";
import {
  CACHE_TTL,
  CRM_TAGS,
  cachedQuery,
  bustProjects,
  bustPortal,
} from "@/lib/cache";
import {
  canViewFinance,
  hasPermission,
  redactBudget,
  redactBudgetList,
  redactClientInfo,
  redactClientInfoList,
} from "@/lib/rbac";

async function attachProject(project: Record<string, unknown>) {
  const [client, manager, members] = await Promise.all([
    ClientModel.findOne({ id: project.client_id }).lean(),
    project.manager_id
      ? UserModel.findOne({ id: project.manager_id }).lean()
      : null,
    UserModel.find({
      id: { $in: (project.member_ids as string[]) ?? [] },
    }).lean(),
  ]);

  return mapProjectRow(project, client, manager, members);
}

function mapProjectRow(
  project: Record<string, unknown>,
  client:
    | { id: string; name: string; budget?: number | null }
    | null
    | undefined,
  manager: { id: string; full_name: string } | null | undefined,
  members: { id: string; full_name: string; email: string }[]
) {
  const projectBudget = Number(project.budget ?? 0);
  const clientBudget = Number(client?.budget ?? 0);
  return {
    id: String(project.id),
    name: String(project.name),
    client_id: String(project.client_id),
    description: (project.description as string | null) ?? null,
    budget: projectBudget > 0 ? projectBudget : clientBudget,
    deadline: (project.deadline as string | null) ?? null,
    priority: project.priority as PriorityLevel,
    status: project.status as ProjectStatus,
    progress: Number(project.progress ?? 0),
    manager_id: (project.manager_id as string | null) ?? null,
    member_ids: (project.member_ids as string[]) ?? [],
    created_by: (project.created_by as string | null) ?? null,
    created_at: toIso(project.created_at as Date) ?? new Date().toISOString(),
    updated_at: toIso(project.updated_at as Date) ?? new Date().toISOString(),
    deleted_at: toIso(project.deleted_at as Date | null),
    client: client ? { id: String(client.id), name: String(client.name) } : null,
    manager: manager
      ? { id: String(manager.id), full_name: String(manager.full_name) }
      : null,
    members: members.map((m) => ({
      id: `${project.id}-${m.id}`,
      project_id: String(project.id),
      user_id: String(m.id),
      profile: {
        id: String(m.id),
        full_name: String(m.full_name),
        email: String(m.email),
      },
    })),
  };
}

async function attachProjectsBatch(rows: Record<string, unknown>[]) {
  const clientIds = [
    ...new Set(rows.map((r) => String(r.client_id)).filter(Boolean)),
  ];
  const userIds = [
    ...new Set(
      rows.flatMap((r) => [
        ...(r.manager_id ? [String(r.manager_id)] : []),
        ...((r.member_ids as string[]) ?? []).map(String),
      ])
    ),
  ];

  const [clients, users] = await Promise.all([
    clientIds.length
      ? ClientModel.find({ id: { $in: clientIds } })
          .select("id name budget")
          .lean()
      : Promise.resolve([]),
    userIds.length
      ? UserModel.find({ id: { $in: userIds } })
          .select("id full_name email")
          .lean()
      : Promise.resolve([]),
  ]);

  const clientMap = new Map(clients.map((c) => [String(c.id), c]));
  const userMap = new Map(users.map((u) => [String(u.id), u]));

  return rows.map((project) => {
    const memberIds = ((project.member_ids as string[]) ?? []).map(String);
    return mapProjectRow(
      project,
      clientMap.get(String(project.client_id)),
      project.manager_id
        ? userMap.get(String(project.manager_id))
        : null,
      memberIds
        .map((id) => userMap.get(id))
        .filter(Boolean) as {
        id: string;
        full_name: string;
        email: string;
      }[]
    );
  });
}

export async function getProjects(params?: {
  page?: number;
  search?: string;
  status?: string;
  sort?: string;
  order?: "asc" | "desc";
}) {
  const { requireStaffProfile } = await import("@/lib/auth/require-staff");
  const profile = await requireStaffProfile();

  const result = await cachedQuery(
    [
      "projects-list",
      String(params?.page ?? 1),
      params?.search ?? "",
      params?.status ?? "",
      params?.sort ?? "created_at",
      params?.order ?? "desc",
    ],
    [CRM_TAGS.projects],
    () => loadProjects(params),
    CACHE_TTL.list
  );

  return {
    ...result,
    data: redactClientInfoList(
      redactBudgetList(result.data, profile.role),
      profile.role
    ),
  };
}

async function loadProjects(params?: {
  page?: number;
  search?: string;
  status?: string;
  sort?: string;
  order?: "asc" | "desc";
}) {
  await connectMongo();
  const page = params?.page ?? 1;
  const filter: Record<string, unknown> = { deleted_at: null };
  if (params?.search) {
    filter.name = { $regex: params.search, $options: "i" };
  }
  if (params?.status) filter.status = params.status;

  const sortField = params?.sort || "created_at";
  const sortDir = params?.order === "asc" ? 1 : -1;
  const count = await ProjectModel.countDocuments(filter);
  const rows = await ProjectModel.find(filter)
    .sort({ [sortField]: sortDir })
    .skip((page - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .lean();

  const data = await attachProjectsBatch(rows as Record<string, unknown>[]);

  return {
    data,
    count,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(count / PAGE_SIZE)),
  };
}

export async function getProject(id: string): Promise<{
  id: string;
  name: string;
  client_id: string;
  description: string | null;
  budget: number | null;
  deadline: string | null;
  priority: PriorityLevel;
  status: ProjectStatus;
  progress: number;
  manager_id: string | null;
  member_ids: string[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  client: { id: string; name: string } | null;
  manager: { id: string; full_name: string } | null;
  members: { id: string; project_id: string; user_id: string; profile: { id: string; full_name: string; email: string } }[];
}> {
  const { requireStaffProfile } = await import("@/lib/auth/require-staff");
  const profile = await requireStaffProfile();
  await connectMongo();
  const project = await ProjectModel.findOne({ id, deleted_at: null }).lean();
  if (!project) throw new Error("Project not found");
  const row = await attachProject(project as Record<string, unknown>);
  return redactClientInfo(redactBudget(row, profile.role), profile.role);
}

export async function createProjectAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const profile = await requireProfile();
  if (!hasPermission(profile.role, "projects.create")) {
    return { success: false, error: "Permission denied" };
  }

  const memberIds = formData.getAll("member_ids").filter(Boolean) as string[];
  const parsed = projectSchema.safeParse({
    name: formData.get("name"),
    client_id: formData.get("client_id"),
    description: formData.get("description") || "",
    budget: formData.get("budget") || 0,
    deadline: formData.get("deadline") || null,
    priority: formData.get("priority") || "medium",
    status: formData.get("status") || "planning",
    progress: formData.get("progress") || 0,
    manager_id: formData.get("manager_id") || profile.id,
    member_ids: memberIds,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message };
  }

  await connectMongo();
  const id = newId();
  const { member_ids, ...projectData } = parsed.data;
  const allowFinance = canViewFinance(profile.role);

  let budget = 0;
  if (allowFinance) {
    budget = Number(projectData.budget ?? 0);
    if (budget <= 0 && projectData.client_id) {
      const client = await ClientModel.findOne({ id: projectData.client_id })
        .select("budget")
        .lean();
      budget = Number(client?.budget ?? 0);
    }
  }

  await ProjectModel.create({
    id,
    ...projectData,
    budget,
    manager_id: projectData.manager_id || profile.id,
    deadline: projectData.deadline || null,
    member_ids: member_ids ?? [],
    created_by: profile.id,
  });

  for (const userId of member_ids ?? []) {
    await createNotification({
      user_id: userId,
      title: "Added to project",
      message: `You were assigned to project ${projectData.name}`,
      link: `/projects/${id}`,
    });
  }

  await logActivity({
    action: "created",
    entity_type: "project",
    entity_id: id,
    metadata: { name: projectData.name },
  });

  bustProjects();
  bustPortal();
  return { success: true, data: { id } };
}

export async function updateProjectAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const profile = await requireProfile();
  if (!hasPermission(profile.role, "projects.update")) {
    return { success: false, error: "Permission denied" };
  }

  const id = String(formData.get("id") || "").trim();
  if (!id) {
    return { success: false, error: "Project id missing" };
  }

  const memberIds = formData.getAll("member_ids").filter(Boolean) as string[];
  const parsed = projectSchema.safeParse({
    name: formData.get("name"),
    client_id: formData.get("client_id"),
    description: formData.get("description") || "",
    budget: formData.get("budget") ?? 0,
    deadline: formData.get("deadline") || null,
    priority: formData.get("priority") || "medium",
    status: formData.get("status") || "planning",
    progress: formData.get("progress") ?? 0,
    manager_id: formData.get("manager_id") || null,
    member_ids: memberIds,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(" · "),
    };
  }

  await connectMongo();
  const { member_ids, ...projectData } = parsed.data;
  const allowFinance = canViewFinance(profile.role);

  const $set: Record<string, unknown> = {
    name: projectData.name,
    client_id: projectData.client_id,
    description: projectData.description || null,
    deadline: projectData.deadline || null,
    priority: projectData.priority,
    status: projectData.status,
    progress: Number(projectData.progress ?? 0),
    manager_id: projectData.manager_id || null,
    member_ids: member_ids ?? [],
  };

  if (allowFinance) {
    let budget = Number(projectData.budget ?? 0);
    if (budget <= 0 && projectData.client_id) {
      const client = await ClientModel.findOne({ id: projectData.client_id })
        .select("budget")
        .lean();
      budget = Number(client?.budget ?? 0);
    }
    $set.budget = budget;
  }

  const updated = await ProjectModel.findOneAndUpdate(
    { id },
    { $set },
    { returnDocument: "after" }
  ).lean();

  if (!updated || updated.deleted_at) {
    return { success: false, error: "Project not found" };
  }

  await logActivity({
    action: "updated",
    entity_type: "project",
    entity_id: id,
    metadata: {
      name: updated.name,
      status: updated.status,
      progress: updated.progress,
      priority: updated.priority,
    },
  });

  bustProjects();
  bustPortal();
  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  revalidatePath("/dashboard");
  revalidatePath("/portal", "layout");
  return { success: true, data: { id } };
}

export async function softDeleteProjectAction(id: string): Promise<ActionResult> {
  const profile = await requireProfile();
  if (!hasPermission(profile.role, "projects.update")) {
    return { success: false, error: "Permission denied" };
  }

  await connectMongo();
  await ProjectModel.updateOne({ id }, { deleted_at: new Date() });
  await logActivity({
    action: "soft_deleted",
    entity_type: "project",
    entity_id: id,
  });
  bustProjects();
  return { success: true };
}
