sequenceDiagram
    actor Usuario as Usuário
    participant Web as Frontend React
    participant API as API Fastify
    participant Redis as Redis
    participant App as Camada de Aplicação
    participant LLM as Adaptador LLM Ollama
    participant Policy as Motor de Política
    participant Provider as Provider Looker
    participant Looker as Iframe Looker Studio

    Usuario->>Web: Digita mensagem em linguagem natural
    Web->>API: POST /mensagem<br/>mensagem + contexto + x-conversation-id
    API->>Redis: Recupera histórico da conversa
    Redis-->>API: Histórico recente
    API->>App: Resolve ação de dashboard

    App->>LLM: Classifica solicitação
    LLM-->>App: Estado da requisição

    alt Solicitação vaga ou orientação inicial
        App-->>API: Ação de explicação
    else Solicitação com possibilidade de ação
        App->>LLM: Extrai tipo de informação e filtros
        LLM-->>App: Dados estruturados
        App->>Policy: Normaliza filtros e aplica regras
        Policy-->>App: Intenção normalizada
        App->>Provider: Gera ação para o dashboard
        Provider-->>App: Ação de dashboard
        App-->>API: Ação final validada
    end

    API->>Redis: Persiste resumo da interação
    API-->>Web: Retorna ação e rationale
    Web->>Looker: Atualiza iframe, quando aplicável
    Web-->>Usuario: Exibe resposta final
