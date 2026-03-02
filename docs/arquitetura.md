# Arquitetura

---

## Visão Geral da Arquitetura

```mermaid
flowchart TD
  FE[Frontend] -->|POST /dashboard/resolve| API[apps/api rota Fastify]

  API -->|Valida requisição com Zod| UC[ResolveDashboardActionUseCase]

  UC --> REG[Registro de schemas]
  UC --> LLM[Adaptador de LLM]
  UC --> POL[Motor de políticas]
  UC --> PROV[Provedor ativo]

  LLM -->|Intenção bruta| UC
  REG -->|Schema de intenção v1| UC
  POL -->|Intenção normalizada| UC
  PROV -->|Ação de dashboard| UC

  UC -->|Valida ação com Zod| RES[Resposta HTTP 200]
  RES --> FE

```

---

# Fluxo Detalhado da Requisição

```mermaid
sequenceDiagram
  participant U as Usuário
    participant FE as Frontend
  participant API as Rota Fastify
  participant UC as Caso de Uso
  participant LLM as Adaptador de LLM
  participant POL as Motor de Políticas
  participant PROV as Provedor Ativo

    U->>FE: "ocupação por bairro em 2024"
    FE->>API: POST /dashboard/resolve

    API->>API: Valida requisição (Zod)
    API->>UC: resolveDashboardAction()

    UC->>UC: Seleciona schema de intenção (v1)
    UC->>LLM: generateStructured(schema, message)

    LLM-->>UC: Intenção estruturada

    UC->>POL: normalizeIntent(intent)
    POL-->>UC: Intenção normalizada

    UC->>UC: Verificação de confiança

    UC->>PROV: generate(intent)
    PROV-->>UC: Ação de dashboard

    UC->>UC: Valida ação de dashboard (Zod)
    UC-->>API: action

    API-->>FE: 200 { action }
```

---

# Separação de Responsabilidades

```mermaid
flowchart LR

subgraph Camada HTTP
A[apps/api]
end

subgraph Camada de Aplicação
B[Caso de Uso]
end

subgraph Camada de Domínio
C[Schema de Intenção]
D[Schema de DashboardAction]
end

subgraph Infraestrutura
E[Adaptador de LLM]
F[Motor de Políticas]
G[Provedor Ativo]
end

A --> B
B --> C
B --> D
B --> E
B --> F
B --> G
```

---

# Transformação Central (Intenção → Ação)

```mermaid
flowchart TD

A[Mensagem do Usuário]
  --> B[LLM]
  --> C[Intenção]

C --> D[Normalização de Política]
D --> E[Verificação de Confiança]
E --> F[Provedor Ativo]
F --> G[Ação de Dashboard]
```

---

# Política (estrita por padrão)

```mermaid
flowchart LR

A[Sinônimos]
  --> B[Filtros canônicos permitidos]
  --> C[Mapeamento de informationType]
  --> D[Remove chaves desconhecidas]
```

---

# Troca de Provedor (sem mudar o domínio)

```mermaid
flowchart TD

Intenção --> ProviderA[LookerProvider]
Intenção --> ProviderB[CustomProvider]

ProviderA -->|open_url| Ação
ProviderB -->|run_query| Ação
```

⚠️ Apenas **um provedor ativo por vez**, selecionado no `apps/api/config/policy.ts` pela chave `activeProvider`:

```
"activeProvider": "looker"
```

ou

```
"activeProvider": "custom"
```

---

# Validação em Todas as Fronteiras

```mermaid
flowchart TD

Requisição -->|Zod| RequisiçãoVálida
RequisiçãoVálida -->|LLM| IntençãoBruta
IntençãoBruta -->|Zod| Intenção
Intenção -->|Provedor| Ação
Ação -->|Zod| AçãoVálida
AçãoVálida --> Resposta
```

---

# Mapa Mental Resumido

```mermaid
flowchart LR
  ROOT[Resolvedor Conversacional de Dashboard]

  ROOT --> API[apps/api]
  ROOT --> APP[libs/application]
  ROOT --> DOM[libs/domain]
  ROOT --> POL[libs/policy]
  ROOT --> LLM[libs/llm]
  ROOT --> PROV[libs/providers]

  API --> API1[Rotas Fastify]
  API --> API2[CORS e validação de contrato]
  API --> API3[Configuração de DI]

  APP --> APP1[Orquestração de caso de uso]
  APP --> APP2[Cadeia de fallback]
  APP --> APP3[Verificação de confiança]

  DOM --> DOM1[Tipos de intenção]
  DOM --> DOM2[Contrato de DashboardAction]
  DOM --> DOM3[Schemas Zod]

  POL --> POL1[Configuração de política]
  POL --> POL2[Sinônimos para filtros e informationType]
  POL --> POL3[Normalização estrita de filtros]

  LLM --> LLM1[Saída estruturada]
  LLM --> LLM2[Versionamento de schema]

  PROV --> PR1[Provedor Looker]
  PROV --> PR2[Provedor alternativo]

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

# Conceito Central da Arquitetura

> O LLM sugere a intenção.
> A política normaliza de forma estrita.
> O provedor materializa a ação.
> O domínio garante o contrato.
