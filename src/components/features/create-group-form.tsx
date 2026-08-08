"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createGroupAction } from "@/actions/groups";
import { FormShell } from "@/components/forms/form-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { ActionResult } from "@/core/types/result";

type StaffOption = {
  id: string;
  full_name: string;
  email?: string;
  role?: string;
};

export function CreateGroupForm({
  projects,
  users,
  memberLabel = "managers",
}: {
  projects: { id: string; name: string }[];
  users: StaffOption[];
  /** Shown in labels: "managers" for SA, "employees" for manager */
  memberLabel?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.full_name.toLowerCase().includes(q) ||
        (u.email && u.email.toLowerCase().includes(q))
    );
  }, [users, query]);

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function action(
    prev: ActionResult | null,
    formData: FormData
  ): Promise<ActionResult> {
    for (const id of selected) {
      formData.append("member_user_ids", id);
    }
    const result = await createGroupAction(prev, formData);
    if (result.success && result.data && typeof result.data === "object") {
      const id = (result.data as { id?: string }).id;
      if (id) router.push(`/groups/${id}`);
    }
    return result;
  }

  return (
    <FormShell action={action} submitLabel="Create group">
      <div className="space-y-2">
        <Label htmlFor="name">Group name *</Label>
        <Input
          id="name"
          name="name"
          required
          minLength={2}
          placeholder="e.g. Website redesign team"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="project_id">Linked project *</Label>
        <Select id="project_id" name="project_id" required defaultValue="">
          <option value="" disabled>
            Select project
          </option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="employee_search">Add {memberLabel} by name</Label>
        <Input
          id="employee_search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${memberLabel}...`}
        />
        <div className="max-h-52 space-y-1 overflow-y-auto rounded-md border border-border p-2">
          {filtered.length === 0 && (
            <p className="text-sm text-muted">No {memberLabel} match</p>
          )}
          {filtered.map((u) => (
            <label
              key={u.id}
              className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted/40"
            >
              <input
                type="checkbox"
                checked={selected.includes(u.id)}
                onChange={() => toggle(u.id)}
              />
              <span className="flex-1">
                <span className="font-medium">{u.full_name}</span>
                {u.role ? (
                  <span className="text-muted"> · {u.role}</span>
                ) : null}
                {u.email ? (
                  <span className="block text-xs text-muted">{u.email}</span>
                ) : null}
              </span>
            </label>
          ))}
        </div>
        <p className="text-xs text-muted">
          Selected: {selected.length}. They get an email that the project was
          assigned by you. You are always a member.
        </p>
      </div>
    </FormShell>
  );
}
