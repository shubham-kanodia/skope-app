"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const STORAGE_KEY = "skope_assistant_chat";

const STARTERS = [
  "Am I ready for an audit?",
  "What must my privacy notice contain?",
  "How fast must I answer an erasure request?",
  "Do I need parental consent for under-18 users?",
];

// Hydration-safe "is this the client" flag: false during SSR/hydration, true
// right after, so the inner chat can read sessionStorage in its initializer.
const noopSubscribe = () => () => {};
function useIsClient(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

export function AssistantChat() {
  const isClient = useIsClient();
  if (!isClient) {
    return <div className="min-h-[24rem] flex-1 rounded-2xl border border-hairline" />;
  }
  return <ChatInner />;
}

function readStoredMessages(): Message[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Message[]) : [];
  } catch {
    return []; // corrupt storage: start fresh
  }
}

function ChatInner() {
  // Conversations live in this tab only — nothing is stored server-side.
  const [messages, setMessages] = useState<Message[]>(readStoredMessages);
  const [input, setInput] = useState("");
  const [state, setState] = useState<"idle" | "streaming" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // Storage full or unavailable; the chat still works.
    }
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  async function send(question: string) {
    const q = question.trim();
    if (!q || state === "streaming") return;
    setError(null);
    setInput("");
    const history = [...messages, { role: "user" as const, content: q }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setState("streaming");

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/dashboard/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.slice(-12) }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setMessages(history); // drop the empty assistant bubble
        setError(data.error ?? "Something went wrong. Try again.");
        setState("error");
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          next[next.length - 1] = { ...last, content: last.content + chunk };
          return next;
        });
      }
      setState("idle");
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setState("idle"); // keep whatever streamed before the stop
      } else {
        setMessages(history);
        setError("Lost the connection. Try again.");
        setState("error");
      }
    } finally {
      abortRef.current = null;
    }
  }

  function clear() {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    setState("idle");
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-hairline">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
        {messages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted">A few things people ask:</p>
            <div className="flex flex-wrap gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-full border border-hairline px-3.5 py-2 text-sm text-body transition-colors hover:border-primary hover:text-primary"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => <Bubble key={i} message={m} streaming={state === "streaming" && i === messages.length - 1} />)
        )}
        {error && <p className="text-sm text-ink">{error}</p>}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 border-t border-hairline p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about DPDP or your setup"
          className="min-w-0 flex-1 rounded-xl border border-hairline bg-canvas px-4 py-2.5 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        {state === "streaming" ? (
          <button
            type="button"
            onClick={() => abortRef.current?.abort()}
            className="rounded-full border border-hairline px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-surface-strong"
          >
            Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-active disabled:opacity-60"
          >
            Send
          </button>
        )}
        {messages.length > 0 && (
          <button
            type="button"
            onClick={clear}
            className="whitespace-nowrap text-sm text-muted transition-colors hover:text-ink"
          >
            Clear
          </button>
        )}
      </form>
    </div>
  );
}

function Bubble({ message, streaming }: { message: Message; streaming: boolean }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary/10 px-4 py-2.5 text-sm text-ink">
          {message.content}
        </div>
      </div>
    );
  }
  return (
    <div className="max-w-[85%] text-sm text-body">
      {message.content ? (
        <AssistantText text={message.content} />
      ) : streaming ? (
        <span className="text-muted">Thinking…</span>
      ) : null}
    </div>
  );
}

/**
 * Tiny renderer for the assistant's plain-text style: paragraphs, "- " lists,
 * and **bold**. Deliberately not a markdown library.
 */
function AssistantText({ text }: { text: string }) {
  const blocks = text.split(/\n\s*\n/).filter((b) => b.trim());
  return (
    <div className="space-y-2.5 leading-relaxed">
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        const isList = lines.every((l) => l.trim().startsWith("- ") || !l.trim());
        if (isList) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {lines
                .filter((l) => l.trim())
                .map((l, j) => (
                  <li key={j}>{bold(l.trim().slice(2))}</li>
                ))}
            </ul>
          );
        }
        return <p key={i}>{bold(block)}</p>;
      })}
    </div>
  );
}

function bold(text: string): React.ReactNode {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  if (parts.length === 1) return text;
  return parts.map((p, i) => (i % 2 === 1 ? <strong key={i} className="text-ink">{p}</strong> : p));
}
