# 🏗️ Arquitetura

---

## 📐 Visão Geral da Arquitetura

```mermaid
flowchart TD
  FE[Frontend] -->|POST /dashboard/resolve| API[apps/api Fastify route]

  API -->|Validate request with Zod| UC[ResolveDashboardActionUseCase]

  UC --> REG[Schema registry]
  UC --> LLM[LLM adapter]
  UC --> POL[Policy engine]
  UC --> PROV[Active provider]

  LLM -->|Raw intent| UC
  REG -->|Intent schema v1| UC
  POL -->|Normalized intent| UC
  PROV -->|DashboardAction| UC

  UC -->|Validate action with Zod| RES[HTTP response 200]
  RES --> FE

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

# 🎛️ Policy (estrita por padrão)

```mermaid
flowchart LR

A[Synonyms]
  --> B[Canonical filters permitidos]
  --> C[Mapeamento de informationType]
  --> D[Remove unknown keys]
```

---

# 🔌 Troca de Provider (sem mudar o domínio)

```mermaid
flowchart TD

Intent --> ProviderA[LookerProvider]
Intent --> ProviderB[CustomProvider]

ProviderA -->|open_url| Action
ProviderB -->|run_query| Action
```

⚠️ Apenas **um provider ativo por vez**, selecionado no `policy.json` pela chave `activeProvider`:

```
"activeProvider": "looker"
```

ou

```
"activeProvider": "custom"
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
flowchart LR
  ROOT[Conversational Dashboard Resolver]

  ROOT --> API[apps/api]
  ROOT --> APP[libs/application]
  ROOT --> DOM[libs/domain]
  ROOT --> POL[libs/policy]
  ROOT --> LLM[libs/llm]
  ROOT --> PROV[libs/providers]

  API --> API1[Fastify routes]
  API --> API2[CORS e validação de contrato]
  API --> API3[Wiring de DI]

  APP --> APP1[Use case orchestration]
  APP --> APP2[Fallback chain]
  APP --> APP3[Confidence gate]

  DOM --> DOM1[Intent types]
  DOM --> DOM2[DashboardAction contract]
  DOM --> DOM3[Zod schemas]

  POL --> POL1[Config JSON]
  POL --> POL2[Synonyms para filtros e informationType]
  POL --> POL3[Strict filter normalization]

  LLM --> LLM1[Structured output]
  LLM --> LLM2[Schema versioning]

  PROV --> PR1[Looker provider]
  PROV --> PR2[Provider alternativo]

  classDef root fill:#111827,stroke:#111827,color:#ffffff;
  classDef api fill:#e0f2fe,stroke:#0284c7,color:#0c4a6e;
  classDef app fill:#ecfccb,stroke:#65a30d,color:#365314;
  classDef dom fill:#fae8ff,stroke:#a21caf,color:#701a75;
  classDef pol fill:#ffedd5,stroke:#ea580c,color:#7c2d12;
  classDef llm fill:#fee2e2,stroke:#dc2626,color:#7f1d1d;
  classDef prov fill:#ede9fe,stroke:#7c3aed,color:#4c1d95;

  class ROOT root;
  class API,API1,API2,API3 api;
  class APP,APP1,APP2,APP3 app;
  class DOM,DOM1,DOM2,DOM3 dom;
  class POL,POL1,POL2,POL3 pol;
  class LLM,LLM1,LLM2 llm;
  class PROV,PR1,PR2 prov;

```

---

# 🎯 Conceito Central da Arquitetura

> O LLM sugere a intenção.
> A Policy normaliza de forma estrita.
> O Provider materializa a ação.
> O Domain garante o contrato.
