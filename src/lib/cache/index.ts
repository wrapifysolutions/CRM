import { unstable_cache, revalidateTag, revalidatePath } from "next/cache";
import {
  memoryGet,
  memoryInvalidateByTags,
  memorySet,
} from "@/lib/cache/memory";
import { CRM_TAGS, type CrmTag } from "@/lib/cache/tags";

/**
 * Two-layer cache:
 * 1) In-memory (same Node process) — instant
 * 2) Next.js Data Cache (unstable_cache) — survives across requests
 */
export async function cachedQuery<T>(
  keyParts: string[],
  tags: CrmTag[],
  fn: () => Promise<T>,
  ttlSeconds: number
): Promise<T> {
  const key = keyParts.join("::");
  const memHit = memoryGet<T>(key);
  if (memHit !== undefined) return memHit;

  const run = unstable_cache(fn, keyParts, {
    tags,
    revalidate: ttlSeconds,
  });

  const data = await run();
  memorySet(key, data, ttlSeconds * 1000, tags);
  return data;
}

/** Bust memory + Next Data Cache tags, optionally refresh routes. */
export function bustCache(options: {
  tags: CrmTag[];
  paths?: string[];
}) {
  memoryInvalidateByTags(options.tags);
  for (const tag of options.tags) {
    revalidateTag(tag);
  }
  for (const path of options.paths ?? []) {
    revalidatePath(path);
  }
}

export function bustDashboard() {
  bustCache({
    tags: [CRM_TAGS.dashboard, CRM_TAGS.activity],
    paths: ["/dashboard", "/reports", "/activity"],
  });
}

export function bustClients() {
  bustCache({
    tags: [CRM_TAGS.clients, CRM_TAGS.dashboard, CRM_TAGS.activity],
    paths: ["/clients", "/dashboard"],
  });
}

export function bustProjects() {
  bustCache({
    tags: [
      CRM_TAGS.projects,
      CRM_TAGS.dashboard,
      CRM_TAGS.portal,
      CRM_TAGS.activity,
    ],
    paths: ["/projects", "/dashboard", "/portal", "/portal/projects"],
  });
  revalidatePath("/projects", "layout");
}

export function bustTasks() {
  bustCache({
    tags: [CRM_TAGS.tasks, CRM_TAGS.dashboard, CRM_TAGS.activity],
    paths: ["/tasks", "/dashboard"],
  });
}

export function bustMeetings() {
  bustCache({
    tags: [CRM_TAGS.meetings, CRM_TAGS.dashboard, CRM_TAGS.portal],
    paths: ["/meetings", "/dashboard", "/portal", "/portal/meetings"],
  });
}

export function bustCompanies() {
  bustCache({
    tags: [CRM_TAGS.companies, CRM_TAGS.clients],
    paths: ["/companies", "/clients"],
  });
}

export function bustNotifications() {
  bustCache({
    tags: [CRM_TAGS.notifications],
    paths: ["/notifications"],
  });
}

export function bustUsers() {
  bustCache({
    tags: [CRM_TAGS.users, CRM_TAGS.approvals, CRM_TAGS.dashboard],
    paths: ["/users", "/approvals", "/dashboard"],
  });
}

export function bustPortal() {
  bustCache({
    tags: [CRM_TAGS.portal, CRM_TAGS.projects, CRM_TAGS.meetings],
    paths: [
      "/portal",
      "/portal/projects",
      "/portal/meetings",
      "/portal/documents",
    ],
  });
  revalidatePath("/portal", "layout");
}

export function bustDocuments() {
  bustCache({
    tags: [CRM_TAGS.documents],
    paths: ["/documents"],
  });
}

export function bustFeedback() {
  bustCache({
    tags: [CRM_TAGS.feedback, CRM_TAGS.portal],
    paths: ["/feedback", "/portal/feedback"],
  });
}

export function bustGroups() {
  bustCache({
    tags: [CRM_TAGS.groups, CRM_TAGS.tasks, CRM_TAGS.portal],
    paths: ["/groups", "/portal/groups", "/tasks"],
  });
  revalidatePath("/groups", "layout");
  revalidatePath("/portal/groups", "layout");
}

export { CRM_TAGS, CACHE_TTL } from "@/lib/cache/tags";
export type { CrmTag } from "@/lib/cache/tags";
