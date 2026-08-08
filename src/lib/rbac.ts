import { ROLE_HIERARCHY } from "@/lib/constants";
import type { UserRole } from "@/types/database";

export type Permission =
  | "users.manage"
  | "roles.manage"
  | "clients.create"
  | "clients.update"
  | "clients.delete"
  | "clients.view"
  | "companies.manage"
  | "projects.create"
  | "projects.update"
  | "projects.view"
  | "tasks.create"
  | "tasks.assign"
  | "tasks.update"
  | "tasks.view"
  | "reports.view"
  | "finance.view"
  | "settings.manage"
  | "documents.upload"
  | "documents.view"
  | "activity.view"
  | "portal.view";

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  super_admin: [
    "users.manage",
    "roles.manage",
    "clients.create",
    "clients.update",
    "clients.delete",
    "clients.view",
    "companies.manage",
    "projects.create",
    "projects.update",
    "projects.view",
    "tasks.create",
    "tasks.assign",
    "tasks.update",
    "tasks.view",
    "reports.view",
    "finance.view",
    "settings.manage",
    "documents.upload",
    "documents.view",
    "activity.view",
  ],
  admin: [
    "users.manage",
    "clients.create",
    "clients.update",
    "clients.delete",
    "clients.view",
    "companies.manage",
    "projects.create",
    "projects.update",
    "projects.view",
    "tasks.create",
    "tasks.assign",
    "tasks.update",
    "tasks.view",
    "reports.view",
    "finance.view",
    "documents.upload",
    "documents.view",
    "activity.view",
  ],
  manager: [
    "clients.view",
    "clients.update",
    "companies.manage",
    "projects.create",
    "projects.update",
    "projects.view",
    "tasks.create",
    "tasks.assign",
    "tasks.update",
    "tasks.view",
    "reports.view",
    "finance.view",
    "documents.upload",
    "documents.view",
    "activity.view",
  ],
  employee: [
    "projects.view",
    "tasks.update",
    "tasks.view",
    "documents.upload",
    "documents.view",
  ],
  client: [
    "portal.view",
    "projects.view",
    "tasks.view",
    "documents.view",
    "documents.upload",
  ],
};

export function hasPermission(role: UserRole, permission: Permission) {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/** Budget, pipeline, revenue — hidden from employees. */
export function canViewFinance(role: UserRole) {
  return hasPermission(role, "finance.view");
}

/** Client records & contact info — employees work via manager only. */
export function canViewClients(role: UserRole) {
  return hasPermission(role, "clients.view");
}

/** Strip payment/budget fields for roles without finance access. */
export function redactBudget<T extends { budget?: unknown }>(
  row: T,
  role: UserRole
): T {
  if (canViewFinance(role)) return row;
  return { ...row, budget: null };
}

export function redactBudgetList<T extends { budget?: unknown }>(
  rows: T[],
  role: UserRole
): T[] {
  if (canViewFinance(role)) return rows;
  return rows.map((row) => ({ ...row, budget: null }));
}

/** Hide client identity from employees on project payloads. */
export function redactClientInfo<
  T extends {
    client?: unknown;
    client_id?: unknown;
    client_name?: unknown;
  },
>(row: T, role: UserRole): T {
  if (canViewClients(role)) return row;
  return {
    ...row,
    client: null,
    client_id: null,
    client_name: "—",
  };
}

export function redactClientInfoList<
  T extends {
    client?: unknown;
    client_id?: unknown;
    client_name?: unknown;
  },
>(rows: T[], role: UserRole): T[] {
  if (canViewClients(role)) return rows;
  return rows.map((row) => redactClientInfo(row, role));
}

export function hasMinRole(role: UserRole, minRole: UserRole) {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minRole];
}

export function isStaffRole(role: UserRole) {
  return role !== "client";
}

export function homePathForRole(role: UserRole) {
  return role === "client" ? "/portal" : "/dashboard";
}

export function canAccessRoute(role: UserRole, path: string) {
  if (role === "client") {
    return (
      path.startsWith("/portal") ||
      path.startsWith("/api/files") ||
      path.startsWith("/api/groups")
    );
  }
  if (path.startsWith("/portal")) return false;
  if (path.startsWith("/users") || path.startsWith("/settings/roles")) {
    return hasPermission(role, "users.manage");
  }
  if (path.startsWith("/reports")) {
    return hasPermission(role, "reports.view");
  }
  if (path.startsWith("/activity")) {
    return hasPermission(role, "activity.view");
  }
  if (path.startsWith("/clients") || path.startsWith("/api/clients")) {
    return hasPermission(role, "clients.view");
  }
  if (path.startsWith("/companies")) {
    return hasPermission(role, "companies.manage");
  }
  if (path.startsWith("/meetings") || path.startsWith("/feedback")) {
    // Client meetings + feedback inbox — managers/admins, not employees
    return hasPermission(role, "clients.view");
  }
  if (path.startsWith("/groups")) {
    return hasPermission(role, "projects.view");
  }
  return true;
}
