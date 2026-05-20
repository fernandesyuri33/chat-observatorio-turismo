# 3.6 Modelagem das intenções e filtros

## 3.6.1 Estados da solicitação

- `complete_show`: indica que a mensagem já aponta para um recorte analítico executável por um dos gráficos disponíveis. É produzido na Etapa 1 por `llm.generateStructured(RequestStateResultSchema, ..., buildRequestStatePrompt())`. Na decisão final, pode levar a `execute_show`, `ask_missing_information` ou `give_initial_orientation`, dependendo de `candidateInformationType`, presença de filtros e `minConfidence`. Exemplo inferível: “Mostre funcionários por município em Pouso Alegre”. Base: `REQUEST_STATE_VALUES`, `RequestStateSchema`, `RequestStateResultSchema` em request-state.schema.ts; prompt em request-state.prompt.ts; uso em `resolveDashboardAction` em resolve-dashboard-action.usecase.ts; decisão em `routeResponse` em response-router.ts; testes em response-router.spec.ts e domain.spec.ts.

- `context_only`: indica que o usuário informou apenas contexto de filtro, sem especificar qual análise quer ver. É produzido na Etapa 1. Na decisão final, leva a `give_contextual_orientation`, que depois vira uma ação `explain_only` com sugestões de análises possíveis. Exemplo inferível: “Quero ver dados de Poços de Caldas”. Base: request-state.schema.ts, request-state.prompt.ts, response-router.ts, response-builder.ts; testes em resolve-dashboard-action.shared.ts, response-router.spec.ts e rotas.spec.ts.

- `initial_orientation`: indica pedido aberto de orientação sobre o que o dashboard permite explorar. É produzido na Etapa 1. No fluxo atual, aciona short-circuit logo após a classificação, sem Etapa 2, e vai para orientação inicial via provider ou fallback local. Exemplo inferível: “O que posso analisar ou descobrir aqui?”. Base: request-state.schema.ts, request-state.prompt.ts, `resolveInitialOrientationAction` em response-builder.ts, short-circuit em resolve-dashboard-action.usecase.ts; testes em resolve-dashboard-action.shared.ts e rotas.spec.ts.

- `curiosity_to_action`: indica pergunta de curiosidade sobre o domínio que não se mapeia diretamente a um gráfico suportado. É produzido na Etapa 1. No fluxo atual, ainda passa pela Etapa 2, mas a decisão determinística usa `findCuriosityFaqMatch` sobre a mensagem original; com match de FAQ, gera `convert_curiosity_to_action`, sem match volta para orientação inicial. Exemplo inferível: “O setor turístico de Poços de Caldas está evoluindo?”. Base: request-state.schema.ts, request-state.prompt.ts, curiosity-matcher.ts, response-router.ts, policy.ts; testes em curiosity-matcher.spec.ts, resolve-dashboard-action.shared.ts e rotas.spec.ts.

- `unclear`: indica mensagem vaga ou incompreensível. É produzido na Etapa 1. No fluxo atual, também aciona short-circuit e retorna orientação inicial, sem extração estruturada. Exemplos inferíveis: “ajuda” e entradas sem conteúdo semântico claro. Base: request-state.schema.ts, request-state.prompt.ts, resolve-dashboard-action.usecase.ts, response-router.ts; testes em response-router.spec.ts e heurística de stub em stub-llm.adapter.ts.

## 3.6.2 Tipos de informação suportados

- `funcionarios_ao_longo_do_tempo`: representa a evolução temporal do número de funcionários no setor turístico. No Looker, é mapeado para a página `p_nv1avgkewd`. Exemplos de comandos inferíveis: “funcionários ao longo dos anos”, “como o emprego no turismo mudou com o tempo”. Base: `InformationTypeSchema` em intent.v1.schema.ts; descrição e variações em graficos.ts; prompt de extração em extraction.prompt.ts; mapeamento Looker em policy.ts.

- `saldo_funcionarios_ao_longo_do_tempo`: representa a diferença entre admissões e desligamentos ao longo do tempo. No Looker, é mapeado para a página `p_fnowokk6wd`. Exemplos inferíveis: “saldo de empregos ao longo do tempo”, “balanço de contratações e desligamentos”. Base: intent.v1.schema.ts, graficos.ts, extraction.prompt.ts, policy.ts.

- `funcionarios_por_municipio`: representa a distribuição de funcionários entre municípios. No Looker, é mapeado para a página `p_joj1sbkewd`. Exemplos inferíveis: “quais cidades têm mais empregos no turismo”, “ranking de municípios por número de funcionários”. Base: intent.v1.schema.ts, graficos.ts, policy.ts, comportamento confirmado em resolve-dashboard-action.shared.ts.

- `estabelecimentos_por_municipio`: representa a quantidade de estabelecimentos turísticos por município. No Looker, é mapeado para a página `p_3niel4jewd`. Exemplos inferíveis: “comparar estabelecimentos entre municípios”, “quais cidades têm mais estabelecimentos turísticos”. Base: intent.v1.schema.ts, graficos.ts, policy.ts.

- O sistema trabalha com exatamente quatro tipos canônicos de informação no código atual; não há outros `informationType` no enum nem no mapeamento do provider. Base: intent.v1.schema.ts, graficos.ts, policy.ts.

## 3.6.3 Filtros suportados

- `classificacao`: nome interno do filtro. No provider Looker, é serializado como `classification` via `paramMap`. O tipo esperado é enum textual com os valores de `ClassificacaoSchema`; no schema de filtros ele aparece como opcional e anulável. É validado por `IntentV1FiltersSchema` e preservado na normalização apenas se estiver no conjunto `CLASSIFICACOES`. Base: intent.v1.schema.ts, policy-engine.ts, policy.ts, looker-provider.ts.

- `municipio`: nome interno do filtro. No provider Looker, é serializado como `city` via `paramMap`. O tipo esperado é `string` não vazia, opcional e anulável no schema, e é preservado na normalização quando for `string` com comprimento maior que zero. Não há lista canônica de municípios no código. Base: intent.v1.schema.ts, policy-engine.ts, policy.ts, looker-provider.ts.

- Não há outros filtros de domínio suportados no pipeline atual. O conjunto permitido é explicitamente limitado a `classificacao` e `municipio` por `ALLOWED_FILTER_KEYS` e pelo próprio schema `IntentV1FiltersSchema`. Base: intent.v1.schema.ts, policy-engine.ts.

- No contrato frontend-backend, filtros não entram como campos estruturados da requisição principal; a entrada formal é apenas `message`. Na resposta, filtros podem reaparecer em `rationale.stage2.filters`, em `ask_missing_information.context` e em `apply_filters.filters`. O estado `context_only` continua se referindo a mensagens cujo texto traz apenas contexto analítico, não a um `ctx` enviado pelo frontend. Base: contrato em contrato-mensagem-post.schema.ts; envio real em App.tsx; decisão em response-router.ts.

