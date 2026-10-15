"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { logActivity, createNotification } from "@/lib/activity";
import {
  canViewFinance,
  hasPermission,
  redactBudget,
  redactBudgetList,
} from "@/lib/rbac";
import { connectMongo } from "@/lib/mongodb";
import { ClientModel, CompanyModel, ProjectModel, newId, toIso } from "@/lib/db/models";
import { UserModel } from "@/lib/auth/user-model";
import { clientSchema } from "@/lib/validations";
import type { ActionResult } from "@/core/types/result";
import type { Client } from "@/types/database";
import { PAGE_SIZE } from "@/lib/constants";
import { CACHE_TTL, CRM_TAGS, cachedQuery, bustClients, bustPortal } from "@/lib/cache";

const notDeleted = {
  $or: [{ deleted_at: null }, { deleted_at: { $exists: false } }],
};
async function attachClientRelations(client: Record<string, unknown>) {
  const [company, manager, creator] = await Promise.all([
    client.company_id
      ? CompanyModel.findOne({ id: client.company_id, deleted_at: null }).lean()
      : null,
    client.assigned_manager_id
      ? UserModel.findOne({ id: client.assigned_manager_id }).lean()
      : null,
    client.created_by
      ? UserModel.findOne({ id: client.created_by }).lean()
      : null,
  ]);

  return mapClientRow(client, company, manager, creator);
}

function mapClientRow(
  client: Record<string, unknown>,
  company: { id: string; name: string } | null | undefined,
  manager:
    | { id: string; full_name: string; email: string }
    | null
    | undefined,
  creator: { id: string; full_name: string } | null | undefined
) {
  return {
    id: String(client.id),
    name: String(client.name),
    company_id: (client.company_id as string | null) ?? null,
    phone: (client.phone as string | null) ?? null,
    email: (client.email as string | null) ?? null,
    website: (client.website as string | null) ?? null,
    address: (client.address as string | null) ?? null,
    industry: (client.industry as string | null) ?? null,
    budget: Number(client.budget ?? 0),
    deadline: (client.deadline as string | null) ?? null,
    requirements: (client.requirements as string | null) ?? null,
    notes: (client.notes as string | null) ?? null,
    status: client.status as Client["status"],
    priority: client.priority as Client["priority"],
    created_by: (client.created_by as string | null) ?? null,
    assigned_manager_id: (client.assigned_manager_id as string | null) ?? null,
    portal_user_id: (client.portal_user_id as string | null) ?? null,
    created_at: toIso(client.created_at as Date) ?? new Date().toISOString(),
    updated_at: toIso(client.updated_at as Date) ?? new Date().toISOString(),
    deleted_at: toIso(client.deleted_at as Date | null),
    company: company ? { id: company.id, name: company.name } : null,
    assigned_manager: manager
      ? { id: manager.id, full_name: manager.full_name, email: manager.email }
      : null,
    created_by_profile: creator
      ? { id: creator.id, full_name: creator.full_name }
      : null,
  };
}

async function attachClientsBatch(rows: Record<string, unknown>[]) {
  const companyIds = [
    ...new Set(
      rows.map((r) => r.company_id as string | null).filter(Boolean) as string[]
    ),
  ];
  const userIds = [
    ...new Set(
      rows
        .flatMap((r) => [r.assigned_manager_id, r.created_by] as (string | null)[])
        .filter(Boolean) as string[]
    ),
  ];

  const [companies, users] = await Promise.all([
    companyIds.length
      ? CompanyModel.find({
          id: { $in: companyIds },
          deleted_at: null,
        })
          .select("id name")
          .lean()
      : Promise.resolve([]),
    userIds.length
      ? UserModel.find({ id: { $in: userIds } })
          .select("id full_name email")
          .lean()
      : Promise.resolve([]),
  ]);

  const companyMap = new Map(companies.map((c) => [String(c.id), c]));
  const userMap = new Map(users.map((u) => [String(u.id), u]));

  return rows.map((client) =>
    mapClientRow(
      client,
      client.company_id
        ? companyMap.get(String(client.company_id))
        : null,
      client.assigned_manager_id
        ? userMap.get(String(client.assigned_manager_id))
        : null,
      client.created_by ? userMap.get(String(client.created_by)) : null
    )
  );
}

