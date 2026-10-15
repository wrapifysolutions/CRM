"use server";

import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { connectMongo } from "@/lib/mongodb";
import {
  ClientModel,
  DocumentModel,
  ProjectMeetingModel,
  ProjectModel,
  TaskModel,
  newId,
  toIso,
} from "@/lib/db/models";
import { UserModel } from "@/lib/auth/user-model";
import { hasPermission, isStaffRole } from "@/lib/rbac";
import { createNotification } from "@/lib/activity";
import { notifyApproversOfRegistration } from "@/actions/approvals";
import { resolveFileUrl } from "@/lib/cloudinary";
import type { ActionResult } from "@/core/types/result";
import { bustPortal, bustClients, bustUsers } from "@/lib/cache";
import type { ApprovalStatus } from "@/types/database";

const notDeleted = {
  $or: [{ deleted_at: null }, { deleted_at: { $exists: false } }],
};

export async function getPortalClient() {
  const profile = await requireProfile();
  if (profile.role !== "client") {
    throw new Error("Portal access only");
  }
  await connectMongo();
  const client = await ClientModel.findOne({
    portal_user_id: profile.id,
    ...notDeleted,
  }).lean();
  if (!client) {
    throw new Error("No client record linked to this portal account");
  }
  return {
    id: String(client.id),
    name: String(client.name),
    email: (client.email as string | null) ?? null,
    phone: (client.phone as string | null) ?? null,
    status: String(client.status),
    industry: (client.industry as string | null) ?? null,
    requirements: (client.requirements as string | null) ?? null,
    budget: Number(client.budget ?? 0),
    portal_user_id: profile.id,
  };
}

export async function getPortalProjects() {
  const client = await getPortalClient();
  await connectMongo();
  const rows = await ProjectModel.find({
    client_id: client.id,
    ...notDeleted,
  })
    .sort({ updated_at: -1 })
    .lean();

  const clientBudget = Number(client.budget ?? 0);

  return rows.map((p) => {
    const projectBudget = Number(p.budget ?? 0);
    return {
      id: String(p.id),
      name: String(p.name),
      status: String(p.status),
      progress: Number(p.progress ?? 0),
      budget: projectBudget > 0 ? projectBudget : clientBudget,
      deadline: (p.deadline as string | null) ?? null,
      description: (p.description as string | null) ?? null,
      priority: String(p.priority),
      manager_id: (p.manager_id as string | null) ?? null,
      updated_at: toIso(p.updated_at as Date) ?? new Date().toISOString(),
    };
  });
}

/** Managers the client may book with (project managers + assigned manager). */
export async function getPortalMeetingManagers() {
  const client = await getPortalClient();
  await connectMongo();

  const [clientDoc, projects] = await Promise.all([
    ClientModel.findOne({ id: client.id })
      .select("assigned_manager_id")
      .lean(),
    ProjectModel.find({ client_id: client.id, ...notDeleted })
      .select("id manager_id name")
      .lean(),
  ]);

  const idSet = new Set<string>();
  if (clientDoc?.assigned_manager_id) {
    idSet.add(String(clientDoc.assigned_manager_id));
  }
  for (const p of projects) {
    if (p.manager_id) idSet.add(String(p.manager_id));
  }

  if (idSet.size === 0) return [];

  const users = await UserModel.find({
    id: { $in: [...idSet] },
    is_active: true,
    approval_status: "approved",
    ...notDeleted,
  })
    .select("id full_name email role")
    .sort({ full_name: 1 })
    .lean();

  return users.map((u) => {
    const id = String(u.id);
    const projectNames = projects
      .filter((p) => String(p.manager_id) === id)
      .map((p) => String(p.name));
    let label = String(u.full_name);
    if (projectNames.length === 1) {
      label += ` (${projectNames[0]})`;
    } else {
      label += " (Project manager)";
    }
    return {
      id,
      full_name: String(u.full_name),
      email: String(u.email),
      label,
      project_ids: projects
        .filter((p) => String(p.manager_id) === id)
        .map((p) => String(p.id)),
    };
  });
}

async function getAllowedPortalManagerIds(clientId: string) {
  const [clientDoc, projects] = await Promise.all([
    ClientModel.findOne({ id: clientId })
      .select("assigned_manager_id")
      .lean(),
    ProjectModel.find({ client_id: clientId, ...notDeleted })
      .select("manager_id")
      .lean(),
  ]);
  const ids = new Set<string>();
  if (clientDoc?.assigned_manager_id) {
    ids.add(String(clientDoc.assigned_manager_id));
  }
  for (const p of projects) {
    if (p.manager_id) ids.add(String(p.manager_id));
  }
  return ids;
}