## 3.6.4 Valores aceitos

- `classificacao` aceita, de forma canônica, exatamente estes seis valores: `alimentação`, `transportes`, `comércios e serviços`, `hospedagem`, `entretenimento`, `agencias e operadores`. Eles estão definidos no enum `ClassificacaoSchema` e repetidos no conjunto `CLASSIFICACOES` da política. Base: intent.v1.schema.ts, policy-engine.ts, prompt em extraction.prompt.ts.

- `municipio` não tem lista fechada no repositório. O valor aceito canonicamente é qualquer `string` não vazia; portanto, a canonicidade aqui é apenas estrutural, não semântica. Lista oficial de municípios válidos: “não identificado no repositório”. Base: intent.v1.schema.ts, policy-engine.ts.

- Sinônimos configurados no projeto atual são poucos e específicos: `classificação -> classificacao` para chave de filtro, além de frases equivalentes para os quatro `informationType`. Não há sinônimos configurados para valores de `classificacao` nem para nomes de municípios. Base: sinonimos.ts.

- A normalização transforma valores alternativos apenas quando existe entrada explícita em `synonyms`. No fluxo atual, isso beneficia mais nomes técnicos e a chave `classificação`; não há evidência no repositório de normalização lexical de valores como `alimentacao` sem acento ou variantes de municípios. Base: sinonimos.ts, `normalizeExtraction` em policy-engine.ts.

- O que acontece com valores não reconhecidos de `classificacao`: na trilha principal do pipeline, `ExtractionResultSchema` usa `IntentV1FiltersSchema`, então um valor fora do enum tende a invalidar a extração da Etapa 2; o `resolveDashboardAction` captura essa falha e cai para orientação inicial. Na camada de normalização, se um valor inválido chegasse até lá, ele seria descartado por não pertencer a `CLASSIFICACOES`. Base: extraction-result.schema.ts, intent.v1.schema.ts, resolve-dashboard-action.usecase.ts, policy-engine.ts.

- O que acontece com valores não reconhecidos de `municipio`: como não há lista de municípios válidos, qualquer `string` não vazia é mantida e enviada ao Looker. Se o relatório não reconhecer esse valor, esse comportamento posterior não é validado no repositório; isso é dependência do lado Looker. Base: policy-engine.ts, looker-provider.ts.

## 3.6.5 Casos fora do escopo

- Perguntas abertas de onboarding, como “o que posso ver aqui?”, não são tratadas como execução direta de gráfico; elas entram em `initial_orientation` e viram `explain_only` com sugestões. Base: request-state.prompt.ts, response-router.ts, response-builder.ts, testes em rotas.spec.ts.

- Mensagens vagas ou incompreensíveis entram em `unclear` e também retornam orientação inicial. Base: request-state.schema.ts, request-state.prompt.ts, response-router.spec.ts.

- Perguntas de curiosidade que não mapeiam diretamente para um gráfico suportado entram em `curiosity_to_action`. Se houver correspondência no FAQ configurado, o sistema devolve resposta explicativa com uma sugestão de recorte; se não houver, cai para orientação inicial. Base: policy.ts, curiosity-matcher.ts, response-router.ts.

- Filtros inexistentes são descartados antes de chegar ao provider. Isso vale tanto por schema fechado quanto por sanitização em `PolicyEngine`. Base: intent.v1.schema.ts, policy-engine.ts.

- Tipos de informação não suportados não têm tratamento como quinto ou sexto `informationType`; o conjunto é fechado em quatro valores. Se a LLM devolver um tipo inválido em `candidateInformationType`, a validação de schema da Etapa 2 falha e o caso de uso retorna orientação inicial. Base: intent.v1.schema.ts, extraction-result.schema.ts, resolve-dashboard-action.usecase.ts.

- Solicitações sem informação suficiente são tratadas de dois modos. Se o usuário só deu contexto de filtro, o estado vira `context_only` e a resposta é orientação contextual. Se a classificação foi `complete_show` mas faltou `informationType` e há filtros, o sistema retorna `ask_missing_information`. Base: response-router.ts, response-builder.ts, testes em response-router.spec.ts.

- Pedidos por dados que não existem no domínio atual, como métricas de visitas ou filtro de ano, estão fora do escopo do código vigente: não há `informationType`, filtro nem `paramMap` para isso. O exemplo de README.md com “visitas” e “2024” não corresponde ao modelo atual e não deve ser usado como fonte principal da metodologia. Base: ausência em intent.v1.schema.ts e policy.ts; exemplo divergente em README.md.

- Perguntas abertas sem relação com o dashboard ou com o domínio turístico não têm uma regra nominal específica além das categorias genéricas `unclear` e, para curiosidades do domínio, `curiosity_to_action`. Tratamento exato desse caso: “não identificado no repositório” além dessas categorias amplas. Base: request-state.prompt.ts.

# 3.7 Pipeline de interpretação e decisão

## 3.7.1 Visão geral do pipeline

```text
POST /mensagem
-> validação com PostMensagemRequestSchema
-> recuperação do histórico por x-conversation-id
-> resolveDashboardAction(...)
   -> Etapa 1: classificação do estado da solicitação
   -> short-circuit para initial_orientation/unclear, quando aplicável
   -> Etapa 2: extração estruturada
   -> normalizeExtraction(...)
   -> buildIntent(...)
   -> routeResponse(...)
   -> executeDecision(...)
   -> Etapa 4: enrichWithFriendlyMessage(...) em modo best-effort
-> validação final do contrato HTTP com PostMensagemResponseSchema
-> persistência do novo turno no histórico
```

- A entrada HTTP é tratada em `rotas`, que valida o corpo, busca histórico, chama o caso de uso e persiste o novo turno. Base: rotas.ts, contrato-mensagem-post.schema.ts.

- O orquestrador principal é `resolveDashboardAction`, que coordena LLM, política, decisão determinística, provider e mensagem amigável. Base: resolve-dashboard-action.usecase.ts.

- A normalização fica em `PolicyEngine.normalizeExtraction`. Base: policy-engine.ts.

- A decisão sem LLM fica em `routeResponse`. Base: response-router.ts.

- A tradução de decisão para `DashboardAction` fica em `executeDecision`, `resolveInitialOrientationAction`, `buildAskMissingInformationAction`, `buildCuriosityToAction` e builders correlatos. Base: resolve-dashboard-action.usecase.ts, response-builder.ts.

- O provider ativo é injetado em main.ts a partir de `activeProvider`. Base: main.ts, policy.ts.

