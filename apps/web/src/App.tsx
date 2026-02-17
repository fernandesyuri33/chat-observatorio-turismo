import { useState } from "react";
import {
  ResolveDashboardRequestSchema,
  ResolveDashboardResponseSchema,
  type DashboardAction,
  type ResolveDashboardRequest,
  type ResolveDashboardResponse,
} from "@conversational/domain";

// ── Inline simple UI components (previously from @conversational/ui) ──

function ChatHistory({ messages }: { messages: { id: string; role: "user" | "assistant"; content: string }[] }) {
  return (
    <div className="chat-history">
      {messages.map((m) => (
        <div key={m.id} className={`chat-bubble chat-bubble--${m.role}`}>
          {m.content}
        </div>
      ))}
    </div>
  );
}

function SuggestionChips({ suggestions, onSelect }: { suggestions: string[]; onSelect: (s: string) => void }) {
  return (
    <div className="suggestion-chips">
      {suggestions.map((s) => (
        <button key={s} type="button" className="chip" onClick={() => onSelect(s)}>
          {s}
        </button>
      ))}
    </div>
  );
}

function ActionPanel({ lastAction }: { lastAction?: DashboardAction }) {
  if (!lastAction) return <p className="muted">Nenhuma acao aplicada ainda.</p>;
  return (
    <div className="action-panel">
      <strong>Ultima acao:</strong> <code>{lastAction.type}</code>
      <pre>{JSON.stringify(lastAction, null, 2)}</pre>
    </div>
  );
}

// ── Constants ───────────────────────────────────────────────────

const DEFAULT_SUGGESTIONS = [
  "Quero visitas em Sao Paulo em 2024",
  "Mostre ocupacao em Salvador em 2023",
  "Me ajude",
  "O que significa indicador eventos?"
];

const apiUrl = import.meta.env["VITE_API_URL"] ?? "http://localhost:3001";
const baseEmbedUrl =
  import.meta.env["VITE_LOOKER_EMBED_URL"] ??
  "https://lookerstudio.google.com/embed/reporting/placeholder/page/p_1";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
};

export function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "welcome", role: "assistant" as const, content: "Como posso ajudar?" }
  ]);
  const [input, setInput] = useState("");
  const [lastAction, setLastAction] = useState<DashboardAction | undefined>(undefined);

  // Derive iframe URL from the last open_url action, or use the base embed URL
  const iframeUrl =
    lastAction?.type === "open_url" ? lastAction.url : baseEmbedUrl;

  async function handleSubmit(message: string) {
    const trimmed = message.trim();
    if (!trimmed) return;

    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: trimmed }
    ]);
    setInput("");

    const payload: ResolveDashboardRequest =
      ResolveDashboardRequestSchema.parse({ message: trimmed });

    const response = await fetch(`${apiUrl}/dashboard/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Nao consegui interpretar. Tente novamente."
        }
      ]);
      return;
    }

    const raw = await response.json();
    const data: ResolveDashboardResponse = ResolveDashboardResponseSchema.parse(raw);
    setLastAction(data.action);

    // Build assistant text based on the new DashboardAction types
    let assistantText: string;
    switch (data.action.type) {
      case "open_url":
        assistantText = data.action.title ?? `Abrindo: ${data.action.url}`;
        break;
      case "apply_filters":
        assistantText = `Filtros aplicados: ${JSON.stringify(data.action.filters)}`;
        break;
      case "run_query":
        assistantText = `Executando: ${data.action.function}`;
        break;
      case "explain_only":
        assistantText = data.action.message;
        break;
    }

    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "assistant", content: assistantText }
    ]);
  }

  return (
    <div className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">Conversational Looker Studio</p>
          <h1>Dashboard conversacional</h1>
          <p>
            Controle filtros do Looker Studio usando linguagem natural e veja a explicacao das
            acoes aplicadas.
          </p>
        </div>
      </header>

      <main className="layout">
        <section className="chat-panel">
          <ChatHistory messages={messages} />
          <SuggestionChips suggestions={DEFAULT_SUGGESTIONS} onSelect={handleSubmit} />
          <form
            className="chat-input"
            onSubmit={(event) => {
              event.preventDefault();
              handleSubmit(input);
            }}
          >
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Digite um pedido..."
            />
            <button type="submit">Enviar</button>
          </form>
        </section>

        <section className="dashboard-panel">
          <ActionPanel lastAction={lastAction} />
          <div className="iframe-wrapper">
            <iframe title="Looker Studio" src={iframeUrl} />
          </div>
        </section>
      </main>
    </div>
  );
}
