"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
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
  file_path: string;
  file_name: string;
  mime_type: string | null;
  size: number;
};

export type ChatMessage = {
  id: string;
  body: string;
  sender_user_id: string;
  created_at: string;
  attachments?: ChatAttachment[];
  sender: { id: string; full_name: string; role: string } | null;
};

function isImage(mime: string | null, name: string) {
  if (mime?.startsWith("image/")) return true;
  return /\.(jpe?g|png|gif|webp)$/i.test(name);
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
  const [pending, startTransition] = useTransition();
  const [composerFocus, setComposerFocus] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const idsRef = useRef(new Set(initialMessages.map((m) => m.id)));

  useEffect(() => {
    setMessages(initialMessages);
    idsRef.current = new Set(initialMessages.map((m) => m.id));
  }, [initialMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    const last = initialMessages[initialMessages.length - 1]?.created_at;
    const qs = last ? `?after=${encodeURIComponent(last)}` : "";
    const es = new EventSource(`/api/groups/${groupId}/stream${qs}`);

    es.addEventListener("ready", () => setLive(true));
    es.addEventListener("chat", (ev) => {
      try {
        const msg = JSON.parse((ev as MessageEvent).data) as ChatMessage;
        if (!msg?.id || idsRef.current.has(msg.id)) return;
        idsRef.current.add(msg.id);
        setMessages((prev) => [...prev, msg]);
      } catch {
        // ignore
      }
    });
    es.onerror = () => setLive(false);

    return () => {
      es.close();
      setLive(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  useEffect(() => {
    if (live) return;
    const timer = setInterval(async () => {
      const last = messages[messages.length - 1]?.created_at;
      if (!last) return;
      try {
        const res = await fetch(
          `/api/groups/${groupId}/messages?after=${encodeURIComponent(last)}`
        );
        if (!res.ok) return;
        const data = (await res.json()) as ChatMessage[];
        if (!Array.isArray(data) || data.length === 0) return;
        setMessages((prev) => {
          const next = [...prev];
          for (const msg of data) {
            if (!idsRef.current.has(msg.id)) {
              idsRef.current.add(msg.id);
              next.push(msg);
            }
          }
          return next;
        });
      } catch {
        // ignore
      }
    }, 8000);
    return () => clearInterval(timer);
  }, [live, groupId, messages]);

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

  function onSubmit(formData: FormData) {
    setError(null);
    files.forEach((f) => formData.append("files", f));
    startTransition(async () => {
      const result: ActionResult = await sendGroupMessageAction(null, formData);
      if (!result.success) {
        setError(result.error ?? "Failed to send");
        return;
      }
      if (
        result.data &&
        typeof result.data === "object" &&
        "id" in result.data
      ) {
        const msg = result.data as ChatMessage;
        if (!idsRef.current.has(msg.id)) {
          idsRef.current.add(msg.id);
          setMessages((prev) => [...prev, msg]);
        }
      }
      formRef.current?.reset();
      setFiles([]);
      if (fileRef.current) fileRef.current.value = "";
    });
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
    <div className="animate-rise flex h-[min(74vh,760px)] min-h-[540px] flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_24px_60px_-30px_rgba(15,23,42,0.5)] ring-1 ring-black/[0.03]">
      <header className="relative z-10 flex items-center justify-between gap-3 border-b border-border/60 bg-gradient-to-r from-card via-card to-brand-soft/30 px-4 py-3.5 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-brand text-white shadow-[0_8px_20px_-8px_var(--brand)]">
            <MessagesSquare className="h-5 w-5" />
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-emerald-500 animate-live-dot" />
          </div>
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
            <p className="text-[11px] text-muted">
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
                        {(m.attachments ?? []).map((a) => {
                          const href = `/api/files/${a.file_path}`;
                          const img = isImage(a.mime_type, a.file_name);
                          if (img) {
                            return (
                              <a
                                key={a.file_path}
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
                              key={a.file_path}
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
              className="h-9 w-9 rounded-xl text-muted hover:bg-brand/10 hover:text-brand"
              onClick={() => fileRef.current?.click()}
              title="Attach photo"
            >
              <ImageIcon className="h-4 w-4" />
            </Button>
          </div>
          <Textarea
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