## 3.7.2 Classificação

- Quem faz a classificação é a porta `LlmPort`, chamada via `llm.generateStructured(...)` no início de `resolveDashboardAction`. Em produção, o adapter tende a ser `OllamaLlmAdapter`; em testes ou desenvolvimento offline, pode ser `StubLlmAdapter`. Base: llm.port.ts, resolve-dashboard-action.usecase.ts, main.ts.

- O prompt usado é `buildRequestStatePrompt()`, que injeta a lista de gráficos de `GRAFICOS_DASHBOARD` no `REQUEST_STATE_PROMPT`. Base: request-state.prompt.ts, graficos.ts.

- Os campos retornados são `requestState`, `confidence` e `rationale`, formalizados por `RequestStateResultSchema`. Base: request-state.schema.ts.

- `confidence` e `rationale` da Etapa 1 são capturados em `stage1Result` e repassados para `request.onStageRationale`, chegando até a resposta HTTP em `rationale.stage1` e sendo exibidos no frontend. No fluxo atual, `confidence` da Etapa 1 não é comparado com `minConfidence`; o limiar de confiança é aplicado depois, sobre a Etapa 2. Base: resolve-dashboard-action.usecase.ts, contrato-mensagem-post.schema.ts, App.tsx, response-router.ts.

- A validação da resposta da LLM ocorre pelo próprio schema Zod passado ao adapter. No `OllamaLlmAdapter`, a sequência é `JSON.parse(raw)` -> `normalizeLlmFieldAliases(jsonObj)` -> `schema.parse(jsonObj)`. Base: ollama-llm.adapter.ts.

- O short-circuit acontece quando `requestState` é `initial_orientation` ou `unclear`. Nesses casos, a Etapa 2 é pulada e o sistema vai direto para orientação inicial. `curiosity_to_action` não faz short-circuit nesse ponto. Base: resolve-dashboard-action.usecase.ts.

## 3.7.3 Extração estruturada

- Os campos extraídos da mensagem são `candidateInformationType`, `proposedFilters`, `confidence` e `rationale`. Isso é formalizado por `ExtractionResultSchema`. Base: extraction-result.schema.ts.

- `candidateInformationType` usa `InformationTypeSchema`; `proposedFilters` usa `IntentV1FiltersSchema`; `confidence` é número entre 0 e 1; `rationale` é opcional. Base: extraction-result.schema.ts, intent.v1.schema.ts.

- A chamada à LLM é `llm.generateStructured(ExtractionResultSchema, request.message, buildExtractionPrompt(), request.history)`. Isso ocorre na Etapa 2 do caso de uso. Base: resolve-dashboard-action.usecase.ts, extraction.prompt.ts.

- O prompt de extração instrui explicitamente a usar apenas filtros mencionados na mensagem atual ou no histórico, a não inventar filtros e a omitir `candidateInformationType` quando o usuário só fornece contexto. Base: extraction.prompt.ts.

- No `OllamaLlmAdapter`, JSON inválido ou schema inválido disparam retentativas até `maxRetries`. Em main.ts, o adapter real é construído com `maxRetries: policyConfig.fallback.retryCount`; no policy.ts atual, esse valor é `3`. Base: ollama-llm.adapter.ts, main.ts, policy.ts.

- Há uma pequena camada de robustez para alias de campo: se a LLM devolver `rational` em vez de `rationale`, o adapter normaliza antes do parse. Base: ollama-llm.adapter.ts.

- Se a Etapa 2 falhar depois de esgotar as retentativas, `resolveDashboardAction` captura a exceção e retorna orientação inicial. Base: resolve-dashboard-action.usecase.ts.

## 3.7.4 Normalização

- O papel do `PolicyEngine` é normalizar a extração antes da decisão determinística. No código atual, isso é feito por `normalizeExtraction(raw: ExtractionResult): ExtractionResult`. Base: policy-engine.ts.

- A normalização de chaves segue esta lógica: para cada entrada de `proposedFilters`, valores `undefined` e `null` são ignorados; a chave é reescrita por `synonyms[key] ?? key`; depois, chaves fora de `ALLOWED_FILTER_KEYS` são removidas. Base: policy-engine.ts, sinonimos.ts.

- A normalização de valores segue esta lógica: quando o valor do filtro é `string`, ele é reescrito por `synonyms[value] ?? value`; depois, `classificacao` só é mantida se pertencer ao conjunto `CLASSIFICACOES`, e `municipio` só é mantido se for `string` não vazia. Base: policy-engine.ts.

- O tratamento de sinônimos configurado no projeto atual é restrito. Há alias para a chave `classificação` e para nomes dos `informationType`, mas não há sinônimos de valores de classificação nem normalização de nomes de município. Base: sinonimos.ts.

- O descarte de filtros desconhecidos é explícito em `normalizeExtraction` e também é consistente com o fato de o schema de filtros ser fechado. Base: policy-engine.ts, intent.v1.schema.ts.

- `minConfidence` não é aplicado no `PolicyEngine`. No fluxo atual, o limiar fica em `routeResponse` e afeta apenas o caso `complete_show` após a extração. Base: policy-config.schema.ts, policy.ts, response-router.ts.

- Arquivos de configuração envolvidos: schema da política em policy-config.schema.ts; configuração concreta em policy.ts; sinônimos em sinonimos.ts.

## 3.7.5 Decisão determinística

- A resposta final é decidida por `routeResponse(params)` em response-router.ts. Essa função é pura e não consulta LLM, rede nem Redis.

- `initial_orientation` e `unclear` levam diretamente a `give_initial_orientation`. Base: response-router.ts, testes em response-router.spec.ts.

- `curiosity_to_action` aciona `findCuriosityFaqMatch(message, config.curiosityFaq)`. Se houver match, a decisão vira `convert_curiosity_to_action`; se não houver, `give_initial_orientation`. Base: curiosity-matcher.ts, response-router.ts, policy.ts.

- O matcher de FAQ é lexical e determinístico. Ele normaliza texto, tokeniza, exige pelo menos dois tokens em comum e um `MIN_MATCH_SCORE` de `0.45`. Base: curiosity-matcher.ts, testes em curiosity-matcher.spec.ts.

- `context_only` leva a `give_contextual_orientation`, carregando os filtros extraídos. Base: response-router.ts.

- `complete_show` com `extraction.confidence < config.minConfidence` leva a `give_initial_orientation`. O limiar atual em produção é `0.5`. Base: response-router.ts, policy.ts, teste em response-router.spec.ts.

- `complete_show` com `candidateInformationType` válido leva a `execute_show`. Base: response-router.ts, teste em response-router.spec.ts.

