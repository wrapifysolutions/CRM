/** Shared CRM cache tags for Next.js Data Cache + in-memory invalidation. */
export const CRM_TAGS = {
  dashboard: "crm:dashboard",
  clients: "crm:clients",
  projects: "crm:projects",
  tasks: "crm:tasks",
  meetings: "crm:meetings",
  companies: "crm:companies",
  notifications: "crm:notifications",
  activity: "crm:activity",
  users: "crm:users",
  approvals: "crm:approvals",
  portal: "crm:portal",
  documents: "crm:documents",
  feedback: "crm:feedback",
  groups: "crm:groups",
} as const;

export type CrmTag = (typeof CRM_TAGS)[keyof typeof CRM_TAGS];

/** Default TTLs (seconds) — short enough to stay fresh, long enough to feel instant. */
export const CACHE_TTL = {
  dashboard: 45,
  list: 30,
  detail: 60,
  unread: 15,
  activity: 30,
  portal: 30,
} as const;
