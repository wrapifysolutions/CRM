import { redirect } from "next/navigation";
import { createProjectAction } from "@/actions/projects";
import { getClientOptions } from "@/actions/options";
import { getManagersAndEmployees } from "@/actions/users";
import { requireProfile } from "@/lib/auth";
import { canViewFinance, hasPermission } from "@/lib/rbac";
import { ProjectForm } from "@/components/features/project-form";

export const metadata = { title: "New Project" };

export default async function NewProjectPage() {
  const profile = await requireProfile();
  if (!hasPermission(profile.role, "projects.create")) {
    redirect("/projects");
  }

  const [clients, users] = await Promise.all([
    getClientOptions(),
    getManagersAndEmployees(),
  ]);

  const managers = users.filter((u) =>
    ["manager", "admin", "super_admin"].includes(u.role)
  );
  const employees = users.filter(
    (u) => u.role === "employee" || u.role === "manager"
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Create Project</h1>
        <p className="text-slate-500">
          Link a project to a client and assign your team
        </p>
      </div>
      <ProjectForm
        action={createProjectAction}
        clients={clients}
        managers={managers}
        employees={employees}
        defaultManagerId={profile.id}
        showBudget={canViewFinance(profile.role)}
      />
    </div>
  );
}