- `complete_show` sem `candidateInformationType`, mas com filtros, leva a `ask_missing_information` com `missing: ["informationType"]`. Base: response-router.ts, teste em response-router.spec.ts.

- `complete_show` sem `candidateInformationType` e sem filtros leva a `give_initial_orientation`. Base: response-router.ts.

- Na orientação contextual, o conjunto de sugestões não é calculado dinamicamente a partir dos filtros; ele vem de `INFORMATION_TYPE_VALUES.slice(0, contextualOrientationOptionCount)`. Como `contextualOrientationOptionCount` atual é `3`, o sistema sugere apenas os três primeiros tipos da enumeração e não lista todos os quatro por padrão. Base: response-builder.ts, policy.ts, testes em resolve-dashboard-action.shared.ts.

## 3.7.6 Geração da ação

- `executeDecision` traduz `ResponseDecision` em `DashboardAction`. É a ponte entre decisão abstrata e ação concreta. Base: resolve-dashboard-action.usecase.ts.

- `give_initial_orientation` chama `resolveInitialOrientationAction(provider)`. O provider recebe um `IntentV1` com `intent: "initial_orientation"`; se falhar ou devolver ação inválida, o sistema usa `buildDefaultInitialOrientationAction()`. Base: response-builder.ts.

- `give_contextual_orientation` vira `explain_only` com mensagem montada por `buildContextualOrientationMessage(filters)` e sugestões montadas por `buildContextualOrientationSuggestions(optionCount)`. Base: response-builder.ts.

- `convert_curiosity_to_action` vira `explain_only` com `message`, `suggestions` e `meta.curiosityToAction`. Base: response-builder.ts.

- `ask_missing_information` vira `ask_missing_information` com `missing`, `context` e sugestões das análises disponíveis. Base: response-builder.ts.

- `execute_show` reconstrói um `IntentV1` com `intent: "show"`, `informationType`, `proposedFilters`, `confidence` e `rationale` da extração e então chama `provider.generate(intentForProvider)`. Base: resolve-dashboard-action.usecase.ts.

- Os tipos de `DashboardAction` existentes no domínio são cinco: `open_url`, `apply_filters`, `run_query`, `explain_only` e `ask_missing_information`. Base: dashboard-action.schema.ts, testes em domain.spec.ts.

- Na integração atual com `activeProvider: "looker"`, os tipos efetivamente usados são `open_url`, `explain_only` e `ask_missing_information`. `run_query` só aparece quando o provider ativo é `custom`. `apply_filters` existe no schema e no frontend, mas “não identificado no repositório” nenhum provider atual que o emita. Base: policy.ts, main.ts, looker-provider.ts, custom-provider.ts, App.tsx.

- O provider ativo é escolhido em main.ts pelo valor `policyConfig.activeProvider`. O registro atual contém `looker` e `custom`; se o id configurado não existir, a API lança erro na inicialização. Base: main.ts, policy.ts.

## 3.7.7 Mensagem amigável

- Existe uma etapa explícita de geração de mensagem final ao usuário, chamada “Etapa 4 — Geração de mensagem amigável”. Ela roda depois que a ação principal já foi definida. Base: resolve-dashboard-action.usecase.ts.

- Essa etapa usa LLM. A chamada é `llm.generateStructured(FriendlyMessageSchema, contextInput, prompt, history)`, em que o prompt vem de `buildFriendlyMessagePrompt()` e o input vem de `buildFriendlyMessageInput(...)`. Base: friendly-message.schema.ts, friendly-message.prompt.ts, resolve-dashboard-action.usecase.ts.

- O modo é `best-effort`: se a geração falhar, a ação original é devolvida sem alteração. Base: `enrichWithFriendlyMessage` em resolve-dashboard-action.usecase.ts.

- Quando funciona, essa etapa sempre sobrescreve ou injeta o campo `message` na ação final. Para `explain_only` e `ask_missing_information`, isso substitui a mensagem anterior; para `open_url`, `apply_filters` e `run_query`, isso adiciona uma mensagem. Base: resolve-dashboard-action.usecase.ts, dashboard-action.schema.ts.

- O contexto enviado para a Etapa 4 inclui `userMessage`, `actionType`, `informationType` do `meta` quando a ação é `open_url`, filtros extraídos, sugestões, campos faltantes e a mensagem original do sistema. Base: friendly-message.prompt.ts.

## 3.7.8 Tratamento de falhas

- Erro da LLM na Etapa 1: `resolveDashboardAction` captura a falha e retorna orientação inicial por `resolveInitialOrientationAction(provider, ctx)`. Base: resolve-dashboard-action.usecase.ts.

- JSON inválido ou schema inválido nas Etapas 1 e 2: no adapter real, isso entra no ciclo de retentativas; se todas falharem, a exceção sobe e o caso de uso cai para orientação inicial. Base: ollama-llm.adapter.ts, resolve-dashboard-action.usecase.ts.

- Baixa confiança: `minConfidence` é aplicado somente em `routeResponse` para `complete_show`; se a confiança da extração ficar abaixo do limiar, a resposta vira orientação inicial. Base: response-router.ts, policy.ts.

- Filtro desconhecido: é descartado na normalização e não chega ao provider. Base: policy-engine.ts.

- Informação faltante: quando há contexto de filtros mas falta qual análise mostrar, o sistema produz `ask_missing_information`; quando há apenas contexto solto, produz orientação contextual. Base: response-router.ts, response-builder.ts.

- Provider sem suporte: se `activeProvider` apontar para um id ausente do `providerRegistry`, a API nem inicia. No repositório atual, os dois providers implementam todos os intents modelados. Base: main.ts, action-provider.ts, looker-provider.ts, custom-provider.ts.

- Falha do provider em `execute_show`: o sistema captura a exceção e cai para orientação inicial. Base: resolve-dashboard-action.usecase.ts.

- Provider devolvendo ação inválida: `execute_show` faz `DashboardActionSchema.safeParse(action)` e, se falhar, também cai para orientação inicial. `resolveInitialOrientationAction` valida a resposta do provider e usa fallback local se necessário. Base: resolve-dashboard-action.usecase.ts, response-builder.ts, dashboard-action.schema.ts.

- Redis indisponível: não há `try/catch` explícito em torno de `historyService.get(...)` nem `historyService.append(...)` na rota. Portanto, para indisponibilidade de Redis na camada HTTP, o tratamento específico é “não identificado no repositório”; a tentativa de sempre devolver uma ação válida cobre o caso de uso, mas não cobre necessariamente a falha da infraestrutura de histórico. Base: rotas.ts, history.service.ts.