export async function getClients(params?: {
  page?: number;
  search?: string;
  status?: string;
  priority?: string;
  sort?: string;
  order?: "asc" | "desc";
}) {
  const { requireStaffProfile } = await import("@/lib/auth/require-staff");
  const profile = await requireStaffProfile();
  if (!hasPermission(profile.role, "clients.view")) {
    throw new Error("You do not have access to client records");
  }

  const cacheKey = [
    "clients-list",
    String(params?.page ?? 1),
    params?.search ?? "",
    params?.status ?? "",
    params?.priority ?? "",
    params?.sort ?? "created_at",
    params?.order ?? "desc",
  ];

  const result = await cachedQuery(
    cacheKey,
    [CRM_TAGS.clients],
    () => loadClients(params),
    CACHE_TTL.list
  );

  return {
    ...result,
    data: redactBudgetList(result.data, profile.role),
  };
}

async function loadClients(params?: {
  page?: number;
  search?: string;
  status?: string;
  priority?: string;
  sort?: string;
  order?: "asc" | "desc";
}) {
  await connectMongo();
  const { safePageParams } = await import("@/lib/security/portal-scope");
  const { page, skip } = safePageParams({
    page: params?.page,
    pageSize: PAGE_SIZE,
    maxPageSize: PAGE_SIZE,
  });
  const filter: Record<string, unknown> = { deleted_at: null };

  if (params?.search) {
    filter.$or = [
      { name: { $regex: params.search, $options: "i" } },
      { email: { $regex: params.search, $options: "i" } },
      { industry: { $regex: params.search, $options: "i" } },
    ];
  }
  if (params?.status) filter.status = params.status;
  if (params?.priority) filter.priority = params.priority;

  const sortField = params?.sort || "created_at";
  const sortDir = params?.order === "asc" ? 1 : -1;
  const count = await ClientModel.countDocuments(filter);
  const rows = await ClientModel.find(filter)
    .sort({ [sortField]: sortDir })
    .skip(skip)
    .limit(PAGE_SIZE)
    .lean();

  const data = await attachClientsBatch(rows as Record<string, unknown>[]);

  return {
    data,
    count,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(count / PAGE_SIZE)),
  };
}

export async function getClient(id: string): Promise<Record<string, unknown> & { name: string; status: Client["status"]; priority: Client["priority"]; created_at: string; budget: number | null; email: string | null; phone: string | null; website: string | null; industry: string | null; requirements: string | null; company_id: string | null; assigned_manager_id: string | null; deadline: string | null; address: string | null }> {
  const { requireStaffProfile } = await import("@/lib/auth/require-staff");
  const profile = await requireStaffProfile();
  if (!hasPermission(profile.role, "clients.view")) {
    throw new Error("You do not have access to client records");
  }
  await connectMongo();
  const client = await ClientModel.findOne({ id, deleted_at: null }).lean();
  if (!client) throw new Error("Client not found");
  const row = await attachClientRelations(client as Record<string, unknown>);
  return redactBudget(row, profile.role) as typeof row;
}

