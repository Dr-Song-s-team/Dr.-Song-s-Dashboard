"use client";

import { useState, useEffect, useRef, useCallback, FormEvent, KeyboardEvent } from "react";

// Types matching the API
type ChatSession = {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
};

// ChatMessage type commented out - currently using simpler inline type
// type ChatMessage = {
//   id: string;
//   role: "user" | "assistant";
//   content: string;
//   createdAt: string;
// };

type SendMessageResponse = {
  success: boolean;
  sessionId: string;
  answer: string;
  retrievedCounts: {
    emails: number;
    patients: number;
    documents: number;
  };
  error?: string;
};

type OptimisticMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  optimistic?: boolean;
  error?: string;
  retrievedCounts?: {
    emails: number;
    patients: number;
    documents: number;
  };
};

const SUGGESTED_PROMPTS = [
  "What emails need action?",
  "Summarize recent claims emails",
  "Show me patient authorizations expiring soon",
];

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<"list" | "conversation">("list");
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<OptimisticMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to newest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load sessions when opening
  useEffect(() => {
    if (isOpen && view === "list") {
      loadSessions();
    }
  }, [isOpen, view]);

  // Load messages when switching to conversation view
  useEffect(() => {
    if (view === "conversation" && currentSessionId) {
      loadMessages(currentSessionId);
    }
  }, [view, currentSessionId]);

  const loadSessions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/chat");
      if (!res.ok) throw new Error("Failed to load sessions");
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (err) {
      console.error("Failed to load sessions:", err);
      setError("Failed to load chat sessions");
    } finally {
      setIsLoading(false);
    }
  };

  const loadMessages = async (sessionId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/chat?sessionId=${sessionId}`);
      if (!res.ok) throw new Error("Failed to load messages");
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (err) {
      console.error("Failed to load messages:", err);
      setError("Failed to load conversation");
    } finally {
      setIsLoading(false);
    }
  };

  const startNewChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
    setView("conversation");
    setError(null);
  };

  const openSession = (sessionId: string) => {
    setCurrentSessionId(sessionId);
    setView("conversation");
    setError(null);
  };

  const backToList = () => {
    setView("list");
    setCurrentSessionId(null);
    setMessages([]);
    setError(null);
  };

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isSending) return;

    const trimmedContent = content.trim();
    setInputValue("");
    setIsSending(true);
    setError(null);

    // Optimistic user message
    const optimisticId = `temp-${Date.now()}`;
    const optimisticMessage: OptimisticMessage = {
      id: optimisticId,
      role: "user",
      content: trimmedContent,
      createdAt: new Date().toISOString(),
      optimistic: true,
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    // Create abort controller for timeout
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, 30000);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: currentSessionId,
          message: trimmedContent,
        }),
        signal: abortController.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));

        if (res.status === 429 || data.error === "rate_limited") {
          throw new Error("AI is busy, try again in a moment");
        }

        throw new Error(data.error || "Failed to send message");
      }

      const data: SendMessageResponse = await res.json();

      // Remove optimistic message, add real ones
      setMessages((prev) => {
        const withoutOptimistic = prev.filter((m) => m.id !== optimisticId);
        return [
          ...withoutOptimistic,
          {
            id: `user-${Date.now()}`,
            role: "user" as const,
            content: trimmedContent,
            createdAt: new Date().toISOString(),
          },
          {
            id: `assistant-${Date.now()}`,
            role: "assistant" as const,
            content: data.answer,
            createdAt: new Date().toISOString(),
            retrievedCounts: data.retrievedCounts,
          },
        ];
      });

      // Update session ID if it's a new chat
      if (!currentSessionId && data.sessionId) {
        setCurrentSessionId(data.sessionId);
      }
    } catch (err) {
      clearTimeout(timeoutId);

      // Remove optimistic message and show error
      setMessages((prev) => {
        const withoutOptimistic = prev.filter((m) => m.id !== optimisticId);
        return [
          ...withoutOptimistic,
          {
            id: optimisticId,
            role: "user" as const,
            content: trimmedContent,
            createdAt: new Date().toISOString(),
            error: err instanceof Error ? err.message : "Failed to send message",
          },
        ];
      });

      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setIsSending(false);
      abortControllerRef.current = null;
    }
  }, [currentSessionId, isSending]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    sendMessage(inputValue);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue);
    }
  };

  const retryMessage = (messageContent: string) => {
    setMessages((prev) => prev.filter((m) => m.content !== messageContent || !m.error));
    sendMessage(messageContent);
  };

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-[#2f7694] to-[#17465f] text-[#fffaf2] shadow-lg transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f7694]"
          aria-label="Open chat"
        >
          <ChatIcon className="size-6" />
        </button>
      )}

      {/* Slide-out panel */}
      {isOpen && (
        <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-[#d8c6b5]/30 bg-[#fffaf2] shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#d8c6b5]/30 bg-gradient-to-br from-[#2f7694] to-[#17465f] p-4 text-[#fffaf2]">
            <div className="flex items-center gap-3">
              <ChatIcon className="size-6" />
              <h2 className="text-lg font-semibold">
                {view === "list" ? "AI Assistant" : "Chat"}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {view === "conversation" && (
                <button
                  type="button"
                  onClick={backToList}
                  className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm transition hover:bg-white/20"
                >
                  ← Back
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg border border-white/20 bg-white/10 p-2 transition hover:bg-white/20"
                aria-label="Close chat"
              >
                <CloseIcon className="size-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {view === "list" && (
              <div className="p-4">
                <button
                  type="button"
                  onClick={startNewChat}
                  className="mb-4 w-full rounded-xl border border-[#9b6a4b]/30 bg-gradient-to-br from-[#2f7694]/10 to-[#17465f]/10 px-4 py-3 text-left font-medium text-[#513a2e] transition hover:from-[#2f7694]/20 hover:to-[#17465f]/20"
                >
                  + New chat
                </button>

                {isLoading && (
                  <div className="text-center text-sm text-[#9b8070]">
                    Loading sessions...
                  </div>
                )}

                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    {error}
                  </div>
                )}

                {!isLoading && sessions.length === 0 && (
                  <div className="text-center text-sm text-[#9b8070]">
                    No previous conversations
                  </div>
                )}

                <div className="space-y-2">
                  {sessions.map((session) => (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => openSession(session.id)}
                      className="w-full rounded-xl border border-[#d8c6b5]/30 bg-white p-3 text-left transition hover:border-[#9b6a4b]/40 hover:bg-[#fffaf2]"
                    >
                      <div className="truncate font-medium text-[#513a2e]">
                        {session.title || "Untitled conversation"}
                      </div>
                      <div className="mt-1 text-xs text-[#9b8070]">
                        {new Date(session.createdAt).toLocaleDateString()}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {view === "conversation" && (
              <div className="flex h-full flex-col">
                <div className="flex-1 space-y-4 overflow-y-auto p-4">
                  {messages.length === 0 && !isLoading && (
                    <div className="space-y-3">
                      <p className="text-sm text-[#9b8070]">
                        Ask me about clinic data:
                      </p>
                      {SUGGESTED_PROMPTS.map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => sendMessage(prompt)}
                          disabled={isSending}
                          className="w-full rounded-xl border border-[#d8c6b5]/40 bg-white p-3 text-left text-sm text-[#513a2e] transition hover:border-[#9b6a4b]/40 hover:bg-[#fffaf2] disabled:opacity-50"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  )}

                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-xl px-4 py-3 ${
                          msg.role === "user"
                            ? msg.error
                              ? "border border-red-300 bg-red-50 text-red-900"
                              : "bg-gradient-to-br from-[#2f7694] to-[#17465f] text-[#fffaf2]"
                            : "border border-[#d8c6b5]/30 bg-white text-[#513a2e]"
                        }`}
                      >
                        <div className="whitespace-pre-wrap break-words text-sm">
                          {msg.content}
                        </div>

                        {msg.error && (
                          <div className="mt-2 space-y-2">
                            <div className="text-xs text-red-700">
                              Error: {msg.error}
                            </div>
                            <button
                              type="button"
                              onClick={() => retryMessage(msg.content)}
                              className="text-xs font-medium text-red-800 underline hover:no-underline"
                            >
                              Retry
                            </button>
                          </div>
                        )}

                        {msg.role === "assistant" && msg.retrievedCounts && (
                          <div className="mt-2 space-y-1 border-t border-[#d8c6b5]/20 pt-2">
                            <div className="text-xs italic text-[#9b8070]">
                              AI answers — verify before acting
                            </div>
                            <div className="text-xs text-[#9b8070]">
                              Searched: {msg.retrievedCounts.emails} emails,{" "}
                              {msg.retrievedCounts.patients} patients,{" "}
                              {msg.retrievedCounts.documents} documents
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {isSending && (
                    <div className="flex justify-start">
                      <div className="rounded-xl border border-[#d8c6b5]/30 bg-white px-4 py-3">
                        <div className="flex items-center gap-1 text-[#9b8070]">
                          <span className="text-sm">Thinking</span>
                          <span className="animate-pulse">.</span>
                          <span className="animate-pulse delay-100">.</span>
                          <span className="animate-pulse delay-200">.</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Input area */}
                <form
                  onSubmit={handleSubmit}
                  className="border-t border-[#d8c6b5]/30 bg-white p-4"
                >
                  {error && (
                    <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-800">
                      {error}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <textarea
                      ref={textareaRef}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Ask about emails, patients, documents..."
                      className="flex-1 resize-none rounded-xl border border-[#d8c6b5]/40 bg-[#fffaf2] px-4 py-3 text-sm text-[#513a2e] placeholder:text-[#9b8070] focus:border-[#9b6a4b]/60 focus:outline-none focus:ring-2 focus:ring-[#9b6a4b]/20"
                      rows={2}
                    />
                    <button
                      type="submit"
                      disabled={!inputValue.trim() || isSending}
                      className="self-end rounded-xl bg-gradient-to-br from-[#2f7694] to-[#17465f] px-4 py-3 text-[#fffaf2] transition hover:from-[#2f7694]/90 hover:to-[#17465f]/90 disabled:opacity-50"
                      aria-label="Send message"
                    >
                      <SendIcon className="size-5" />
                    </button>
                  </div>

                  <div className="mt-2 text-xs text-[#9b8070]">
                    Press Enter to send, Shift+Enter for new line
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