- Falhas que não devem vazar ao frontend: o núcleo do caso de uso converte falhas de interpretação, parse e provider em ações válidas de orientação, e a rota valida a resposta com `PostMensagemResponseSchema`. Ainda assim, não há um `try/catch` final na rota em torno de `PostMensagemResponseSchema.parse(...)` nem das chamadas ao Redis. Base: resolve-dashboard-action.usecase.ts, rotas.ts, contrato-mensagem-post.schema.ts.

# 3.8 Integração com Looker Studio e interface web

## 3.8.1 Iframe do Looker Studio

- O `iframe` é renderizado no componente `App`, dentro de `.dashboard-panel > .iframe-wrapper`, como `<iframe title="Looker Studio" src={embedUrl} />`. Base: App.tsx.

- A URL inicial do `iframe` vem de `import.meta.env["VITE_LOOKER_EMBED_URL"]`. Se a variável estiver ausente, o frontend usa um fallback hardcoded com a página `p_3niel4jewd` do relatório atual. Base: App.tsx, exemplo em .env.example.

- A URL do `iframe` é mantida em estado React por `const [embedUrl, setEmbedUrl] = useState(baseEmbedUrl)`. Base: App.tsx.

- O frontend reage a `open_url` chamando `setEmbedUrl(data.action.url)`. Nenhum outro tipo de ação altera o `iframe`. Base: App.tsx.

## 3.8.2 Provider Looker

- O `LookerProvider` está implementado em looker-provider.ts.

- A entrada esperada pelo provider é um `IntentV1` já normalizado. O provider não recebe contexto estruturado de dashboard vindo do contrato HTTP; filtros e recortes entram apenas via linguagem natural e normalização do pipeline. Base: looker-provider.ts, action-provider.ts, resolve-dashboard-action.usecase.ts.

- A saída principal para `intent: "show"` é uma ação `open_url` com `url`, `title` e `meta` contendo `provider`, `intent` e `informationType`. Para `initial_orientation` e `curiosity_to_action`, o provider devolve `explain_only`, não navegação. Base: looker-provider.ts.

- A montagem da URL final segue esta lógica:

```text
url = new URL(looker.baseUrl)
url = resolveUrlForInformationType(informationType)
mappedParams = remap(intent.proposedFilters, looker.paramMap)
if mappedParams não vazio:
  url.searchParams.set("params", JSON.stringify(mappedParams))
return open_url(url.toString())
```

Base: looker-provider.ts.

- `resolveUrlForInformationType` usa `looker.baseUrl` e `looker.informationTypeMap`. Se o mapeamento for uma URL absoluta, ela é usada diretamente. Se começar com `/`, o `pathname` é substituído. Caso contrário, a função remove o trecho final `/page/...` da base e reconstrói o caminho como `/page/<mappedPage>`. Base: looker-provider.ts.

- A `baseUrl`, o `informationTypeMap` e o `paramMap` vêm da configuração validada em `policyConfig`. Base: policy.ts, schema em policy-config.schema.ts.

## 3.8.3 Mapeamento de páginas

- `estabelecimentos_por_municipio -> p_3niel4jewd`. Base: policy.ts.

- `funcionarios_por_municipio -> p_joj1sbkewd`. Base: policy.ts.

- `funcionarios_ao_longo_do_tempo -> p_nv1avgkewd`. Base: policy.ts.

- `saldo_funcionarios_ao_longo_do_tempo -> p_fnowokk6wd`. Base: policy.ts.

- Esse mapeamento é consumido por `LookerProvider.resolveUrlForInformationType`. Base: looker-provider.ts.

## 3.8.4 Mapeamento de parâmetros

- `classificacao -> classification`. Base: policy.ts, looker-provider.ts.

- `municipio -> city`. Base: policy.ts, looker-provider.ts.

- Os filtros não viram parâmetros query separados. O provider monta um objeto JSON `mappedParams` e o serializa inteiro no parâmetro `params`. Padrão resultante: `...?params=<JSON URL-encoded>`. Base: looker-provider.ts.

- Se não houver filtros, o parâmetro `params` simplesmente não é adicionado à URL. Base: looker-provider.ts.

## 3.8.5 Aplicação da ação no frontend

- O frontend envia a mensagem via `fetch(`${apiUrl}/mensagem`, { method: "POST", headers, body })`, com `Content-Type: application/json` e `x-conversation-id`. O payload enviado contém apenas `{ message }` e é validado antes do envio por `PostMensagemRequestSchema.parse(payload)`. Base: App.tsx, contrato-mensagem-post.schema.ts.

- O frontend recebe o JSON, faz `await response.json()` e valida/tipa a resposta com `PostMensagemResponseSchema.parse(raw)`. Base: App.tsx, contrato-mensagem-post.schema.ts.

- Para `open_url`, o frontend atualiza o `iframe` com `setEmbedUrl(data.action.url)` e monta a fala do assistente por `message ?? title ?? "Abrindo: <url>"`. Base: App.tsx.

- Para `apply_filters`, o frontend não altera o `iframe`; ele apenas mostra uma mensagem textual usando `message ?? JSON.stringify(filters)`. Base: App.tsx.

- Para `run_query`, o frontend também não executa nada além de exibir a mensagem `message ?? "Executando: <function>"`. Não há executor concreto de `run_query` no cliente. Base: App.tsx, custom-provider.ts.

- Para `explain_only` e `ask_missing_information`, o frontend atualiza as `suggestion chips` com `data.action.suggestions` e escreve a `message` no chat. Base: App.tsx.

- O componente `ActionPanel` exibe `rationale.stage1`, `rationale.stage2`, o tipo da última ação e o JSON completo de `lastAction`. Isso torna visíveis classificação, confiança, `informationType` e filtros extraídos. Base: App.tsx.

- Ações sem navegação não mudam o dashboard embutido; elas atualizam apenas chat, sugestões e painel lateral de inspeção. Base: App.tsx.

- O frontend trata erro HTTP ou falha de parse mostrando a mensagem fixa “Nao consegui interpretar. Tente novamente.”. Base: App.tsx.

## 3.8.6 Limitações técnicas da integração

- A integração com Looker é baseada em URL e parâmetro `params`; não há API direta no repositório para controlar componentes internos do relatório após o `iframe` estar carregado. Base: looker-provider.ts, App.tsx.

- O frontend só sabe trocar `src` do `iframe`. Não há código para manipular filtros incrementalmente dentro do relatório já aberto, nem uso de `postMessage`, SDK ou API embutida do Looker. Integração desse tipo: “não identificado no repositório”. Base: App.tsx, looker-provider.ts.

- O mapeamento de páginas e parâmetros é manual e duplicado de forma sensível à configuração. Se o relatório mudar ids de página ou nomes de parâmetro, é preciso atualizar policy.ts. Base: policy.ts.

