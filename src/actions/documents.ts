"use server";

import { requireProfile } from "@/lib/auth";
import { connectMongo } from "@/lib/mongodb";
import {
  ClientModel,
  DocumentModel,
  ProjectModel,
  newId,
  toIso,
} from "@/lib/db/models";
import { UserModel } from "@/lib/auth/user-model";
import { saveUpload, deleteUpload } from "@/lib/storage";
import { bustDocuments, bustPortal } from "@/lib/cache";
import { hasPermission } from "@/lib/rbac";
import { canAccessDocument } from "@/lib/security/file-access";
import type { ActionResult } from "@/core/types/result";
import type { EntityType } from "@/types/database";

const notDeleted = {
  $or: [{ deleted_at: null }, { deleted_at: { $exists: false } }],
};

async function clientScopeForProfile(profileId: string) {
  const client = await ClientModel.findOne({
    portal_user_id: profileId,
    ...notDeleted,
  }).lean();
  if (!client) {
    return { clientId: null as string | null, projectIds: [] as string[] };
  }
  const projects = await ProjectModel.find({
    client_id: client.id,
    ...notDeleted,
  })
    .select("id")
    .lean();
  return {
    clientId: String(client.id),
    projectIds: projects.map((p) => String(p.id)),
  };
}

async function assertClientCanUpload(
  profileId: string,
  entity_type: EntityType,
  entity_id: string
) {
  const scope = await clientScopeForProfile(profileId);
  if (!scope.clientId) throw new Error("No client linked to this portal account");

  if (entity_type === "client" && entity_id === scope.clientId) return scope;
  if (entity_type === "project" && scope.projectIds.includes(entity_id)) {
    return scope;
  }
  throw new Error("You can only upload files to your own projects");
}

export async function getDocuments(params?: {
  entity_type?: EntityType;
  entity_id?: string;
}) {
  const profile = await requireProfile();
  await connectMongo();

  const filter: Record<string, unknown> = { deleted_at: null };

  if (profile.role === "client") {
    const scope = await clientScopeForProfile(profile.id);
    if (!scope.clientId) return [];

    if (params?.entity_type && params?.entity_id) {
      const ok = canAccessDocument({
        role: "client",
        hasDocumentsView: true,
        clientId: scope.clientId,
        clientProjectIds: scope.projectIds,
        doc: {
          entity_type: params.entity_type,
          entity_id: params.entity_id,
          file_path: "",
        },
      });
      if (!ok) return [];
      filter.entity_type = params.entity_type;
      filter.entity_id = params.entity_id;
    } else {
      filter.$or = [
        { entity_type: "client", entity_id: scope.clientId },
        { entity_type: "project", entity_id: { $in: scope.projectIds } },
      ];
    }
  } else {
    if (!hasPermission(profile.role, "documents.view")) return [];
    if (params?.entity_type) filter.entity_type = params.entity_type;
    if (params?.entity_id) filter.entity_id = params.entity_id;
    if (!hasPermission(profile.role, "clients.view")) {
      if (params?.entity_type === "client") return [];
      if (!params?.entity_type) {
        filter.entity_type = { $ne: "client" };
      }
    }
  }

  const rows = await DocumentModel.find(filter)
    .sort({ created_at: -1 })
    .limit(100)
    .lean();

  const uploaders = await UserModel.find({
    id: { $in: rows.map((r) => r.uploaded_by).filter(Boolean) },
  })
    .select("id full_name")
    .lean();
  const uploaderMap = new Map(uploaders.map((u) => [String(u.id), u]));

  return rows.map((d) => {
    const filePath = String(d.file_path ?? "");
    const chatId = filePath.startsWith("chat://")
      ? filePath.slice("chat://".length)
      : null;
    return {
      id: String(d.id),
      name: String(d.name ?? d.file_name ?? "file"),
      file_name: String(d.file_name ?? d.name ?? "file"),
      file_path: filePath,
      file_url: chatId
        ? `/api/groups/files/${chatId}`
        : filePath
          ? `/api/files/${filePath}`
          : null,
      file_size: d.file_size ? Number(d.file_size) : null,
      mime_type: d.mime_type ? String(d.mime_type) : null,
      entity_type: String(d.entity_type),
      entity_id: String(d.entity_id),
      uploaded_by: d.uploaded_by ? String(d.uploaded_by) : null,
      uploader_name: d.uploaded_by
        ? uploaderMap.get(String(d.uploaded_by))?.full_name ?? null
        : null,
      created_at: toIso(d.created_at as Date) ?? new Date().toISOString(),
    };
  });
}

