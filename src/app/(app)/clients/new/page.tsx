import { redirect } from "next/navigation";
import { createClientAction } from "@/actions/clients";
import { getAllCompanies } from "@/actions/companies";
import { getManagersAndEmployees } from "@/actions/users";
import { requireProfile } from "@/lib/auth";
import { canViewFinance, hasPermission } from "@/lib/rbac";
import { ClientForm } from "@/components/features/client-form";

export const metadata = { title: "New Client" };

export default async function NewClientPage() {
  const profile = await requireProfile();
  if (!hasPermission(profile.role, "clients.create")) {
    redirect("/clients");
  }

  const [companies, users] = await Promise.all([
    getAllCompanies(),
    getManagersAndEmployees(),
  ]);

  const managers = users.filter((u) =>
    ["manager", "admin", "super_admin"].includes(u.role)
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Create Client</h1>
        <p className="text-slate-500">Add a new client to the CRM</p>
      </div>
      <ClientForm
        action={createClientAction}
        companies={companies}
        managers={managers}
        showBudget={canViewFinance(profile.role)}
      />
    </div>
  );
}
