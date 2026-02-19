# 🏗️ Arquitetura

---

## 📐 Visão Geral da Arquitetura

```mermaid
flowchart TD

A[Frontend] -->|POST /dashboard/resolve| B[apps/api - Fastify Route]

B -->|Valida Request (Zod)| C[ResolveDashboardActionUseCase]

C --> D[Schema Registry]
C --> E[LLM Adapter]
C --> F[Policy Engine]
C --> G[Active Provider]

E -->|Raw Intent| C
D -->|Intent Schema v1| C
F -->|Normalized Intent| C
G -->|DashboardAction| C

C -->|Valida DashboardAction (Zod)| H[HTTP Response 200]

H --> A
```

---

# 🔄 Fluxo Detalhado da Requisição

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant API as Fastify Route
    participant UC as Use Case
    participant LLM as LLM Adapter
    participant POL as Policy Engine
    participant PROV as Active Provider

    U->>FE: "ocupação por bairro em 2024"
    FE->>API: POST /dashboard/resolve

    API->>API: Valida Request (Zod)
    API->>UC: resolveDashboardAction()

    UC->>UC: Seleciona Intent Schema (v1)
    UC->>LLM: generateStructured(schema, message)

    LLM-->>UC: Intent estruturado

    UC->>POL: normalizeIntent(intent)
    POL-->>UC: Intent normalizado

    UC->>UC: Confidence Gate

    UC->>PROV: generate(intent)
    PROV-->>UC: DashboardAction

    UC->>UC: Valida DashboardAction (Zod)
    UC-->>API: action

    API-->>FE: 200 { action }
```

---

# 🧠 Separação de Responsabilidades

```mermaid
flowchart LR

subgraph HTTP Layer
A[apps/api]
end

subgraph Application Layer
B[Use Case]
end

subgraph Domain Layer
C[Intent Schema]
D[DashboardAction Schema]
end

subgraph Infrastructure
E[LLM Adapter]
F[Policy Engine]
G[Active Provider]
end

A --> B
B --> C
B --> D
B --> E
B --> F
B --> G
```

---

# 🔁 Transformação Central (Intent → Action)

```mermaid
flowchart TD

A[User Message]
   --> B[LLM]
   --> C[Intent]

C --> D[Policy Normalization]
D --> E[Confidence Gate]
E --> F[Active Provider]
F --> G[DashboardAction]
```

---

# 🎛️ Progressive Hardening (Modo da Policy)

```mermaid
flowchart LR

A[free]
   -->|menos restrições| B[guided]
   -->|exige métricas válidas| C[strict]
```

---

# 🔌 Troca de Provider (sem mudar o domínio)

```mermaid
flowchart TD

Intent --> ProviderA[LookerProvider]
Intent --> ProviderB[CustomDashboardProvider]

ProviderA -->|open_url| Action
ProviderB -->|run_query| Action
```

⚠️ Apenas **um provider ativo por vez**, selecionado por config:

```
ACTIVE_PROVIDER=looker
```

ou

```
ACTIVE_PROVIDER=customDashboard
```

---

# 🛡️ Validação em Todas as Fronteiras

```mermaid
flowchart TD

Request -->|Zod| ValidRequest
ValidRequest -->|LLM| RawIntent
RawIntent -->|Zod| Intent
Intent -->|Provider| Action
Action -->|Zod| ValidAction
ValidAction --> Response
```

---

# 🧭 Mapa Mental Resumido

```mermaid
mindmap
  root((Conversational Dashboard Resolver))
    HTTP Layer
      Fastify Route
      Request Validation
      Response Validation
    Application
      Use Case
      Fallback Chain
      Confidence Gate
    Domain
      Intent Schema
      DashboardAction Schema
    Policy
      free/guided/strict
      minConfidence
      Synonyms
    LLM
      Structured Output
      Versioned Schema
    Provider
      Looker
      Custom
      Future Providers
```

---

# 🎯 Conceito Central da Arquitetura

> O LLM sugere a intenção.
> A Policy controla o rigor.
> O Provider materializa a ação.
> O Domain garante o contrato.