export async function uploadDocumentAction(
  formData: FormData
): Promise<ActionResult> {
  const profile = await requireProfile();
  if (!hasPermission(profile.role, "documents.upload")) {
    return { success: false, error: "Permission denied" };
  }

  const file = formData.get("file") as File | null;
  const entity_type = formData.get("entity_type") as EntityType;
  const entity_id = formData.get("entity_id") as string;

  if (!file || !entity_type || !entity_id) {
    return { success: false, error: "File and entity are required" };
  }

  if (file.size > 10 * 1024 * 1024) {
    return { success: false, error: "File must be under 10MB" };
  }

  await connectMongo();

  if (profile.role === "client") {
    try {
      await assertClientCanUpload(profile.id, entity_type, entity_id);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Permission denied",
      };
    }
  } else if (entity_type === "client" && !hasPermission(profile.role, "clients.view")) {
    return { success: false, error: "Permission denied" };
  }

  const saved = await saveUpload(file, `${entity_type}/${entity_id}`);
  const id = newId();

  await DocumentModel.create({
    id,
    name: file.name,
    file_name: file.name,
    file_path: saved.relativePath,
    file_size: saved.size,
    mime_type: saved.mimeType,
    entity_type,
    entity_id,
    uploaded_by: profile.id,
  });

  if (profile.role === "client") {
    try {
      let managerId: string | null = null;
      let link = "/documents";
      if (entity_type === "project") {
        const project = await ProjectModel.findOne({ id: entity_id })
          .select("manager_id client_id name")
          .lean();
        managerId = (project?.manager_id as string | null) ?? null;
        if (!managerId && project?.client_id) {
          const client = await ClientModel.findOne({ id: project.client_id })
            .select("assigned_manager_id name")
            .lean();
          managerId = (client?.assigned_manager_id as string | null) ?? null;
        }
        link = `/projects/${entity_id}`;
      } else if (entity_type === "client") {
        const client = await ClientModel.findOne({ id: entity_id })
          .select("assigned_manager_id")
          .lean();
        managerId = (client?.assigned_manager_id as string | null) ?? null;
        link = `/clients/${entity_id}`;
      }
      if (managerId) {
        const { createNotification } = await import("@/lib/activity");
        await createNotification({
          user_id: managerId,
          title: "Client uploaded a document",
          message: `${profile.full_name} uploaded "${file.name}".`,
          type: "document",
          link,
        });
      }
    } catch {
      // upload succeeded; notification is best-effort
    }
  }

  bustDocuments();
  if (profile.role === "client") bustPortal();
  return { success: true, data: { id } };
}

export async function softDeleteDocumentAction(
  id: string
): Promise<ActionResult> {
  const profile = await requireProfile();
  if (!hasPermission(profile.role, "documents.upload")) {
    return { success: false, error: "Permission denied" };
  }

  await connectMongo();
  const doc = await DocumentModel.findOne({ id }).lean();
  if (!doc) return { success: false, error: "Not found" };

  if (profile.role === "client") {
    const scope = await clientScopeForProfile(profile.id);
    const allowed = canAccessDocument({
      role: "client",
      hasDocumentsView: true,
      clientId: scope.clientId,
      clientProjectIds: scope.projectIds,
      doc: {
        entity_type: String(doc.entity_type),
        entity_id: String(doc.entity_id),
        file_path: String(doc.file_path ?? ""),
      },
    });
    if (!allowed || String(doc.uploaded_by) !== profile.id) {
      return {
        success: false,
        error: "You can only delete files you uploaded",
      };
    }
  }

  await DocumentModel.updateOne({ id }, { deleted_at: new Date() });
  if (doc.file_path) await deleteUpload(doc.file_path);

  bustDocuments();
  if (profile.role === "client") bustPortal();
  return { success: true };
}
