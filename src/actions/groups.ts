"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { requireStaffProfile } from "@/lib/auth/require-staff";
import { connectMongo } from "@/lib/mongodb";
import {
  ClientModel,
  ChatFileModel,
  DocumentModel,
  GroupMessageModel,
  ProjectModel,
  TaskModel,
  WorkGroupModel,
  newId,
  toIso,
} from "@/lib/db/models";
import { UserModel } from "@/lib/auth/user-model";
import { createNotification, logActivity } from "@/lib/activity";
import { hasPermission, isStaffRole } from "@/lib/rbac";
import { bustGroups, bustTasks } from "@/lib/cache";
import { sendGroupAssignmentEmail } from "@/lib/mail";
import { publishGroupChat } from "@/lib/groups/chat-bus";
import type { ActionResult } from "@/core/types/result";

const notDeleted = {
  $or: [{ deleted_at: null }, { deleted_at: { $exists: false } }],
};

const MAX_CHAT_FILE_BYTES = 6 * 1024 * 1024;
const ALLOWED_CHAT_EXT =
  /\.(jpe?g|png|gif|webp|heic|heif|pdf|doc|docx|xls|xlsx|txt|csv)$/i;

function isUploadedFile(value: FormDataEntryValue): value is File {
  if (typeof value !== "object" || value === null) return false;
  const f = value as File;
  return (
    typeof f.arrayBuffer === "function" &&
    typeof f.size === "number" &&
    f.size > 0 &&
    typeof f.name === "string"
  );
}

function uniqueIds(ids: string[]) {
  return [...new Set(ids.map(String).filter(Boolean))];
}

async function loadGroupOrThrow(groupId: string) {
  await connectMongo();
  const group = await WorkGroupModel.findOne({
    id: groupId,
    ...notDeleted,
  }).lean();
  if (!group) throw new Error("Group not found");
  return group;
}

export async function assertCanAccessGroup(
  profile: { id: string; role: string },
  group: {
    created_by?: string | null;
    member_user_ids?: string[];
    member_client_ids?: string[];
  }
) {
  if (profile.role === "super_admin" || profile.role === "admin") return;

  if (isStaffRole(profile.role as "manager" | "employee")) {
    const inGroup =
      String(group.created_by) === profile.id ||
      (group.member_user_ids ?? []).includes(profile.id);
    if (!inGroup) throw new Error("Not a member of this group");
    return;
  }

  if (profile.role === "client") {
    const client = await ClientModel.findOne({
      portal_user_id: profile.id,
      ...notDeleted,
    })
      .select("id")
      .lean();
    if (
      !client ||
      !(group.member_client_ids ?? []).includes(String(client.id))
    ) {
      throw new Error("Not a member of this group");
    }
    return;
  }

  throw new Error("Access denied");
}

function mapMessage(
  m: Record<string, unknown>,
  senderMap: Map<string, { id: string; full_name: string; role: string }>
) {
  const attachments = Array.isArray(m.attachments)
    ? (m.attachments as Record<string, unknown>[]).map((a) => {
        const fileId = a.file_id ? String(a.file_id) : null;
        const filePath = a.file_path ? String(a.file_path) : null;
        return {
          file_id: fileId,
          file_path: filePath,
          file_name: String(a.file_name),
          mime_type: a.mime_type ? String(a.mime_type) : null,
          size: Number(a.size || 0),
          url: fileId
            ? `/api/groups/files/${fileId}`
            : filePath
              ? `/api/files/${filePath}`
              : null,
        };
      })
    : [];

  return {
    id: String(m.id),
    group_id: String(m.group_id),
    sender_user_id: String(m.sender_user_id),
    body: String(m.body ?? ""),
    attachments,
    created_at: toIso(m.created_at as Date) ?? new Date().toISOString(),
    sender: senderMap.get(String(m.sender_user_id)) ?? null,
  };
}