- Existe duplicação de URL base do relatório entre backend e frontend: o provider usa `policyConfig.looker.baseUrl`, enquanto o frontend tem `VITE_LOOKER_EMBED_URL` com fallback hardcoded. Manter esses dois pontos coerentes é trabalho manual. Base: policy.ts, App.tsx, .env.example.

- Não existe envio de contexto estruturado de dashboard no contrato HTTP. A integração atual depende de histórico conversacional via Redis, extração de filtros a partir da linguagem natural e serialização dos filtros em `params` pelo provider ativo. Base: contrato-mensagem-post.schema.ts, rotas.ts, resolve-dashboard-action.usecase.ts, looker-provider.ts.

- `apply_filters` existe no domínio e no frontend, mas não há provider atual que o emita. Isso reduz a integração atual, na prática, a `open_url` para navegação Looker e respostas textuais para o restante. Base: dashboard-action.schema.ts, App.tsx, looker-provider.ts, custom-provider.ts.

# 3.9 Histórico conversacional

## 3.9.1 Identificação da conversa

- O `conversationId` é criado no frontend por `getOrCreateConversationId()`. A função tenta ler `localStorage.getItem("conversationId")`; se não existir ou estiver vazio, gera um novo id com `crypto.randomUUID()`. Base: App.tsx.

- O id é armazenado no navegador sob a chave `conversationId` em `localStorage` e também mantido em estado React por `useState(() => getOrCreateConversationId())`. Base: App.tsx.

- O frontend envia o id para a API pelo header `x-conversation-id`. Base: App.tsx, rotas.ts.

- Quando não existe `conversationId`, a rota usa histórico vazio e não persiste novos turnos. No frontend atual, isso tende a não ocorrer porque o id é sempre criado antes do primeiro envio. Base: rotas.ts, App.tsx.

## 3.9.2 Redis e HistoryService

- O Redis é instanciado em main.ts por `new Redis(process.env["REDIS_URL"] ?? "redis://localhost:6379", { lazyConnect: true })`. Base: main.ts.

- O `HistoryService` está implementado em history.service.ts.

- O formato da chave usada no Redis é `history:${conversationId}`. Base: history.service.ts.

- O formato dos turnos armazenados é `ConversationTurn`, com `{ role: "user" | "assistant"; content: string }`. Base: tipo em llm.port.ts, uso em history.service.ts.

- O que é persistido do usuário é a mensagem bruta `parsed.data.message`. Base: rotas.ts.

- O que é persistido do assistente, no fluxo real da rota, é um resumo textual em português gerado por `summarizeAssistantTurn(resolvedIntentPayload)`, em que `resolvedIntentPayload` é o `JSON.stringify(intent)` produzido por `onIntentResolved`. O sistema não persiste a `DashboardAction` completa no Redis. Base: rotas.ts, history-summarizer.ts, history-summarizer.spec.ts.

- Há uma divergência interna: o comentário de history.service.ts ainda descreve persistência de “intent normalizada serializada em JSON”, mas a rota efetivamente persiste o resumo textual. Para a metodologia, a implementação da rota é a fonte mais confiável. Base: history.service.ts, rotas.ts.

## 3.9.3 Limite de contexto

- O limite atual em produção é `history.maxMessages: 4` na política. Base: policy.ts.

- O schema de política define valor padrão de `3` caso o campo seja omitido, mas o sistema real do repositório sobrescreve para `4`. Base: policy-config.schema.ts, policy.ts.

- O limite é por turno individual, não por par usuário/assistente. Isso aparece tanto nos comentários quanto em `merged.slice(-this.config.maxMessages)`. Base: history.service.ts.

- A remoção das mensagens antigas acontece no momento da persistência, não no momento da leitura. `append(...)` concatena o histórico existente com os novos turnos e salva apenas os últimos `maxMessages`. Base: history.service.ts.

- Com `maxMessages = 4`, o sistema mantém no máximo quatro mensagens individuais, o que normalmente equivale a cerca de dois pares usuário/assistente. Base: history.service.ts.

## 3.9.4 TTL

- O TTL configurado atualmente é `1800` segundos, isto é, 30 minutos. Base: policy.ts, schema em policy-config.schema.ts.

- O TTL é renovado a cada atualização do histórico. Em `append(...)`, se `ttlSeconds > 0`, o serviço executa `redis.setex(key, ttlSeconds, serialized)`. Base: history.service.ts.

- O objetivo dessa expiração, conforme o desenho do serviço, é limitar a persistência do contexto conversacional e evitar acúmulo indefinido de estado. Base: history.service.ts, policy-config.schema.ts.

## 3.9.5 Uso do histórico pela LLM

- O histórico é enviado nas três chamadas de LLM presentes no pipeline atual: classificação do estado, extração estruturada e mensagem amigável. Base: resolve-dashboard-action.usecase.ts.

- O adapter real inclui o histórico como sequência de mensagens `{ role, content }` entre o `system` prompt e a mensagem atual do usuário. Base: ollama-llm.adapter.ts.

- O histórico ajuda especialmente em mensagens contextuais porque o prompt de extração autoriza `proposedFilters` vindos da mensagem atual ou do histórico da conversa. Base: extraction.prompt.ts.

- O histórico armazenado não contém a `DashboardAction` completa nem o JSON bruto de decisão final; ele contém mensagem do usuário e resumo textual do `NormalizedIntent` anterior. Base: rotas.ts, history-summarizer.ts.

- O `summarizeAssistantTurn` existe para transformar o JSON do intent em linguagem natural e evitar que a LLM passe a imitar respostas em JSON por influência do histórico. Base: history-summarizer.ts.

- Limitações observáveis: a janela é curta, o histórico do assistente é resumido e não contém toda a ação final, e o resumo representa `NormalizedIntent`, não `ResponseDecision` nem `DashboardAction`; portanto, parte da nuance da resposta anterior pode se perder. Base: history-summarizer.ts, resolve-dashboard-action.usecase.ts, rotas.ts.

# 3.10 Ambiente de execução

## 3.10.1 Execução local

- Instalação de dependências: `pnpm install` no workspace. Base: script e lock do monorepo em package.json, instruções em README.md.

- Execução de desenvolvimento integrada: `pnpm dev`, que executa `api` e `web` em paralelo via pnpm workspaces. Isso sobe web e api. Base: package.json, package.json e package.json.

- Execução direta por aplicação: `pnpm -C apps/web dev` inicia Vite; `pnpm -C apps/api dev` inicia `tsx watch src/main.ts`. Base: package.json, package.json.

- Portas locais confirmadas em código: web em `3000` pelo vite.config.ts; API em `3001` por `PORT` default em main.ts; Redis default em `6379` pelo fallback de `REDIS_URL`; Ollama default em `http://localhost:11434/v1` pelo `OllamaLlmAdapter`. Base: vite.config.ts, main.ts, ollama-llm.adapter.ts.

