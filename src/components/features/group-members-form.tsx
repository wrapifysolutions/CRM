"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { updateGroupMembersAction } from "@/actions/groups";
import { FormShell } from "@/components/forms/form-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type StaffOption = {
  id: string;
  full_name: string;
  email?: string;
  role?: string;
};

export function GroupMembersForm({
  groupId,
  users,
  selectedUserIds,
  canEdit,
  memberLabel = "members",
}: {
  groupId: string;
  users: StaffOption[];
  selectedUserIds: string[];
  canEdit: boolean;
  memberLabel?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>(selectedUserIds);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.full_name.toLowerCase().includes(q) ||
        (u.email && u.email.toLowerCase().includes(q))
    );
  }, [users, query]);

  const selectedUsers = users.filter((u) => selected.includes(u.id));

  if (!canEdit) {
    return (
      <div className="space-y-2 text-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          {memberLabel}
        </p>
        <ul className="space-y-1">
          {selectedUsers.map((u) => (
            <li key={u.id}>{u.full_name}</li>
          ))}
          {selectedUsers.length === 0 && (
            <li className="text-muted">No members</li>
          )}
        </ul>
      </div>
    );
  }

  return (
    <FormShell
      action={async (prev, formData) => {
        for (const id of selected) {
          formData.append("member_user_ids", id);
        }
        return updateGroupMembersAction(prev, formData);
      }}
      submitLabel="Save members"
      onSuccess={() => router.refresh()}
    >
      <input type="hidden" name="group_id" value={groupId} />
      <div className="space-y-2">
        <Label htmlFor="member_search">{memberLabel}</Label>
        <Input
          id="member_search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${memberLabel}...`}
        />
        <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-border p-2">
          {filtered.map((u) => (
            <label
              key={u.id}
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <input
                type="checkbox"
                checked={selected.includes(u.id)}
                onChange={() =>
                  setSelected((prev) =>
                    prev.includes(u.id)
                      ? prev.filter((x) => x !== u.id)
                      : [...prev, u.id]
                  )
                }
              />
              <span>
                {u.full_name}
                {u.role ? (
                  <span className="text-muted"> · {u.role}</span>
                ) : null}
              </span>
            </label>
          ))}
        </div>
        <p className="text-xs text-muted">
          Newly added {memberLabel} receive an email about the project
          assignment.
        </p>
      </div>
    </FormShell>
  );
}
