"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Paperclip,
  Image as ImageIcon,
  FileText,
  SendHorizontal,
  MessagesSquare,
  X,
} from "lucide-react";
import { sendGroupMessageAction } from "@/actions/groups";
import type { ActionResult } from "@/core/types/result";
import { formatDateTime, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export type ChatAttachment = {
  file_id?: string | null;
  file_path?: string | null;
  file_name: string;
  mime_type: string | null;
  size: number;
  url?: string | null;
};

export type ChatMessage = {
  id: string;
  body: string;
  sender_user_id: string;
  created_at: string;
  attachments?: ChatAttachment[];
  sender: { id: string; full_name: string; role: string } | null;
};

function attachmentUrl(a: ChatAttachment) {
  if (a.url) return a.url;
  if (a.file_path?.startsWith("http://") || a.file_path?.startsWith("https://")) {
    return a.file_path;
  }
  if (a.file_id) return `/api/groups/files/${a.file_id}`;
  if (a.file_path) return `/api/files/${a.file_path}`;
  return null;
}

function isImage(mime: string | null, name: string) {
  if (mime?.startsWith("image/")) return true;
  return /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(name);
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function dayKey(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toDateString();
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function timeLabel(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return formatDateTime(iso);
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function GroupChatPanel({
  groupId,
  messages: initialMessages,
  currentUserId,
  title = "Group chat",
}: {
  groupId: string;
  messages: ChatMessage[];
  currentUserId: string;
  title?: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [live, setLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [pending, setPending] = useState(false);
  const [composerFocus, setComposerFocus] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const idsRef = useRef(new Set(initialMessages.map((m) => m.id)));
  const lastAtRef = useRef(
    initialMessages[initialMessages.length - 1]?.created_at ?? ""
  );
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  function mergeMessages(incoming: ChatMessage[]) {
    if (!incoming.length) return;
    setMessages((prev) => {
      let changed = false;
      const next = [...prev];
      for (const msg of incoming) {
        if (!msg?.id || idsRef.current.has(msg.id)) continue;
        idsRef.current.add(msg.id);
        next.push(msg);
        changed = true;
        if (msg.created_at > (lastAtRef.current || "")) {
          lastAtRef.current = msg.created_at;
        }
      }
      return changed ? next : prev;
    });
  }

  async function pullLatest() {
    const after = lastAtRef.current;
    const url = after
      ? `/api/groups/${groupId}/messages?after=${encodeURIComponent(after)}`
      : `/api/groups/${groupId}/messages`;
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as ChatMessage[];
      if (Array.isArray(data)) mergeMessages(data);
    } catch {
      // ignore
    }
  }

  // Seed / sync when server props change (first load or navigation)
  useEffect(() => {
    setMessages(initialMessages);
    idsRef.current = new Set(initialMessages.map((m) => m.id));
    lastAtRef.current =
      initialMessages[initialMessages.length - 1]?.created_at ?? "";
  }, [groupId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Live stream + auto-reconnect
  useEffect(() => {
    let es: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const connect = () => {
      if (stopped) return;
      const after = lastAtRef.current;
      const qs = after ? `?after=${encodeURIComponent(after)}` : "";
      es = new EventSource(`/api/groups/${groupId}/stream${qs}`);

      es.addEventListener("ready", () => setLive(true));
      es.addEventListener("chat", (ev) => {
        try {
          const msg = JSON.parse((ev as MessageEvent).data) as ChatMessage;
          if (msg?.id) mergeMessages([msg]);
        } catch {
          // ignore
        }
      });
      es.addEventListener("ping", () => setLive(true));
      es.onerror = () => {
        setLive(false);
        es?.close();
        if (stopped) return;
        retryTimer = setTimeout(connect, 1500);
      };
    };

    connect();
    void pullLatest();

    return () => {
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
      es?.close();
      setLive(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  // Fast poll so chat stays instant even if SSE drops (e.g. multi-instance)
  useEffect(() => {
    const timer = setInterval(() => {
      void pullLatest();
    }, live ? 3000 : 1500);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, live]);

  // Instant catch-up when tab becomes visible again
  useEffect(() => {
    const onFocus = () => {
      void pullLatest();
    };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const filePreviews = useMemo(
    () =>
      files.map((f) => ({
        name: f.name,
        isImg: f.type.startsWith("image/"),
        url: f.type.startsWith("image/") ? URL.createObjectURL(f) : null,
      })),
    [files]
  );

  useEffect(() => {
    return () => {
      filePreviews.forEach((p) => {
        if (p.url) URL.revokeObjectURL(p.url);
      });
    };
  }, [filePreviews]);

  async function onSubmit(formData: FormData) {
    setError(null);
    const payload = new FormData();
    payload.set("group_id", groupId);
    const body = String(formData.get("body") || "").trim();
    if (body) payload.set("body", body);
    const attached = [...files];
    attached.forEach((f) => payload.append("files", f));

    if (!body && attached.length === 0) {
      setError("Write a message or attach a file");
      return;
    }

    const tempId = `temp-${Date.now()}`;
    const optimistic: ChatMessage = {
      id: tempId,
      body,
      sender_user_id: currentUserId,
      created_at: new Date().toISOString(),
      attachments: attached.map((f) => ({
        file_name: f.name,
        mime_type: f.type || null,
        size: f.size,
        url: f.type.startsWith("image/") ? URL.createObjectURL(f) : null,
      })),
      sender: { id: currentUserId, full_name: "You", role: "employee" },
    };
    idsRef.current.add(tempId);
    setMessages((prev) => [...prev, optimistic]);
    formRef.current?.reset();
    setFiles([]);
    if (fileRef.current) fileRef.current.value = "";
    if (bodyRef.current) bodyRef.current.value = "";

    setPending(true);
    try {
      const result: ActionResult = await sendGroupMessageAction(null, payload);
      if (!result.success) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        idsRef.current.delete(tempId);
        setError(result.error ?? "Failed to send");
        return;
      }
      if (
        result.data &&
        typeof result.data === "object" &&
        "id" in result.data
      ) {
        const msg = result.data as ChatMessage;
        setMessages((prev) => {
          const withoutTemp = prev.filter((m) => m.id !== tempId);
          idsRef.current.delete(tempId);
          if (idsRef.current.has(msg.id)) return withoutTemp;
          idsRef.current.add(msg.id);
          if (msg.created_at > (lastAtRef.current || "")) {
            lastAtRef.current = msg.created_at;
          }
          return [...withoutTemp, msg];
        });
      }
      void pullLatest();
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      idsRef.current.delete(tempId);
      setError("Failed to send");
    } finally {
      setPending(false);
    }
  }

  let lastDay = "";

  const particles = [
    { left: "12%", bottom: "8%", delay: "0s", duration: "6.5s" },
    { left: "28%", bottom: "18%", delay: "1.2s", duration: "7.8s" },
    { left: "48%", bottom: "6%", delay: "0.6s", duration: "8.2s" },
    { left: "66%", bottom: "22%", delay: "2s", duration: "6.2s" },
    { left: "82%", bottom: "12%", delay: "1.5s", duration: "7.1s" },
    { left: "38%", bottom: "30%", delay: "2.8s", duration: "8.6s" },
  ];

  return (
    <div className="animate-rise flex h-[min(70dvh,720px)] min-h-[420px] flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_24px_60px_-30px_rgba(15,23,42,0.5)] ring-1 ring-black/[0.03] sm:min-h-[500px] lg:h-[min(74vh,760px)]">
      <header className="relative z-10 flex items-center justify-between gap-2 border-b border-border/60 bg-gradient-to-r from-card via-card to-brand-soft/30 px-3 py-3 backdrop-blur-md sm:gap-3 sm:px-4 sm:py-3.5">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand text-white shadow-[0_8px_20px_-8px_var(--brand)] sm:h-11 sm:w-11">
            <MessagesSquare className="h-5 w-5" />
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-emerald-500 animate-live-dot" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold tracking-tight sm:text-[15px]">
              {title}
            </h2>
            <p className="truncate text-[11px] text-muted">
              {messages.length} message{messages.length === 1 ? "" : "s"} · saved
              securely
            </p>
          </div>
        </div>
        <div
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold tracking-wide transition-all",
            live
              ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 shadow-[0_0_20px_-8px_rgba(16,185,129,0.7)] dark:text-emerald-300"
              : "border-border bg-muted/20 text-muted"
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              live ? "animate-live-dot bg-emerald-500" : "bg-slate-400"
            )}
          />
          {live ? "LIVE" : "SYNCING"}
        </div>
      </header>

      <div className="group-chat-surface relative flex-1 overflow-y-auto">
        <div className="group-chat-surface__aurora" aria-hidden />
        <div className="group-chat-surface__orb group-chat-surface__orb--a" aria-hidden />
        <div className="group-chat-surface__orb group-chat-surface__orb--b" aria-hidden />
        <div className="group-chat-surface__orb group-chat-surface__orb--c" aria-hidden />
        <div className="group-chat-surface__grid" aria-hidden />
        <div className="group-chat-surface__sheen" aria-hidden />
        {particles.map((p, i) => (
          <span
            key={i}
            className="group-chat-surface__particle"
            style={{
              left: p.left,
              bottom: p.bottom,
              animationDelay: p.delay,
              animationDuration: p.duration,
            }}
            aria-hidden
          />
        ))}

        <div className="group-chat-surface__content space-y-1.5 px-3 py-5 sm:px-5">
          {messages.length === 0 && (
            <div className="animate-fade-up flex h-full min-h-[300px] flex-col items-center justify-center gap-4 text-center">
              <div className="relative">
                <div className="absolute inset-0 animate-pulse-soft rounded-3xl bg-brand/20 blur-xl" />
                <div className="relative flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-3xl border border-brand/20 bg-card/80 text-brand shadow-lg backdrop-blur">
                  <MessagesSquare className="h-8 w-8" />
                </div>
              </div>
              <div>
                <p className="text-base font-semibold tracking-tight">
                  Start the conversation
                </p>
                <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted">
                  Drop a message, photo, or file — the team sees it live, and
                  everything stays after refresh.
                </p>
              </div>
            </div>
          )}

          {messages.map((m, index) => {
            const mine = m.sender_user_id === currentUserId;
            const day = dayKey(m.created_at);
            const showDay = day !== lastDay;
            lastDay = day;
            const name = m.sender?.full_name ?? "Unknown";

            return (
              <div key={m.id}>
                {showDay && (
                  <div className="animate-fade-up my-5 flex justify-center">
                    <span className="rounded-full border border-border/50 bg-card/75 px-3.5 py-1 text-[11px] font-semibold tracking-wide text-muted shadow-sm backdrop-blur-md">
                      {dayLabel(m.created_at)}
                    </span>
                  </div>
                )}
                <div
                  className={cn(
                    "animate-bubble-in flex gap-2.5",
                    mine ? "justify-end" : "justify-start"
                  )}
                  style={{ animationDelay: `${Math.min(index, 12) * 18}ms` }}
                >
                  {!mine && (
                    <div
                      className="mt-auto mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-[var(--accent)] text-[10px] font-bold text-white shadow-sm"
                      title={name}
                    >
                      {initials(name) || "?"}
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[min(86%,440px)] rounded-2xl px-3.5 py-2.5 text-sm shadow-[0_8px_24px_-16px_rgba(15,23,42,0.45)] transition duration-200 hover:-translate-y-0.5",
                      mine
                        ? "rounded-br-md bg-gradient-to-br from-brand to-[color-mix(in_srgb,var(--brand)_82%,#0f172a)] text-white"
                        : "rounded-bl-md border border-border/60 bg-card/90 text-foreground backdrop-blur-md"
                    )}
                  >
                    {!mine && (
                      <p className="mb-1 text-[11px] font-semibold tracking-wide text-brand">
                        {name}
                      </p>
                    )}
                    {m.body ? (
                      <p className="whitespace-pre-wrap break-words leading-relaxed">
                        {m.body}
                      </p>
                    ) : null}
                    {(m.attachments ?? []).length > 0 && (
                      <div className={cn("space-y-2", m.body && "mt-2")}>
                        {(m.attachments ?? []).map((a, idx) => {
                          const href = attachmentUrl(a);
                          if (!href) return null;
                          const img = isImage(a.mime_type, a.file_name);
                          const key = a.file_id || a.file_path || `${a.file_name}-${idx}`;
                          if (img) {
                            return (
                              <a
                                key={key}
                                href={href}
                                target="_blank"
                                rel="noreferrer"
                                className="block overflow-hidden rounded-xl ring-1 ring-black/5 transition hover:opacity-95"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={href}
                                  alt={a.file_name}
                                  className="max-h-52 w-full object-cover"
                                />
                              </a>
                            );
                          }
                          return (
                            <a
                              key={key}
                              href={href}
                              target="_blank"
                              rel="noreferrer"
                              className={cn(
                                "flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs transition hover:opacity-90",
                                mine ? "bg-white/15" : "bg-surface/60"
                              )}
                            >
                              <span
                                className={cn(
                                  "flex h-8 w-8 items-center justify-center rounded-lg",
                                  mine
                                    ? "bg-white/20"
                                    : "bg-brand/10 text-brand"
                                )}
                              >
                                <FileText className="h-4 w-4" />
                              </span>
                              <span className="truncate font-medium">
                                {a.file_name}
                              </span>
                            </a>
                          );
                        })}
                      </div>
                    )}
                    <p
                      className={cn(
                        "mt-1.5 text-right text-[10px] tabular-nums tracking-wide",
                        mine ? "text-white/65" : "text-muted"
                      )}
                    >
                      {timeLabel(m.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      <form
        ref={formRef}
        className="relative z-10 border-t border-border/60 bg-gradient-to-t from-card via-card to-card/95 p-3.5 backdrop-blur-md"
        action={onSubmit}
      >
        <input type="hidden" name="group_id" value={groupId} />

        {filePreviews.length > 0 && (
          <div className="mb-2.5 flex flex-wrap gap-2">
            {filePreviews.map((p, i) => (
              <div
                key={`${p.name}-${i}`}
                className="animate-bubble-in relative flex items-center gap-2 rounded-xl border border-border/70 bg-surface/50 py-1 pl-1 pr-8 shadow-sm"
              >
                {p.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.url}
                    alt=""
                    className="h-10 w-10 rounded-lg object-cover"
                  />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand">
                    <FileText className="h-4 w-4" />
                  </span>
                )}
                <span className="max-w-[120px] truncate text-xs">{p.name}</span>
                <button
                  type="button"
                  className="absolute right-1 top-1 rounded-full p-0.5 text-muted hover:bg-card hover:text-foreground"
                  onClick={() =>
                    setFiles((prev) => prev.filter((_, idx) => idx !== i))
                  }
                  aria-label="Remove file"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div
          className={cn(
            "flex items-end gap-2 rounded-2xl border bg-background/70 p-2 shadow-inner transition-all duration-300",
            composerFocus
              ? "border-brand/45 shadow-[0_0_0_4px_color-mix(in_srgb,var(--brand)_16%,transparent)]"
              : "border-border/70"
          )}
        >
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
            className="hidden"
            onChange={(e) => {
              const list = e.target.files;
              if (!list?.length) return;
              setFiles((prev) => [...prev, ...Array.from(list)].slice(0, 5));
              e.target.value = "";
            }}
          />
          <div className="flex shrink-0 gap-0.5 pb-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl text-muted hover:bg-brand/10 hover:text-brand"
              onClick={() => fileRef.current?.click()}
              title="Attach file"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="hidden h-9 w-9 rounded-xl text-muted hover:bg-brand/10 hover:text-brand sm:inline-flex"
              onClick={() => fileRef.current?.click()}
              title="Attach photo"
            >
              <ImageIcon className="h-4 w-4" />
            </Button>
          </div>
          <Textarea
            ref={bodyRef}
            name="body"
            rows={1}
            placeholder="Write a message…"
            className="min-h-[40px] max-h-28 flex-1 resize-none border-0 bg-transparent px-1 py-2 shadow-none focus-visible:ring-0"
            onFocus={() => setComposerFocus(true)}
            onBlur={() => setComposerFocus(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                formRef.current?.requestSubmit();
              }
            }}
          />
          <Button
            type="submit"
            disabled={pending}
            size="icon"
            className="h-10 w-10 shrink-0 rounded-xl shadow-[0_8px_18px_-10px_var(--brand)] transition hover:scale-[1.04] active:scale-95"
            title="Send"
          >
            <SendHorizontal
              className={cn("h-4 w-4", pending && "animate-pulse")}
            />
          </Button>
        </div>
        {error && (
          <p className="mt-2 animate-bubble-in text-sm text-red-600">{error}</p>
        )}
      </form>
    </div>
  );
}