async function enrichGroup(group: Record<string, unknown>) {
  const userIds = uniqueIds([
    ...((group.member_user_ids as string[]) ?? []),
    String(group.created_by ?? ""),
  ]);
  const clientIds = uniqueIds((group.member_client_ids as string[]) ?? []);

  const [project, users, clients] = await Promise.all([
    ProjectModel.findOne({ id: group.project_id })
      .select("id name client_id")
      .lean(),
    userIds.length
      ? UserModel.find({ id: { $in: userIds } })
          .select("id full_name email role")
          .lean()
      : Promise.resolve([]),
    clientIds.length
      ? ClientModel.find({ id: { $in: clientIds } })
          .select("id name portal_user_id")
          .lean()
      : Promise.resolve([]),
  ]);

  const userMap = new Map(users.map((u) => [String(u.id), u]));

  return {
    id: String(group.id),
    name: String(group.name),
    project_id: String(group.project_id),
    created_by: String(group.created_by),
    member_user_ids: (group.member_user_ids as string[]) ?? [],
    member_client_ids: (group.member_client_ids as string[]) ?? [],
    created_at: toIso(group.created_at as Date) ?? new Date().toISOString(),
    updated_at: toIso(group.updated_at as Date) ?? new Date().toISOString(),
    project: project
      ? {
          id: String(project.id),
          name: String(project.name),
          client_id: String(project.client_id),
        }
      : null,
    members_users: ((group.member_user_ids as string[]) ?? [])
      .map((id) => userMap.get(String(id)))
      .filter(Boolean)
      .map((u) => ({
        id: String(u!.id),
        full_name: String(u!.full_name),
        email: String(u!.email),
        role: String(u!.role),
      })),
    members_clients: clients.map((c) => ({
      id: String(c.id),
      name: String(c.name),
      portal_user_id: c.portal_user_id ? String(c.portal_user_id) : null,
    })),
    creator: group.created_by
      ? userMap.get(String(group.created_by))
        ? {
            id: String(userMap.get(String(group.created_by))!.id),
            full_name: String(
              userMap.get(String(group.created_by))!.full_name
            ),
          }
        : null
      : null,
  };
}

async function notifyEmployeesAssigned(params: {
  userIds: string[];
  skipUserId: string;
  managerName: string;
  projectName: string;
  groupName: string;
  groupId: string;
}) {
  if (params.userIds.length === 0) return;
  const users = await UserModel.find({
    id: { $in: params.userIds },
    role: { $in: ["employee", "manager"] },
  })
    .select("id email full_name")
    .lean();

  await Promise.all(
    users.map(async (u) => {
      if (String(u.id) === params.skipUserId) return;
      await createNotification({
        user_id: String(u.id),
        title: "Assigned to project group",
        message: `${params.managerName} assigned you to "${params.projectName}"`,
        type: "group",
        link: `/groups/${params.groupId}`,
      });
      if (u.email) {
        await sendGroupAssignmentEmail({
          to: String(u.email),
          employeeName: String(u.full_name),
          managerName: params.managerName,
          projectName: params.projectName,
          groupName: params.groupName,
          groupId: params.groupId,
        });
      }
    })
  );
}

export async function getStaffGroups() {
  const profile = await requireStaffProfile();
  if (!hasPermission(profile.role, "projects.view")) return [];

  await connectMongo();
  let rows;
  if (profile.role === "super_admin" || profile.role === "admin") {
    rows = await WorkGroupModel.find(notDeleted)
      .sort({ updated_at: -1 })
      .limit(100)
      .lean();
  } else {
    rows = await WorkGroupModel.find({
      ...notDeleted,
      $or: [{ created_by: profile.id }, { member_user_ids: profile.id }],
    })
      .sort({ updated_at: -1 })
      .limit(100)
      .lean();
  }

  return Promise.all(rows.map((g) => enrichGroup(g as Record<string, unknown>)));
}

export async function getPortalGroups() {
  const profile = await requireProfile();
  if (profile.role !== "client") throw new Error("Portal only");

  await connectMongo();
  const client = await ClientModel.findOne({
    portal_user_id: profile.id,
    ...notDeleted,
  })
    .select("id")
    .lean();
  if (!client) return [];

  const rows = await WorkGroupModel.find({
    ...notDeleted,
    member_client_ids: client.id,
  })
    .sort({ updated_at: -1 })
    .limit(50)
    .lean();

  return Promise.all(rows.map((g) => enrichGroup(g as Record<string, unknown>)));
}

export async function getGroup(id: string) {
  const profile = await requireProfile();
  const group = await loadGroupOrThrow(id);
  await assertCanAccessGroup(profile, group);
  return enrichGroup(group as Record<string, unknown>);
}

