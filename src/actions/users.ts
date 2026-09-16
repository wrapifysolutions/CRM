"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { requireStaffProfile } from "@/lib/auth/require-staff";
import { logActivity } from "@/lib/activity";
import { hasPermission } from "@/lib/rbac";
import { connectMongo } from "@/lib/mongodb";
import { UserModel } from "@/lib/auth/user-model";
import { userManageSchema, profileUpdateSchema } from "@/lib/validations";
import type { ActionResult } from "@/core/types/result";
import type { Profile, UserRole } from "@/types/database";
import { PAGE_SIZE } from "@/lib/constants";
import { bustUsers } from "@/lib/cache";

function mapUser(doc: Record<string, unknown>): Profile {
  return {
    id: String(doc.id),
    email: String(doc.email),
    full_name: String(doc.full_name),
    role: doc.role as UserRole,
    phone: (doc.phone as string | null) ?? null,
    avatar_url: (doc.avatar_url as string | null) ?? null,
    is_active: Boolean(doc.is_active),
    approval_status:
      (doc.approval_status as Profile["approval_status"]) ?? "pending",
    approved_by: (doc.approved_by as string | null) ?? null,
    reports_to: (doc.reports_to as string | null) ?? null,
    deleted_at: doc.deleted_at
      ? new Date(doc.deleted_at as Date).toISOString()
      : null,
    created_at: new Date(
      (doc.created_at as Date | undefined) ?? Date.now()
    ).toISOString(),
    updated_at: new Date(
      (doc.updated_at as Date | undefined) ?? Date.now()
    ).toISOString(),
  };
}

function hierarchyUserFilter(profile: Profile): Record<string, unknown> {
  if (profile.role === "super_admin") return {};
  if (profile.role === "admin") {
    return {
      $or: [
        { id: profile.id },
        { role: { $in: ["manager", "employee"] } },
        { reports_to: profile.id },
      ],
    };
  }
  if (profile.role === "manager") {
    return {
      $or: [
        { id: profile.id },
        { role: "employee", reports_to: profile.id },
        { role: "employee", approved_by: profile.id },
      ],
    };
  }
  return { id: profile.id };
}

export async function getUsers(params?: {
  page?: number;
  search?: string;
  role?: string;
}) {
  const profile = await requireProfile();
  await connectMongo();

  const page = params?.page ?? 1;
  const clauses: Record<string, unknown>[] = [
    { deleted_at: null },
    hierarchyUserFilter(profile),
  ].filter((c) => Object.keys(c).length > 0);

  if (params?.search) {
    clauses.push({
      $or: [
        { full_name: { $regex: params.search, $options: "i" } },
        { email: { $regex: params.search, $options: "i" } },
      ],
    });
  }
  if (params?.role) clauses.push({ role: params.role });

  const filter = clauses.length === 1 ? clauses[0]! : { $and: clauses };

  const count = await UserModel.countDocuments(filter);
  const rows = await UserModel.find(filter)
    .sort({ created_at: -1 })
    .skip((page - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .lean();

  return {
    data: rows.map((r) => mapUser(r as Record<string, unknown>)),
    count,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(count / PAGE_SIZE)),
  };
}

export async function getManagersAndEmployees() {
  const profile = await requireProfile();
  await connectMongo();
  const hier = hierarchyUserFilter(profile);
  const clauses: Record<string, unknown>[] = [
    {
      deleted_at: null,
      is_active: true,
      approval_status: "approved",
      role: { $in: ["manager", "employee"] },
    },
    hier,
  ].filter((c) => Object.keys(c).length > 0);

  const filter = clauses.length === 1 ? clauses[0]! : { $and: clauses };
  const rows = await UserModel.find(filter).sort({ full_name: 1 }).lean();

  return rows.map((r) => ({
    id: String(r.id),
    full_name: r.full_name as string,
    email: r.email as string,
    role: r.role as UserRole,
  }));
}

/**
 * People a staff user may assign tasks to.
 * Managers → all approved employees; Admin/SA → managers + employees.
 */
export async function getTaskAssignees() {
  const profile = await requireProfile();
  if (!hasPermission(profile.role, "tasks.assign") &&
      !hasPermission(profile.role, "tasks.create")) {
    return [];
  }

  await connectMongo();

  if (profile.role === "manager") {
    const rows = await UserModel.find({
      deleted_at: null,
      is_active: true,
      approval_status: "approved",
      role: "employee",
    })
      .sort({ full_name: 1 })
      .select("id full_name email role")
      .lean();

    return rows.map((r) => ({
      id: String(r.id),
      full_name: String(r.full_name),
      email: String(r.email),
      role: r.role as UserRole,
    }));
  }

  // Admin / super_admin (and others with assign): managers + employees
  return getManagersAndEmployees();
}

/** Who can be added to a work group, by creator role. */
export async function getEmployeesForGroups() {
  const profile = await requireStaffProfile();
  if (!hasPermission(profile.role, "projects.view")) return [];

  await connectMongo();

  // Super admin / admin → managers only
  // Manager → their employees only
  if (profile.role === "super_admin" || profile.role === "admin") {
    const rows = await UserModel.find({
      deleted_at: null,
      is_active: true,
      approval_status: "approved",
      role: "manager",
    })
      .sort({ full_name: 1 })
      .select("id full_name email role")
      .lean();

    return rows.map((r) => ({
      id: String(r.id),
      full_name: String(r.full_name),
      email: String(r.email),
      role: r.role as UserRole,
    }));
  }

  if (profile.role === "manager") {
    const rows = await UserModel.find({
      deleted_at: null,
      is_active: true,
      approval_status: "approved",
      role: "employee",
    })
      .sort({ full_name: 1 })
      .select("id full_name email role")
      .lean();

    return rows.map((r) => ({
      id: String(r.id),
      full_name: String(r.full_name),
      email: String(r.email),
      role: r.role as UserRole,
    }));
  }

  return [];
}

export async function updateUserFromFormAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const id = String(formData.get("user_id") || "");
  if (!id) return { success: false, error: "Select a user" };
  return updateUserAction(id, _prev, formData);
}