- Dependências locais necessárias segundo código e README: Node.js 20+, pnpm 9+, Redis para histórico, e Ollama quando o sistema usa `OllamaLlmAdapter`. Se `LLM_ADAPTER=stub`, o Ollama deixa de ser obrigatório para a API, mas o Redis continua sendo usado pela rota atual. Base: README.md, main.ts, ollama-llm.adapter.ts.

- O `pnpm dev` não sobe Redis nem Ollama por si só. O README orienta iniciar esses serviços separadamente com Docker Compose ou rodá-los fora do monorepo. Base: README.md.

## 3.10.2 Docker Compose

- Serviços definidos no compose base: `redis`, `ollama`, `ollama-init`, `api` e `web`. Base: docker-compose.yml.

- `redis`: armazena o histórico conversacional. Expõe `6379:6379` e tem `healthcheck` com `redis-cli ping`. Base: docker-compose.yml.

- `ollama`: executa o runtime do modelo local e compartilha o volume `ollama_data`. No arquivo versionado, ele não expõe porta para o host; sua comunicação principal é interna à rede do Compose. Base: docker-compose.yml.

- `ollama-init`: é um job de bootstrap que espera o serviço `ollama` ficar saudável, usa `OLLAMA_HOST=ollama:11434`, faz `ollama pull ${OLLAMA_MODEL}` e termina com sucesso. Base: docker-compose.yml.

- `api`: sobe a aplicação Fastify na porta `3001`, injeta `OLLAMA_BASE_URL=http://ollama:11434/v1`, `REDIS_URL=redis://redis:6379` e depende de `redis`, `ollama` e `ollama-init`. Base: docker-compose.yml, Dockerfile.

- `web`: gera o bundle do Vite, serve com Nginx na porta `3000:80` e injeta `VITE_API_URL=http://localhost:3001` como argumento de build. Ele depende da API já iniciada. Base: docker-compose.yml, Dockerfile.

- Redes e dependências: não há redes customizadas declaradas; o repositório usa a rede padrão do Docker Compose, com resolução por nome de serviço. A API fala com `redis` e `ollama` pelos nomes dos serviços internos. Base: docker-compose.yml.

- Comunicação entre os componentes: navegador -> `web` em `localhost:3000`; frontend -> API em `http://localhost:3001`; API -> Redis em `redis://redis:6379`; API -> Ollama em `http://ollama:11434/v1`. Base: docker-compose.yml, App.tsx, main.ts.

- Papel do `ollama-init`: garantir que o modelo esteja baixado antes do início da API, usando a mesma variável `OLLAMA_MODEL` do backend e o mesmo volume persistente do Ollama. Base: docker-compose.yml, explicação adicional em README.md.

- Há uma inconsistência entre documentação e Compose: o README afirma disponibilidade do Ollama em `http://localhost:11434`, mas o docker-compose.yml versionado não declara `ports:` para o serviço `ollama`. Para a metodologia, o mais seguro é registrar que a comunicação confirmada em código é interna ao Compose; exposição em host precisa de confirmação manual. Base: docker-compose.yml, README.md.

## 3.10.3 Variáveis de ambiente

- `LLM_ADAPTER`: usada em main.ts. Valor relevante: `"stub"` ativa `StubLlmAdapter`; qualquer outro valor, ou ausência, usa `OllamaLlmAdapter`. Impacto: troca total da implementação de LLM usada pela API. Exemplo em .env.example: “não identificado no repositório”; essa variável é usada no código, mas não aparece no exemplo de .env.example.

- `OLLAMA_BASE_URL`: usada em ollama-llm.adapter.ts e definida no Compose em docker-compose.yml. Valor esperado ou default em código: `http://localhost:11434/v1`. Exemplo em .env.example: `http://localhost:11434/v1`. Impacto: endpoint HTTP compatível com OpenAI usado pelo adapter real.

- `OLLAMA_MODEL`: usada em ollama-llm.adapter.ts, docker-compose.yml, README.md, .env.example e no arquivo local .env do repositório. Há divergência entre fontes: default em código `llama3.1:8b`, exemplo/Compose `gemma3:4b`, .env local `gemma3:4b`. Impacto: escolhe o modelo executado pelo Ollama e também o modelo baixado por `ollama-init`. Para a metodologia, a versão exata do modelo precisa de confirmação manual.

- `OLLAMA_API_KEY`: usada em ollama-llm.adapter.ts, docker-compose.yml e .env.example. Valor esperado/default: `ollama`. Impacto: autenticação do cliente OpenAI contra o endpoint compatível do Ollama.

- `REDIS_URL`: usada em main.ts e no Compose em docker-compose.yml. Valor esperado/default em código: `redis://localhost:6379`; no Compose: `redis://redis:6379`. Impacto: define a conexão do `HistoryService`. Observação: a variável é citada no README, mas não aparece em .env.example.

- `PORT`: usada em main.ts e em docker-compose.yml. Valor esperado/default: `3001`. Impacto: porta de escuta da API.

- `HOST`: usada em main.ts e em docker-compose.yml. Valor esperado/default: `0.0.0.0`. Impacto: interface de bind da API.

- `VITE_API_URL`: usada em App.tsx, em .env.example, em Dockerfile e no build args de docker-compose.yml. Valor esperado/default: `http://localhost:3001`. Impacto: endpoint que o frontend usa para `POST /mensagem`.

- `VITE_LOOKER_EMBED_URL`: usada em App.tsx, .env.example e Dockerfile. Exemplo: `https://datastudio.google.com/embed/reporting/your-report-id/page/p_1`. Impacto: URL inicial do `iframe`. Observação: o Compose atual não passa esse argumento no build do `web`, então o container depende do fallback hardcoded do frontend, a menos que o build seja ajustado manualmente.

- `RUN_REAL_LLM_TESTS`: usada em application.real-llm.spec.ts e ativada pelo target `test-real-llm` em project.json. Valor esperado: `"true"`. Impacto: habilita a suíte de testes de integração com LLM real.

- `INTENT_SCHEMA_VERSION`: usada em schema-registry.ts. Valor default: `v1`. Impacto nominal: selecionar a versão ativa do schema registry. Observação importante: essa variável existe, mas “não identificado no repositório” uso dela dentro do fluxo principal atual de `resolveDashboardAction`; ela aparece ligada ao registry utilitário e aos testes, não ao pipeline ativo.

- `OLLAMA_HOST`: usada apenas por `ollama-init` em docker-compose.yml. Valor: `ollama:11434`. Impacto: permite ao job de bootstrap falar com o serviço `ollama` dentro da rede do Compose.

