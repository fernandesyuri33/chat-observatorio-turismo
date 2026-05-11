flowchart TB
    subgraph Apps
        WEB[apps/web<br/>Frontend React]
        API[apps/api<br/>API Fastify]
    end

    subgraph Bibliotecas["Bibliotecas compartilhadas"]
        CONTRATOS[libs/contracts<br/>Contrato HTTP]
        DOMINIO[libs/domain<br/>Tipos e schemas do domínio]
        APLICACAO[libs/application<br/>Pipeline e caso de uso]
        POLITICA[libs/policy<br/>Configuração e normalização]
        LLM[libs/llm<br/>Porta e adaptadores de LLM]
        PROVIDERS[libs/providers<br/>Estratégias de dashboard]
    end

    WEB --> CONTRATOS
    API --> CONTRATOS
    API --> APLICACAO

    APLICACAO --> DOMINIO
    APLICACAO --> POLITICA
    APLICACAO --> LLM
    APLICACAO --> PROVIDERS

    POLITICA --> DOMINIO
    PROVIDERS --> DOMINIO
    CONTRATOS --> DOMINIO