export async function updateUserAction(
  id: string,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const profile = await requireProfile();
  if (!hasPermission(profile.role, "users.manage")) {
    return { success: false, error: "Permission denied" };
  }

  const parsed = userManageSchema.safeParse({
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    role: formData.get("role"),
    phone: formData.get("phone") || "",
    is_active: formData.get("is_active") === "true",
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message };
  }

  if (profile.role !== "super_admin" && parsed.data.role === "super_admin") {
    return { success: false, error: "Only Super Admin can assign Super Admin" };
  }
  if (
    profile.role === "admin" &&
    (parsed.data.role === "admin" || parsed.data.role === "super_admin")
  ) {
    return {
      success: false,
      error: "Admins can only manage Managers and Employees",
    };
  }

  await connectMongo();
  const updated = await UserModel.findOneAndUpdate(
    { id },
    {
      full_name: parsed.data.full_name,
      role: parsed.data.role,
      phone: parsed.data.phone || null,
      is_active: parsed.data.is_active ?? true,
    },
    { new: true }
  ).lean();

  if (!updated) return { success: false, error: "User not found" };

  await logActivity({
    action: "updated",
    entity_type: "user",
    entity_id: id,
    metadata: { role: updated.role },
  });

  bustUsers();
  return { success: true, data: mapUser(updated as Record<string, unknown>) };
}

export async function updateOwnProfileAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const profile = await requireProfile();
  const parsed = profileUpdateSchema.safeParse({
    full_name: formData.get("full_name"),
    phone: formData.get("phone") || "",
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message };
  }

  await connectMongo();
  await UserModel.updateOne(
    { id: profile.id },
    {
      full_name: parsed.data.full_name,
      phone: parsed.data.phone || null,
    }
  );

  bustUsers();
  revalidatePath("/settings");
  return { success: true };
}

export async function softDeleteUserAction(id: string): Promise<ActionResult> {
  const profile = await requireProfile();
  if (!hasPermission(profile.role, "users.manage")) {
    return { success: false, error: "Permission denied" };
  }
  if (id === profile.id) {
    return { success: false, error: "You cannot delete yourself" };
  }

  await connectMongo();
  await UserModel.updateOne(
    { id },
    { deleted_at: new Date(), is_active: false }
  );

  await logActivity({
    action: "soft_deleted",
    entity_type: "user",
    entity_id: id,
  });

  bustUsers();
  return { success: true };
}