async function filterMembersByCreatorRole(
  creatorRole: string,
  creatorId: string,
  memberIds: string[]
) {
  const ids = uniqueIds(memberIds).filter((id) => id !== creatorId);
  if (ids.length === 0) return [] as string[];

  let allowedRole: string;
  if (creatorRole === "super_admin" || creatorRole === "admin") {
    allowedRole = "manager";
  } else if (creatorRole === "manager") {
    allowedRole = "employee";
  } else {
    return [];
  }

  const rows = await UserModel.find({
    id: { $in: ids },
    role: allowedRole,
    deleted_at: null,
    is_active: true,
    approval_status: "approved",
  })
    .select("id")
    .lean();

  return rows.map((r) => String(r.id));
}

export async function createGroupAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const profile = await requireStaffProfile();
  if (!hasPermission(profile.role, "projects.update")) {
    return { success: false, error: "Permission denied" };
  }

  const name = String(formData.get("name") || "").trim();
  const projectId = String(formData.get("project_id") || "").trim();
  if (name.length < 2) return { success: false, error: "Group name required" };
  if (!projectId) return { success: false, error: "Select a project" };

  await connectMongo();
  const project = await ProjectModel.findOne({
    id: projectId,
    ...notDeleted,
  }).lean();
  if (!project) return { success: false, error: "Project not found" };

  const picked = await filterMembersByCreatorRole(
    profile.role,
    profile.id,
    formData.getAll("member_user_ids") as string[]
  );
  const memberUserIds = uniqueIds([profile.id, ...picked]);
  // Keep project client on the group for portal access (no UI picker).
  const memberClientIds = uniqueIds([
    project.client_id ? String(project.client_id) : "",
  ]);

  const id = newId();
  await WorkGroupModel.create({
    id,
    name,
    project_id: projectId,
    created_by: profile.id,
    member_user_ids: memberUserIds,
    member_client_ids: memberClientIds,
  });

  await logActivity({
    action: "group.created",
    entity_type: "project",
    entity_id: projectId,
    metadata: { group_id: id, name },
  });

  const assigned = memberUserIds.filter((uid) => uid !== profile.id);
  await notifyEmployeesAssigned({
    userIds: assigned,
    skipUserId: profile.id,
    managerName: profile.full_name,
    projectName: String(project.name),
    groupName: name,
    groupId: id,
  });

  bustGroups();
  revalidatePath("/groups");
  return { success: true, data: { id } };
}

