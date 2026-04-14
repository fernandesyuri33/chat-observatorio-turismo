import { useEffect, useRef, useState, type RefObject } from "react";
import {
  PostMensagemRequestSchema,
  PostMensagemResponseSchema,
  type ResolveDashboardRequest,
  type ResolveDashboardResponse,
} from "@conversational/contracts";

function ChatHistory({
  messages,
  historyRef
}: {
  messages: { id: string; role: "user" | "assistant"; content: string }[];
  historyRef: RefObject<HTMLDivElement>;
}) {
  return (
    <div ref={historyRef} className="chat-history">
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

function ActionPanel({
  lastAction,
  rationale,
}: {
  lastAction?: ResolveDashboardResponse["action"];
  rationale?: ResolveDashboardResponse["rationale"];
}) {
  if (!lastAction) return <p className="muted">Nenhuma acao aplicada ainda.</p>;
  return (
    <div className="action-panel">
      {rationale && (rationale.stage1 || rationale.stage2) && (
        <div className="rationale-section">
          <strong>Raciocínio da IA:</strong>
          {rationale.stage1 && (
            <div className="rationale-stage">
              <p className="rationale-title">Etapa 1 — Classificação</p>
              {rationale.stage1.classification && (
                <p><strong>Resultado:</strong> <code>{rationale.stage1.classification}</code></p>
              )}
              {rationale.stage1.confidence != null && (
                <p><strong>Confiança:</strong> {(rationale.stage1.confidence * 100).toFixed(0)}%</p>
              )}
              {rationale.stage1.rationale && (
                <p><strong>Raciocínio:</strong> {rationale.stage1.rationale}</p>
              )}
            </div>
          )}
          {rationale.stage2 && (
            <div className="rationale-stage">
              <p className="rationale-title">Etapa 2 — Extração</p>
              {rationale.stage2.informationType && (
                <p><strong>Tipo de informação:</strong> <code>{rationale.stage2.informationType}</code></p>
              )}
              {rationale.stage2.filters && Object.keys(rationale.stage2.filters).length > 0 && (
                <p><strong>Filtros:</strong> <code>{JSON.stringify(rationale.stage2.filters)}</code></p>
              )}
              {rationale.stage2.confidence != null && (
                <p><strong>Confiança:</strong> {(rationale.stage2.confidence * 100).toFixed(0)}%</p>
              )}
              {rationale.stage2.rationale && (
                <p><strong>Raciocínio:</strong> {rationale.stage2.rationale}</p>
              )}
            </div>
          )}
        </div>
      )}
      <strong>Ultima acao:</strong> <code>{lastAction.type}</code>
      <pre>{JSON.stringify(lastAction, null, 2)}</pre>
    </div>
  );
}

const DEFAULT_SUGGESTIONS = ["O que posso descobrir aqui?"];

const apiUrl = import.meta.env["VITE_API_URL"] ?? "http://localhost:3001";
const baseEmbedUrl =
  import.meta.env["VITE_LOOKER_EMBED_URL"] ??
  "https://lookerstudio.google.com/embed/reporting/b4daa6c1-6dae-4006-b4a1-49547a31a856/page/p_3niel4jewd";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
};

const CONVERSATION_ID_STORAGE_KEY = "conversationId";

function getOrCreateConversationId(): string {
  const stored = localStorage.getItem(CONVERSATION_ID_STORAGE_KEY);
  if (stored && stored.trim().length > 0) {
    return stored;
  }

  const created = crypto.randomUUID();
  localStorage.setItem(CONVERSATION_ID_STORAGE_KEY, created);
  return created;
}

export function App() {
  const chatHistoryRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "welcome", role: "assistant" as const, content: "Como posso ajudar?" }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>(DEFAULT_SUGGESTIONS);
  const [lastAction, setLastAction] = useState<ResolveDashboardResponse["action"] | undefined>(undefined);
  const [lastRationale, setLastRationale] = useState<ResolveDashboardResponse["rationale"] | undefined>(undefined);
  const [embedUrl, setEmbedUrl] = useState(baseEmbedUrl);
  const [conversationId] = useState<string>(() => getOrCreateConversationId());

  useEffect(() => {
    const history = chatHistoryRef.current;
    if (!history) return;

    history.scrollTo({
      top: history.scrollHeight,
      behavior: "smooth"
    });
  }, [messages]);

  async function handleSubmit(message: string) {
    const trimmed = message.trim();
    if (!trimmed || isLoading) return;

    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: trimmed }
    ]);
    setInput("");
    setIsLoading(true);

    try {
      const payload: ResolveDashboardRequest =
        PostMensagemRequestSchema.parse({ message: trimmed });

      const response = await fetch(`${apiUrl}/mensagem`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-conversation-id": conversationId,
        },
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
      const data: ResolveDashboardResponse = PostMensagemResponseSchema.parse(raw);
      setLastAction(data.action);
      setLastRationale(data.rationale);

      if (data.action.type === "open_url") {
        setEmbedUrl(data.action.url);
      }

      if (
        data.action.type === "explain_only" ||
        data.action.type === "ask_missing_information"
      ) {
        setSuggestions(data.action.suggestions);
      }

      let assistantText: string;
      switch (data.action.type) {
        case "open_url":
          assistantText = data.action.message ?? data.action.title ?? `Abrindo: ${data.action.url}`;
          break;
        case "apply_filters":
          assistantText = data.action.message ?? `Filtros aplicados: ${JSON.stringify(data.action.filters)}`;
          break;
        case "run_query":
          assistantText = data.action.message ?? `Executando: ${data.action.function}`;
          break;
        case "explain_only":
          assistantText = data.action.message;
          break;
        case "ask_missing_information":
          assistantText = data.action.message;
          break;
      }

      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: assistantText }
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Nao consegui interpretar. Tente novamente."
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">Looker Studio Conversacional</p>
          <h1>Dashboard conversacional</h1>
          <p>
            Controle filtros do Looker Studio usando linguagem natural e veja a explicacao das
            acoes aplicadas.
          </p>
        </div>
      </header>

      <main className="layout">
        <section className="chat-panel">
          <ChatHistory messages={messages} historyRef={chatHistoryRef} />
          <SuggestionChips suggestions={suggestions} onSelect={handleSubmit} />
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
              disabled={isLoading}
            />
            <button type="submit" disabled={isLoading}>
              {isLoading ? "Enviando..." : "Enviar"}
            </button>
          </form>
        </section>

        <section className="dashboard-panel">
          <div className="iframe-wrapper">
            <iframe title="Looker Studio" src={embedUrl} />
          </div>
          <ActionPanel lastAction={lastAction} rationale={lastRationale} />
        </section>
      </main>
    </div>
  );
}
