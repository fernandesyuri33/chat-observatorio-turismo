flowchart LR
    U[Usuário] --> W[Frontend React + Vite]

    W -->|POST /mensagem| API[API Fastify]

    API --> HIST[Serviço de Histórico]
    HIST <--> REDIS[(Redis)]

    API --> APP[Camada de Aplicação<br/>Resolução da Ação]

    APP --> PORTA[Porta LLM]
    PORTA --> OLLAMA[Adaptador LLM Ollama]

    APP --> POLICY[Motor de Política<br/>Normalização e Regras]
    APP --> PROVIDER[Provider Ativo]

    PROVIDER --> LOOKER[Provider Looker]
    LOOKER --> ACTION[Ação de Dashboard]

    ACTION --> API
    API -->|Resposta validada| W

    W -->|Atualiza iframe| DASH[Dashboard Looker Studio]
    W -->|Exibe resposta| U