export async function getPortalProject(projectId: string) {
  const client = await getPortalClient();
  await connectMongo();
  const project = await ProjectModel.findOne({
    id: projectId,
    client_id: client.id,
    ...notDeleted,
  }).lean();
  if (!project) throw new Error("Project not found");

  const [tasks, documents, meetings, manager] = await Promise.all([
    TaskModel.find({ project_id: projectId, ...notDeleted })
      .sort({ updated_at: -1 })
      .lean(),
    DocumentModel.find({
      entity_type: "project",
      entity_id: projectId,
      ...notDeleted,
    })
      .sort({ created_at: -1 })
      .lean(),
    ProjectMeetingModel.find({
      project_id: projectId,
      client_id: client.id,
      deleted_at: null,
      $or: [
        { visible_to_client: true },
        { visible_to_client: { $exists: false } },
      ],
    })
      .sort({ scheduled_at: -1 })
      .lean(),
    project.manager_id
      ? UserModel.findOne({ id: project.manager_id })
          .select("id full_name email")
          .lean()
      : null,
  ]);

  const taskStats = {
    total: tasks.length,
    todo: tasks.filter((t) => t.status === "todo").length,
    in_progress: tasks.filter((t) => t.status === "in_progress").length,
    review: tasks.filter((t) => t.status === "review").length,
    done: tasks.filter((t) => t.status === "done").length,
  };

  return {
    client,
    project: {
      id: String(project.id),
      name: String(project.name),
      status: String(project.status),
      progress: Number(project.progress ?? 0),
      budget:
        Number(project.budget ?? 0) > 0
          ? Number(project.budget ?? 0)
          : Number(client.budget ?? 0),
      deadline: (project.deadline as string | null) ?? null,
      description: (project.description as string | null) ?? null,
      priority: String(project.priority),
      manager_id: (project.manager_id as string | null) ?? null,
      updated_at: toIso(project.updated_at as Date) ?? new Date().toISOString(),
    },
    manager: manager
      ? {
          id: String(manager.id),
          full_name: String(manager.full_name),
          email: String(manager.email),
        }
      : null,
    taskStats,
    tasks: tasks.map((t) => ({
      id: String(t.id),
      title: String(t.title),
      description: (t.description as string | null) ?? null,
      status: String(t.status),
      priority: String(t.priority),
      due_date: (t.due_date as string | null) ?? null,
    })),
    documents: documents.map((d) => ({
      id: String(d.id),
      file_name: String(d.file_name ?? d.name ?? "file"),
      file_path: String(d.file_path),
      file_url: resolveFileUrl(String(d.file_path)),
      created_at: toIso(d.created_at as Date) ?? new Date().toISOString(),
    })),
    meetings: meetings.map((m) => ({
      id: String(m.id),
      title: String(m.title),
      agenda: (m.agenda as string | null) ?? null,
      notes: (m.notes as string | null) ?? null,
      scheduled_at: String(m.scheduled_at),
      duration_minutes: Number(m.duration_minutes ?? 30),
      location: (m.location as string | null) ?? null,
      meeting_url: (m.meeting_url as string | null) ?? null,
      status: String(m.status),
    })),
  };
}

