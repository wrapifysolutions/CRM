/**
 * In-process pub/sub for live group chat (SSE).
 * Works for single-node `next dev` / `next start`.
 */
type ChatListener = (payload: unknown) => void;

const listeners = new Map<string, Set<ChatListener>>();

export function subscribeGroupChat(groupId: string, listener: ChatListener) {
  let set = listeners.get(groupId);
  if (!set) {
    set = new Set();
    listeners.set(groupId, set);
  }
  set.add(listener);
  return () => {
    set!.delete(listener);
    if (set!.size === 0) listeners.delete(groupId);
  };
}

export function publishGroupChat(groupId: string, payload: unknown) {
  const set = listeners.get(groupId);
  if (!set) return;
  for (const listener of set) {
    try {
      listener(payload);
    } catch {
      // ignore broken listeners
    }
  }
}