- `NVIDIA_VISIBLE_DEVICES`: usada em docker-compose.gpu.yml. Valor: `all`. Impacto: expõe todas as GPUs NVIDIA ao container do Ollama no modo GPU.

- `NVIDIA_DRIVER_CAPABILITIES`: usada em docker-compose.gpu.yml. Valor: `compute,utility`. Impacto: declara as capacidades de driver necessárias ao uso de GPU pelo container do Ollama.

## 3.10.4 Uso opcional de GPU

- Existe um arquivo específico de override para GPU: docker-compose.gpu.yml.

- O único serviço afetado por esse override é `ollama`. Base: docker-compose.gpu.yml.

- Em relação à execução sem GPU, o override adiciona `gpus: all` e as variáveis `NVIDIA_VISIBLE_DEVICES=all` e `NVIDIA_DRIVER_CAPABILITIES=compute,utility`. Base: docker-compose.gpu.yml.

- O uso esperado é combinar o compose base e o override, conforme documentado no README. Base: README.md, docker-compose.gpu.yml.

- O README explicita dependência de host com GPU NVIDIA, drivers instalados e `nvidia-container-toolkit` configurado. Base: README.md.

- Não há lógica de GPU no código TypeScript da aplicação; a diferença fica toda na infraestrutura de container. Base: docker-compose.gpu.yml, main.ts, ollama-llm.adapter.ts.

## 3.10.5 Scripts do projeto

- `dev`: no root package.json, executa `pnpm -r --parallel --filter api --filter web dev`. Serve para subir web e API em desenvolvimento. Base: package.json.

- `build`: no root package.json, executa `pnpm -r --filter api --filter web build`. Serve para gerar o build das duas aplicações. Base: package.json.

- `typecheck`: no root package.json, executa `pnpm -r build`. Na prática, o projeto usa os builds dos projetos como verificação de tipos. Base: package.json.

- `lint`: no root package.json, executa `pnpm -r lint`. Serve para rodar ESLint no workspace. Base: package.json.

- `test`: no root package.json, executa `pnpm -r test`. Serve para rodar as suítes Vitest configuradas por projeto. Base: package.json.

- `clean:artifacts`: no root package.json, executa `node tools/clean-artifacts.mjs`. Serve para remover artefatos gerados no workspace. Base: package.json, clean-artifacts.mjs.

- Outros scripts relevantes do package.json: `dev` usa `tsx watch src/main.ts`; `build` compila com `tsc -p tsconfig.json`; `start` roda `node dist/apps/api/src/main.js`; `test` usa `vitest run --passWithNoTests --config vitest.config.ts`. Base: package.json.

- Outros scripts relevantes do package.json: `dev` usa `vite`; `build` executa `tsc --noEmit -p tsconfig.json && vite build`; `preview` usa `vite preview`; `test` usa `vitest run --passWithNoTests`. Base: package.json.

- Alvo adicional relevante em package.json, importante para metodologia de validação: `test-real-llm` em package.json, que executa a suíte real com `RUN_REAL_LLM_TESTS=true`.

# Síntese final

1. Estão bem claras no código e podem ser escritas com segurança na metodologia: os cinco estados da solicitação, os quatro `informationType`, os dois filtros suportados, o fluxo `rotas -> resolveDashboardAction -> routeResponse -> provider`, o uso do `LookerProvider` via `open_url`, o `conversationId` em `localStorage` e header `x-conversation-id`, o armazenamento do histórico em Redis com chave `history:{conversationId}`, o limite de contexto por turno e o TTL de 1800 segundos. Esses pontos estão sustentados por código e por testes em resolve-dashboard-action.shared.ts, response-router.spec.ts, curiosity-matcher.spec.ts, rotas.spec.ts, domain.spec.ts, contracts.spec.ts e history-summarizer.spec.ts. Os testes selecionados que executei passaram sem falhas reportadas.

2. Dependem de confirmação manual ou merecem cautela por divergência interna: a versão exata do modelo Ollama usada na prática, porque há conflito entre código, exemplos e .env; a exposição do Ollama para o host no Docker Compose, porque o README afirma `localhost:11434` e o compose versionado não expõe essa porta; a descrição do histórico do assistente, porque o comentário do `HistoryService` fala em JSON bruto, mas a rota persiste resumo textual; o papel operacional de `INTENT_SCHEMA_VERSION`, porque o registry existe, mas não está ligado ao fluxo principal atual; e qualquer menção a `apply_filters` como comportamento real da integração Looker, porque esse tipo existe no domínio, mas não é emitido pelos providers ativos.

3. Os arquivos que merecem mais atenção na escrita são policy.ts, resolve-dashboard-action.usecase.ts, response-router.ts, response-builder.ts, request-state.schema.ts, intent.v1.schema.ts, dashboard-action.schema.ts, looker-provider.ts, App.tsx, rotas.ts, history.service.ts, main.ts, docker-compose.yml e docker-compose.gpu.yml.

4. Os pontos que valem ser tratados como limitação metodológica são: o domínio analítico é fechado em quatro recortes e dois filtros; `municipio` é texto livre e não é validado contra uma lista oficial; a integração com Looker é indireta, baseada em troca de URL e `params`, sem controle interno do `iframe`; o mapeamento de páginas e parâmetros é manual; o histórico é curto, resumido e armazena intent resumida, não a ação final completa; não há tratamento explícito de falha de Redis na rota; o frontend atual não executa `run_query`; e não há testes dedicados para web nem para providers, apenas cobertura indireta via aplicação/API.

5. Checklist do que transformar em texto acadêmico:
   1. Para 3.6, descrever formalmente os estados, os quatro recortes analíticos, os dois filtros, os valores canônicos de `classificacao`, a ausência de lista canônica de municípios e o comportamento para casos vagos, incompletos ou fora do escopo.
   2. Para 3.7, narrar o pipeline em quatro etapas efetivas do código atual, separando classificação, extração, normalização, decisão determinística, geração da ação e mensagem amigável, e deixando claro onde há fallback e onde a confiança mínima é aplicada.
   3. Para 3.8, explicar que a integração Looker acontece por `iframe` e `open_url`, detalhar `baseUrl`, `informationTypeMap`, `paramMap`, o parâmetro `params` em JSON e o comportamento do frontend para cada `DashboardAction`.
   4. Para 3.9, registrar a criação e persistência do `conversationId`, o uso do Redis, a chave `history:{conversationId}`, o limite por turno, o TTL renovável e o fato de o histórico armazenar resumo textual do intent anterior.
   5. Para 3.10, separar claramente execução local e execução com Compose, listar variáveis de ambiente com defaults/exemplos, explicar o papel do `ollama-init`, diferenciar CPU e GPU e citar as divergências que precisam de validação manual antes da redação final.