export async function getPortalMeetings() {
  const client = await getPortalClient();
  const { syncMeetingLifecycle } = await import("@/lib/meetings/lifecycle");
  await syncMeetingLifecycle();
  await connectMongo();
  const meetings = await ProjectMeetingModel.find({
    client_id: client.id,
    deleted_at: null,
    $or: [
      { visible_to_client: true },
      { visible_to_client: { $exists: false } },
    ],
  })
    .sort({ scheduled_at: -1 })
    .lean();

  const projectIds = [...new Set(meetings.map((m) => String(m.project_id)))];
  const managerIds = [
    ...new Set(
      meetings
        .map((m) => (m.manager_id ? String(m.manager_id) : null))
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const [projects, managers] = await Promise.all([
    projectIds.length
      ? ProjectModel.find({ id: { $in: projectIds } })
          .select("id name")
          .lean()
      : Promise.resolve([]),
    managerIds.length
      ? UserModel.find({ id: { $in: managerIds } })
          .select("id full_name")
          .lean()
      : Promise.resolve([]),
  ]);
  const projectMap = new Map(
    projects.map((p) => [String(p.id), String(p.name)])
  );
  const managerMap = new Map(
    managers.map((u) => [String(u.id), String(u.full_name)])
  );

  return meetings.map((m) => ({
    id: String(m.id),
    project_id: String(m.project_id),
    project_name: projectMap.get(String(m.project_id)) ?? "Project",
    manager_id: m.manager_id ? String(m.manager_id) : null,
    manager_name: m.manager_id
      ? managerMap.get(String(m.manager_id)) ?? "Project manager"
      : "Unassigned",
    title: String(m.title),
    agenda: (m.agenda as string | null) ?? null,
    notes: (m.notes as string | null) ?? null,
    scheduled_at: String(m.scheduled_at),
    duration_minutes: Number(m.duration_minutes ?? 30),
    location: (m.location as string | null) ?? null,
    meeting_url: (m.meeting_url as string | null) ?? null,
    status: String(m.status),
  }));
}

/** Client portal: request / schedule a meeting with their project manager. */
export async function portalScheduleMeetingAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const client = await getPortalClient();
  const profile = await requireProfile();

  const { meetingSchema } = await import("@/lib/validations");
  const parsed = meetingSchema.safeParse({
    title: formData.get("title"),
    agenda: formData.get("agenda") || null,
    notes: null,
    scheduled_at: formData.get("scheduled_at"),
    duration_minutes: formData.get("duration_minutes") || 30,
    location: formData.get("location") || null,
    meeting_url: formData.get("meeting_url") || null,
    manager_id: formData.get("manager_id") || null,
    visible_to_client: true,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid meeting",
    };
  }

  const projectId = String(formData.get("project_id") || "").trim();
  if (!projectId) {
    return { success: false, error: "Select a project first" };
  }

  await connectMongo();
  const project = await ProjectModel.findOne({
    id: projectId,
    client_id: client.id,
    ...notDeleted,
  }).lean();
  if (!project) {
    return { success: false, error: "Project not found for your account" };
  }

  const allowedManagers = await getAllowedPortalManagerIds(client.id);
  let managerId = parsed.data.manager_id
    ? String(parsed.data.manager_id)
    : null;

  if (managerId && !allowedManagers.has(managerId)) {
    return {
      success: false,
      error: "You can only meet with managers assigned to your account",
    };
  }

  if (!managerId) {
    managerId =
      (project.manager_id as string | null) ||
      ([...allowedManagers][0] ?? null);
  }

  if (!managerId) {
    return {
      success: false,
      error: "No manager is assigned yet. Contact support to assign one.",
    };
  }

  // Dedup accidental double submit
  const recent = await ProjectMeetingModel.findOne({
    project_id: projectId,
    created_by: profile.id,
    title: parsed.data.title,
    scheduled_at: parsed.data.scheduled_at,
    status: "scheduled",
    deleted_at: null,
    created_at: { $gte: new Date(Date.now() - 2 * 60_000) },
  })
    .select("id")
    .lean();
  if (recent) {
    return { success: true, data: { id: String(recent.id) } };
  }

  const id = newId();
  await ProjectMeetingModel.create({
    id,
    project_id: projectId,
    client_id: client.id,
    title: parsed.data.title,
    agenda: parsed.data.agenda || null,
    notes: null,
    scheduled_at: parsed.data.scheduled_at,
    duration_minutes: parsed.data.duration_minutes,
    location: parsed.data.location || null,
    meeting_url: parsed.data.meeting_url || null,
    status: "scheduled",
    created_by: profile.id,
    manager_id: managerId,
    visible_to_client: true,
  });

  if (managerId) {
    await createNotification({
      user_id: managerId,
      title: "Client requested a meeting",
      message: `${client.name} scheduled "${parsed.data.title}" on ${project.name}.`,
      type: "meeting",
      link: `/projects/${projectId}`,
    });

    const manager = await UserModel.findOne({ id: managerId })
      .select("email full_name")
      .lean();
    if (manager?.email) {
      const { sendMeetingScheduledEmail } = await import("@/lib/mail");
      void sendMeetingScheduledEmail({
        to: String(manager.email),
        recipientName: String(manager.full_name || "Manager"),
        scheduledByName: client.name || profile.full_name,
        audience: "manager",
        projectName: String(project.name),
        title: parsed.data.title,
        scheduledAt: parsed.data.scheduled_at,
        durationMinutes: parsed.data.duration_minutes,
        agenda: parsed.data.agenda,
        location: parsed.data.location,
        meetingUrl: parsed.data.meeting_url,
        linkPath: `/projects/${projectId}`,
      });
    }
  }

  const { bustMeetings, bustPortal } = await import("@/lib/cache");
  bustMeetings();
  bustPortal();

  return { success: true, data: { id } };
}

export async function getPortalOverview() {
  const profile = await requireProfile();
  if (profile.role !== "client") {
    throw new Error("Portal access only");
  }

  // Live read — budget/progress must not stick to a stale cache entry.
  return loadPortalOverviewForUser(profile.id);
}

async function loadPortalOverviewForUser(portalUserId: string) {
  await connectMongo();
  const { syncMeetingLifecycle } = await import("@/lib/meetings/lifecycle");
  await syncMeetingLifecycle();
  const clientDoc = await ClientModel.findOne({
    portal_user_id: portalUserId,
    ...notDeleted,
  }).lean();
  if (!clientDoc) {
    throw new Error("No client record linked to this portal account");
  }

  const client = {
    id: String(clientDoc.id),
    name: String(clientDoc.name),
    email: (clientDoc.email as string | null) ?? null,
    phone: (clientDoc.phone as string | null) ?? null,
    status: String(clientDoc.status),
    industry: (clientDoc.industry as string | null) ?? null,
    requirements: (clientDoc.requirements as string | null) ?? null,
    budget: Number(clientDoc.budget ?? 0),
    portal_user_id: portalUserId,
  };

  const projectRows = await ProjectModel.find({
    client_id: client.id,
    ...notDeleted,
  })
    .sort({ updated_at: -1 })
    .lean();

  const projects = projectRows.map((p) => {
    const projectBudget = Number(p.budget ?? 0);
    return {
      id: String(p.id),
      name: String(p.name),
      status: String(p.status),
      progress: Number(p.progress ?? 0),
      budget: projectBudget > 0 ? projectBudget : client.budget,
      deadline: (p.deadline as string | null) ?? null,
      description: (p.description as string | null) ?? null,
      priority: String(p.priority),
      updated_at: toIso(p.updated_at as Date) ?? new Date().toISOString(),
    };
  });

  const projectIds = projects.map((p) => p.id);
  const [tasks, documents, meetings] = await Promise.all([
    projectIds.length
      ? TaskModel.find({
          project_id: { $in: projectIds },
          ...notDeleted,
        }).lean()
      : Promise.resolve([]),
    DocumentModel.find({
      deleted_at: null,
      $or: [
        { entity_type: "client", entity_id: client.id },
        ...(projectIds.length
          ? [{ entity_type: "project", entity_id: { $in: projectIds } }]
          : []),
      ],
    }).lean(),
    ProjectMeetingModel.find({
      client_id: client.id,
      deleted_at: null,
      $or: [
        { visible_to_client: true },
        { visible_to_client: { $exists: false } },
      ],
    })
      .sort({ scheduled_at: 1 })
      .lean(),
  ]);

  const openTasks = tasks.filter((t) =>
    ["todo", "in_progress", "review"].includes(String(t.status))
  ).length;
  const doneTasks = tasks.filter((t) => String(t.status) === "done").length;
  const active = projects.filter((p) =>
    ["planning", "in_progress", "on_hold"].includes(p.status)
  ).length;
  const completed = projects.filter((p) => p.status === "completed").length;
  const avgProgress =
    projects.length === 0
      ? 0
      : Math.round(
          projects.reduce((s, p) => s + p.progress, 0) / projects.length
        );

  const upcomingMeetings = meetings
    .filter((m) => String(m.status) === "scheduled")
    .slice(0, 5)
    .map((m) => ({
      id: String(m.id),
      project_id: String(m.project_id),
      title: String(m.title),
      scheduled_at: String(m.scheduled_at),
      duration_minutes: Number(m.duration_minutes ?? 30),
      meeting_url: (m.meeting_url as string | null) ?? null,
      status: String(m.status),
    }));

  return {
    client,
    projects,
    active,
    completed,
    avgProgress,
    openTasks,
    doneTasks,
    documentCount: documents.length,
    upcomingMeetings,
    meetingCount: meetings.length,
    recentDocuments: documents.slice(0, 5).map((d) => ({
      id: String(d.id),
      file_name: String(d.file_name ?? d.name ?? "file"),
      file_path: String(d.file_path),
      file_url: resolveFileUrl(String(d.file_path)),
      entity_type: String(d.entity_type),
      created_at: toIso(d.created_at as Date) ?? new Date().toISOString(),
    })),
  };
}

/** Staff creates/links a portal login — starts pending until admin/super_admin approves. */
export async function enableClientPortalAction(
  clientId: string,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const profile = await requireProfile();
  if (!isStaffRole(profile.role) || !hasPermission(profile.role, "clients.update")) {
    return { success: false, error: "Permission denied" };
  }

  const email = String(formData.get("portal_email") || "")
    .toLowerCase()
    .trim();
  const password = String(formData.get("portal_password") || "");
  const full_name = String(formData.get("portal_name") || "").trim();

  if (!email || !email.includes("@")) {
    return { success: false, error: "Valid portal email required" };
  }
  if (password.length < 8) {
    return { success: false, error: "Password must be at least 8 characters" };
  }

  await connectMongo();
  const client = await ClientModel.findOne({
    id: clientId,
    ...notDeleted,
  }).lean();
  if (!client) return { success: false, error: "Client not found" };

  const existingUser = await UserModel.findOne({ email }).lean();
  const currentPortalId = (client.portal_user_id as string | null) ?? null;

  let otherClientUsingThisPortalUser = false;
  if (existingUser) {
    const linkedElsewhere = await ClientModel.findOne({
      portal_user_id: existingUser.id,
      id: { $ne: clientId },
      ...notDeleted,
    })
      .select("id")
      .lean();
    otherClientUsingThisPortalUser = Boolean(linkedElsewhere);
  }

  const { canUseEmailForClientPortal } = await import(
    "@/lib/security/portal-email"
  );
  const emailCheck = canUseEmailForClientPortal({
    existingUser: existingUser
      ? { id: String(existingUser.id), role: String(existingUser.role) }
      : null,
    currentClientPortalUserId: currentPortalId,
    otherClientUsingThisPortalUser,
  });
  if (!emailCheck.ok) {
    return { success: false, error: emailCheck.error };
  }

  let userId: string;
  let needsApproval = true;

  if (existingUser) {
    // Only reached when this is the same portal user for this client
    userId = String(existingUser.id);
    const alreadyApproved = existingUser.approval_status === "approved";
    needsApproval = !alreadyApproved;
    await UserModel.updateOne(
      { id: userId },
      {
        full_name: full_name || existingUser.full_name,
        passwordHash: await hash(password, 12),
        role: "client",
        approval_status: alreadyApproved ? "approved" : "pending",
        is_active: true,
        deleted_at: null,
      }
    );
  } else {
    userId = newId();
    await UserModel.create({
      id: userId,
      email,
      passwordHash: await hash(password, 12),
      full_name: full_name || String(client.name),
      role: "client",
      is_active: true,
      approval_status: "pending",
    });
  }

  await ClientModel.updateOne(
    { id: clientId },
    { portal_user_id: userId, email: client.email || email }
  );

  if (needsApproval) {
    await notifyApproversOfRegistration({
      full_name: full_name || String(client.name),
      email,
      role: "client",
      userId,
    });
    await createNotification({
      user_id: userId,
      title: "Portal access pending",
      message: `Your portal login for ${client.name} was created. An admin must approve it before you can enter.`,
      link: "/pending",
    });
  } else {
    await createNotification({
      user_id: userId,
      title: "Portal login updated",
      message: `Your WrapCRM portal credentials for ${client.name} were updated.`,
      link: "/portal",
    });
  }

  bustPortal();
  bustClients();
  bustUsers();
  revalidatePath(`/clients/${clientId}`);
  return {
    success: true,
    data: {
      email,
      pending: needsApproval,
      message: needsApproval
        ? "Portal login created. Admin must approve before the client can enter."
        : "Portal login updated. Client can sign in with the new password.",
    },
  };
}

export async function getPortalUserStatus(clientId: string): Promise<{
  linked: boolean;
  approval_status: ApprovalStatus | null;
  email: string | null;
}> {
  const profile = await requireProfile();
  if (!isStaffRole(profile.role)) {
    return { linked: false, approval_status: null, email: null };
  }
  await connectMongo();
  const client = await ClientModel.findOne({ id: clientId, ...notDeleted }).lean();
  if (!client?.portal_user_id) {
    return { linked: false, approval_status: null, email: null };
  }
  const user = await UserModel.findOne({ id: client.portal_user_id }).lean();
  if (!user) {
    return { linked: false, approval_status: null, email: null };
  }
  return {
    linked: true,
    approval_status: (user.approval_status as ApprovalStatus) ?? "pending",
    email: String(user.email),
  };
}