export async function createClientAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const profile = await requireProfile();
  if (!hasPermission(profile.role, "clients.create")) {
    return { success: false, error: "Permission denied" };
  }

  const parsed = clientSchema.safeParse({
    name: formData.get("name"),
    company_id: formData.get("company_id") || null,
    phone: formData.get("phone") || "",
    email: formData.get("email") || "",
    website: formData.get("website") || "",
    address: formData.get("address") || "",
    industry: formData.get("industry") || "",
    budget: formData.get("budget") || 0,
    deadline: formData.get("deadline") || null,
    requirements: formData.get("requirements") || "",
    status: formData.get("status") || "lead",
    priority: formData.get("priority") || "medium",
    assigned_manager_id: formData.get("assigned_manager_id") || null,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message };
  }

  await connectMongo();
  const id = newId();
  const allowFinance = canViewFinance(profile.role);
  const doc = await ClientModel.create({
    id,
    ...parsed.data,
    budget: allowFinance ? parsed.data.budget : 0,
    company_id: parsed.data.company_id || null,
    assigned_manager_id: parsed.data.assigned_manager_id || null,
    deadline: parsed.data.deadline || null,
    email: parsed.data.email || null,
    website: parsed.data.website || null,
    created_by: profile.id,
  });

  await logActivity({
    action: "created",
    entity_type: "client",
    entity_id: id,
    metadata: { name: doc.name },
  });

  if (doc.assigned_manager_id) {
    await createNotification({
      user_id: doc.assigned_manager_id,
      title: "New client assigned",
      message: `You were assigned to client ${doc.name}`,
      link: `/clients/${id}`,
    });
  }

  bustClients();
  return { success: true, data: { id } };
}

export async function updateClientAction(
  id: string,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const profile = await requireProfile();
  if (!hasPermission(profile.role, "clients.update")) {
    return { success: false, error: "Permission denied" };
  }

  const parsed = clientSchema.safeParse({
    name: formData.get("name"),
    company_id: formData.get("company_id") || null,
    phone: formData.get("phone") || "",
    email: formData.get("email") || "",
    website: formData.get("website") || "",
    address: formData.get("address") || "",
    industry: formData.get("industry") || "",
    budget: formData.get("budget") || 0,
    deadline: formData.get("deadline") || null,
    requirements: formData.get("requirements") || "",
    status: formData.get("status") || "lead",
    priority: formData.get("priority") || "medium",
    assigned_manager_id: formData.get("assigned_manager_id") || null,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message };
  }

  await connectMongo();
  const allowFinance = canViewFinance(profile.role);
  const { budget: parsedBudget, ...clientFields } = parsed.data;
  const updated = await ClientModel.findOneAndUpdate(
    { id, ...notDeleted },
    {
      ...clientFields,
      ...(allowFinance ? { budget: parsedBudget } : {}),
      company_id: parsed.data.company_id || null,
      assigned_manager_id: parsed.data.assigned_manager_id || null,
      deadline: parsed.data.deadline || null,
      email: parsed.data.email || null,
      website: parsed.data.website || null,
    },
    { new: true }
  ).lean();

  if (!updated) return { success: false, error: "Client not found" };

  // Keep linked projects in sync when client budget was empty on the project.
  const nextBudget = Number(parsedBudget ?? 0);
  if (allowFinance && nextBudget > 0) {
    await ProjectModel.updateMany(
      {
        client_id: id,
        ...notDeleted,
        $or: [{ budget: 0 }, { budget: null }, { budget: { $exists: false } }],
      },
      { $set: { budget: nextBudget } }
    );
  }

  await logActivity({
    action: "updated",
    entity_type: "client",
    entity_id: id,
    metadata: { name: updated.name },
  });

  bustClients();
  bustPortal();
  revalidatePath(`/clients/${id}`);
  revalidatePath("/portal", "layout");
  return { success: true, data: { id } };
}

export async function softDeleteClientAction(id: string): Promise<ActionResult> {
  const profile = await requireProfile();
  if (!hasPermission(profile.role, "clients.delete")) {
    return { success: false, error: "Permission denied" };
  }

  await connectMongo();
  await ClientModel.updateOne(
    { id },
    { deleted_at: new Date() }
  );

  await logActivity({
    action: "soft_deleted",
    entity_type: "client",
    entity_id: id,
  });

  bustClients();
  return { success: true };
}
