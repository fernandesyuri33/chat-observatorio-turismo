import { useMemo, useState } from "react";
import type { Action, Filters } from "@conversational/contracts";
import { buildLookerStudioUrl } from "@conversational/url-builder";
import { AppliedFiltersPanel, ChatHistory, SuggestionChips } from "@conversational/ui";

const DEFAULT_SUGGESTIONS = [
  "Quero visitas em Sao Paulo em 2024",
  "Mostre ocupacao em Salvador em 2023",
  "Resetar filtros",
  "O que significa indicador eventos?"
];

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3001";
const baseEmbedUrl =
  import.meta.env.VITE_LOOKER_EMBED_URL ??
  "https://lookerstudio.google.com/embed/reporting/placeholder/page/p_1";

type ApiResponse = {
  action: Action;
  assistantText?: string;
};

export function App() {
  const [messages, setMessages] = useState([
    { id: "welcome", role: "assistant" as const, content: "Como posso ajudar?" }
  ]);
  const [input, setInput] = useState("");
  const [filters, setFilters] = useState<Filters>({});
  const [lastAction, setLastAction] = useState<Action | undefined>(undefined);

  const iframeUrl = useMemo(() => buildLookerStudioUrl(baseEmbedUrl, filters), [filters]);

  async function handleSubmit(message: string) {
    const trimmed = message.trim();
    if (!trimmed) return;

    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: trimmed }
    ]);
    setInput("");

    const response = await fetch(`${apiUrl}/interpret`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: trimmed, currentFilters: filters })
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

    const data = (await response.json()) as ApiResponse;
    setLastAction(data.action);

    if (data.action.type === "set_filters") {
      setFilters((prev) => ({ ...prev, ...data.action.filters }));
    }

    if (data.action.type === "reset_filters") {
      setFilters({});
    }

    const assistantText =
      data.assistantText ??
      (data.action.type === "describe_metric"
        ? `Indicador selecionado: ${data.action.indicador}`
        : data.action.type === "unknown"
        ? data.action.reason
        : "Filtros atualizados.");

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
          <AppliedFiltersPanel filters={filters} lastAction={lastAction} />
          <div className="iframe-wrapper">
            <iframe title="Looker Studio" src={iframeUrl} />
          </div>
        </section>
      </main>
    </div>
  );
}
