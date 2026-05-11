classDiagram
    class AcaoDashboard {
        <<union>>
        tipo
    }

    class AbrirUrl {
        tipo: "open_url"
        url: string
        titulo?: string
        mensagem?: string
        meta?: object
    }

    class ApenasExplicar {
        tipo: "explain_only"
        mensagem: string
    }

    class PedirInformacaoFaltante {
        tipo: "ask_missing_information"
        mensagem: string
        camposFaltantes: string[]
    }

    AcaoDashboard <|-- AbrirUrl
    AcaoDashboard <|-- ApenasExplicar
    AcaoDashboard <|-- PedirInformacaoFaltante