export async function updateGroupMembersAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const profile = await requireStaffProfile();
  if (!hasPermission(profile.role, "projects.update")) {
    return { success: false, error: "Permission denied" };
  }

  const groupId = String(formData.get("group_id") || "").trim();
  if (!groupId) return { success: false, error: "Missing group" };

  const group = await loadGroupOrThrow(groupId);
  await assertCanAccessGroup(profile, group);

  const previous = uniqueIds((group.member_user_ids as string[]) ?? []);
  const picked = await filterMembersByCreatorRole(
    profile.role,
    profile.id,
    formData.getAll("member_user_ids") as string[]
  );
  const memberUserIds = uniqueIds([
    String(group.created_by),
    profile.id,
    ...picked,
  ]);

  await WorkGroupModel.updateOne(
    { id: groupId },
    {
      $set: {
        member_user_ids: memberUserIds,
      },
    }
  );

  const newlyAdded = memberUserIds.filter((id) => !previous.includes(id));
  if (newlyAdded.length > 0) {
    const project = await ProjectModel.findOne({ id: group.project_id })
      .select("name")
      .lean();
    await notifyEmployeesAssigned({
      userIds: newlyAdded,
      skipUserId: profile.id,
      managerName: profile.full_name,
      projectName: String(project?.name ?? "Project"),
      groupName: String(group.name),
      groupId,
    });
  }

  bustGroups();
  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/portal/groups/${groupId}`);
  return { success: true };
}

export async function getGroupMessages(
  groupId: string,
  options?: { after?: string }
) {
  const profile = await requireProfile();
  const group = await loadGroupOrThrow(groupId);
  await assertCanAccessGroup(profile, group);

  const filter: Record<string, unknown> = { group_id: groupId };
  if (options?.after) {
    const afterDate = new Date(options.after);
    if (!Number.isNaN(afterDate.getTime())) {
      filter.created_at = { $gt: afterDate };
    }
  }

  const rows = await GroupMessageModel.find(filter)
    .sort({ created_at: 1 })
    .limit(300)
    .lean();

  const senderIds = uniqueIds(rows.map((r) => String(r.sender_user_id)));
  const senders = senderIds.length
    ? await UserModel.find({ id: { $in: senderIds } })
        .select("id full_name role")
        .lean()
    : [];
  const map = new Map(
    senders.map((u) => [
      String(u.id),
      {
        id: String(u.id),
        full_name: String(u.full_name),
        role: String(u.role),
      },
    ])
  );

  return rows.map((m) => mapMessage(m as Record<string, unknown>, map));
}

export async function sendGroupMessageAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const profile = await requireProfile();
  const groupId = String(formData.get("group_id") || "").trim();
  const body = String(formData.get("body") || "").trim();
  const files = formData.getAll("files").filter(isUploadedFile);

  if (!groupId) return { success: false, error: "Missing group" };
  if (body.length < 1 && files.length === 0) {
    return { success: false, error: "Message or file required" };
  }

  const group = await loadGroupOrThrow(groupId);
  await assertCanAccessGroup(profile, group);

  const messageId = newId();
  const attachments: {
    file_id: string;
    file_path: string | null;
    file_name: string;
    mime_type: string | null;
    size: number;
  }[] = [];

  for (const file of files.slice(0, 5)) {
    if (file.size > MAX_CHAT_FILE_BYTES) {
      return { success: false, error: `${file.name} is larger than 6MB` };
    }
    const mime = file.type || "application/octet-stream";
    const isImage = mime.startsWith("image/") || ALLOWED_CHAT_EXT.test(file.name);
    const allowed =
      isImage ||
      mime === "application/pdf" ||
      mime === "text/plain" ||
      mime === "text/csv" ||
      ALLOWED_CHAT_EXT.test(file.name);
    if (!allowed) {
      return {
        success: false,
        error: `${file.name}: only images, PDF, Word, Excel, or text allowed`,
      };
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const fileId = newId();
    await ChatFileModel.create({
      id: fileId,
      group_id: groupId,
      message_id: messageId,
      uploaded_by: profile.id,
      file_name: file.name,
      mime_type: mime,
      size: bytes.length,
      data: bytes,
    });

    attachments.push({
      file_id: fileId,
      file_path: null,
      file_name: file.name,
      mime_type: mime,
      size: bytes.length,
    });

    // Keep a project document index for staff document lists (no disk path).
    await DocumentModel.create({
      id: newId(),
      name: file.name,
      file_path: `chat://${fileId}`,
      file_size: bytes.length,
      mime_type: mime,
      entity_type: "project",
      entity_id: String(group.project_id),
      uploaded_by: profile.id,
    });
  }

  const created = await GroupMessageModel.create({
    id: messageId,
    group_id: groupId,
    sender_user_id: profile.id,
    body,
    attachments,
  });

  await WorkGroupModel.updateOne(
    { id: groupId },
    { $set: { updated_at: new Date() } }
  );

  const payload = mapMessage(
    created.toObject() as Record<string, unknown>,
    new Map([
      [
        profile.id,
        {
          id: profile.id,
          full_name: profile.full_name,
          role: profile.role,
        },
      ],
    ])
  );

  publishGroupChat(groupId, payload);

  bustGroups();
  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/portal/groups/${groupId}`);
  return { success: true, data: payload };
}

export async function getGroupTasks(groupId: string) {
  const profile = await requireProfile();
  const group = await loadGroupOrThrow(groupId);
  await assertCanAccessGroup(profile, group);

  const rows = await TaskModel.find({
    group_id: groupId,
    ...notDeleted,
  })
    .sort({ created_at: -1 })
    .limit(100)
    .lean();

  const assigneeIds = uniqueIds(
    rows.flatMap((t) => [
      ...(Array.isArray(t.assignee_ids) ? (t.assignee_ids as string[]) : []),
      t.assigned_to ? String(t.assigned_to) : "",
    ])
  );
  const users = assigneeIds.length
    ? await UserModel.find({ id: { $in: assigneeIds } })
        .select("id full_name")
        .lean()
    : [];
  const map = new Map(users.map((u) => [String(u.id), u]));

  return rows.map((t) => {
    const ids = uniqueIds([
      ...(Array.isArray(t.assignee_ids) ? (t.assignee_ids as string[]) : []),
      t.assigned_to ? String(t.assigned_to) : "",
    ]);
    return {
      id: String(t.id),
      title: String(t.title),
      description: (t.description as string | null) ?? null,
      status: String(t.status),
      priority: String(t.priority),
      due_date: (t.due_date as string | null) ?? null,
      assignee_ids: ids,
      assignees: ids
        .map((id) => map.get(id))
        .filter(Boolean)
        .map((u) => ({
          id: String(u!.id),
          full_name: String(u!.full_name),
        })),
      created_at: toIso(t.created_at as Date) ?? new Date().toISOString(),
    };
  });
}

/** Assign a task to multiple group members (staff). */
export async function createGroupTaskAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const profile = await requireStaffProfile();
  if (!hasPermission(profile.role, "tasks.create")) {
    return { success: false, error: "Permission denied" };
  }

  const groupId = String(formData.get("group_id") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const priority = String(formData.get("priority") || "medium");
  const due_date = String(formData.get("due_date") || "").trim() || null;
  const assigneeIds = uniqueIds(formData.getAll("assignee_ids") as string[]);

  if (!groupId) return { success: false, error: "Missing group" };
  if (title.length < 2) return { success: false, error: "Title required" };
  if (assigneeIds.length === 0) {
    return { success: false, error: "Select at least one assignee" };
  }

  const group = await loadGroupOrThrow(groupId);
  await assertCanAccessGroup(profile, group);

  let filtered: string[];
  if (profile.role === "manager") {
    // Managers may assign any approved employee (and add them to the group).
    const employees = await UserModel.find({
      id: { $in: assigneeIds },
      role: "employee",
      deleted_at: null,
      is_active: true,
      approval_status: "approved",
    })
      .select("id")
      .lean();
    filtered = employees.map((e) => String(e.id));
    if (filtered.length === 0) {
      return { success: false, error: "Select at least one employee" };
    }
    const existing = new Set(group.member_user_ids ?? []);
    const toAdd = filtered.filter((id) => !existing.has(id));
    if (toAdd.length > 0) {
      await WorkGroupModel.updateOne(
        { id: groupId },
        { $addToSet: { member_user_ids: { $each: toAdd } } }
      );
    }
  } else {
    const allowed = new Set(group.member_user_ids ?? []);
    allowed.add(String(group.created_by));
    filtered = assigneeIds.filter((id) => allowed.has(id));
    if (filtered.length === 0) {
      return { success: false, error: "Assignees must be group members" };
    }
  }

  const id = newId();
  await TaskModel.create({
    id,
    title,
    description: description || null,
    project_id: group.project_id,
    group_id: groupId,
    assigned_to: filtered[0],
    assignee_ids: filtered,
    due_date,
    priority,
    status: "todo",
    created_by: profile.id,
  });

  const files = formData.getAll("files").filter(isUploadedFile);
  let attachmentNames: string[] = [];
  if (files.length > 0) {
    try {
      const { saveTaskAttachments } = await import("@/lib/tasks/attachments");
      const saved = await saveTaskAttachments({
        files,
        taskId: id,
        uploadedBy: profile.id,
        projectId: String(group.project_id),
      });
      attachmentNames = saved.map((s) => s.name);
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to upload files",
      };
    }
  }

  await Promise.all(
    filtered.map((uid) =>
      createNotification({
        user_id: uid,
        title: "Group task assigned",
        message: attachmentNames.length
          ? `${title} in group (${attachmentNames.length} file${attachmentNames.length > 1 ? "s" : ""} attached)`
          : `${title} in group`,
        type: "task",
        link: `/tasks/${id}`,
      })
    )
  );

  await logActivity({
    action: "created",
    entity_type: "task",
    entity_id: id,
    metadata: {
      title,
      group_id: groupId,
      assignees: filtered,
      attachments: attachmentNames,
    },
  });

  bustTasks();
  bustGroups();
  revalidatePath(`/groups/${groupId}`);
  return { success: true, data: { id } };
}
