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

    AcaoDashboard <|-- AbrirUrl
    AcaoDashboard <|-- ApenasExplicar
