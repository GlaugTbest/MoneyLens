# MoneyLens — auditoria e estratégia de hospedagem

Data: 15/09/2026. Revisão inicial em 14/09 e correções de escopo MVP aplicadas em 15/09. Nenhum serviço externo foi publicado.

## Parecer

A estrutura é adequada para um MVP: Next.js, NestJS, PostgreSQL e processamento assíncrono. As correções prioritárias de autorização, isolamento, sessões, webhooks, filas e feedback de interface foram implementadas para o sandbox. Hospedagem gratuita segue adequada apenas para demonstração privada; operação contínua exige atenção especial aos workers e à persistência.

## Escopo e limites da evidência

Inspecionados autenticação, controllers, serviços de contas/transações/conexões, integração Pluggy, webhook, filas, categorização/Gemini, cálculos de insights, schema e configuração de migrations, páginas e componentes do frontend, estilos, manifestos, Dockerfiles e documentação. A imagem de dashboard versionada foi inspecionada como referência histórica, não como prova de execução atual.

- `npm audit --omit=dev --json`: 13 pacotes afetados, sendo 4 altos, 8 moderados e 1 baixo; zero críticos. A contagem inclui dependências afetadas transitivamente, não 13 explorações demonstradas.
- Detector estático Impeccable em `apps/web/src`: nenhum achado automático. A leitura manual encontrou problemas fora da cobertura do detector.
- Contraste calculado diretamente das cores CSS: resultados abaixo.
- Não existem arquivos de testes/spec versionados encontrados nem pipeline de CI no checkout. A afirmação do README sobre testes multiusuário não é reproduzível com os arquivos fornecidos.
- `npm ci --ignore-scripts` concluiu após avisos de integridade e novas tentativas automáticas. Prisma Client gerado; `npm run build:api` e `npm run build:web` passaram. A saída da API foi confirmada em `dist/src/main.js`, incompatível com `start:prod` atual (`node dist/main`).
- Lint API falhou por ausência de `eslint.config.*`. Lint web reportou dois erros `react-hooks/set-state-in-effect`, em connections:61 e transactions:46. O achado de connections deve ser revisado: a escrita de estado ocorre depois de um await, portanto não prova por si só atualização síncrona problemática. Em transactions, `setData(null)` ocorre diretamente no effect.
- Testes integrados, execução das imagens Docker e navegação atual desktop/mobile não foram realizados. Build aprovado não prova autenticação, isolamento ou integrações em runtime.
- Sem credenciais de execução no checkout, não foram conectados bancos nem feitas chamadas autenticadas ao Pluggy/Gemini.

P1 = corrigir antes de publicação com dados reais; P2 = próxima etapa. Não identifiquei P0 demonstrado. As prioridades não substituem avaliação de explorabilidade de cada advisory de dependência.

## Segurança e isolamento

### S1 — P1: registro de conexão aceita item remoto sem prova de titularidade

`apps/api/src/connections/connections.service.ts:32`: `registerConnection` consulta o item remoto, executa upsert e enfileira sync antes de `getOwnedItem`. Para item já pertencente a outro usuário, o retorno é 403, mas os efeitos anteriores ocorreram. Para item remoto ainda não registrado localmente, quem souber seu ID pode reivindicá-lo. Não há vínculo de criação autenticada verificado no servidor.

Vincular a sessão de conexão ao usuário no backend, usando mecanismo suportado pelo agregador e validado no registro. Rejeitar item existente de outro titular antes de qualquer efeito. Testar dois usuários, item não registrado, callbacks repetidos e registro concorrente. Conhecer um ID é pré-condição; não foi demonstrada descoberta de IDs.

### S2 — P1: categoria manual de um usuário influencia outros

`apps/api/src/transactions/transactions.service.ts:70` grava escolhas MANUAL em `MerchantCategoryCache`, cuja chave é somente `normalizedMerchant`. `categorization.service.ts:52` consulta esse cache global antes das regras. Uma escolha pessoal passa a categorizar novas transações de outros usuários do mesmo estabelecimento.

Separar preferências pessoais por `(userId, normalizedMerchant)` do cache geral controlado pelo sistema. Não há evidência aqui de leitura direta de extratos alheios; trata-se de contaminação de resultados entre usuários. A atualização assíncrona também deve exigir que a categoria continue não manual no momento da escrita, evitando sobrescrever uma correção feita enquanto o job rodava.

### S3 — P1: desconexão declara sucesso sem garantir revogação

`connections.service.ts:81`: erro de `pluggy.deleteItem` é ignorado e o item local vira DELETED. Jobs já enfileirados e `syncItemStatus` não protegem esse estado e podem voltar a atualizá-lo. Transações e insights continuam incluindo itens DELETED, enquanto a listagem de contas os exclui.

Definir separadamente revogar conexão, manter histórico e apagar dados. Usar estado de revogação pendente com retry, bloquear jobs após remoção e tornar filtros consistentes. Mostrar o efeito ao usuário antes da ação; a tela atual remove imediatamente.

### S4 — P1: refresh token não é consumido atomicamente

`auth.service.ts:51`: duas requisições podem ler o mesmo token não revogado, revogá-lo e ambas emitir sucessores. A proteção `refreshInFlight` só coordena chamadas dentro de uma instância da página, não abas ou clientes externos.

Consumir condicionalmente o token e criar sucessor em transação; tratar reutilização e concorrência explicitamente. Logout revoga refresh tokens, mas o access JWT previamente emitido segue válido até expirar: definir se esse intervalo é aceitável ou adotar versão de sessão/revogação.

### S5 — P1: webhook grava dados antes de rejeitar autenticação

`webhooks.controller.ts:56`: payload inválido pode causar lookup e persistência antes do 401. A interface TypeScript não é DTO validado em runtime. `eventId` recebido não tem chave única para deduplicação.

Autenticar primeiro, validar estrutura/tamanho/eventos, persistir identificador externo único e garantir recuperação quando banco grava, mas Redis falha. Eventos recebidos antes do registro do item ficam sem FK e podem ser marcados processados sem sincronizar. Reconciliar pelo itemId original depois do registro. Em `transactions/deleted`, restringir IDs também ao item esperado; atualmente a atualização usa apenas IDs de transação.

### S6 — P1 para dados reais: exposição desnecessária de dados

Contas e transações devolvem modelos Prisma completos, incluindo `raw`; tipos TypeScript do frontend não removem campos da resposta. Há armazenamento de payloads bancários e descrições em cache global. Adotar `select`/DTO de resposta e política de retenção para raw, webhooks, logs e tokens expirados.

`gemini.service.ts` envia descrições e valores ao serviço externo. Para demonstração, usar dados sintéticos e considerar `ENABLE_LLM_CATEGORIZATION=false`. Antes de usar dados reais, minimizar/redigir identificadores e definir transparência, retenção e configuração contratual da API. Os termos do Gemini distinguem serviços gratuitos e pagos; no gratuito, conteúdo pode ser usado para melhorar produtos. [Termos oficiais](https://ai.google.dev/gemini-api/terms). Esta é uma avaliação técnica de fluxo de dados, não parecer jurídico.

### S7 — P1: atualizar dependências após triagem

O audit apontou severidade alta em `@nestjs/platform-express`, `js-yaml`, `lodash` e `multer`. Parte dos avisos depende de superfícies que não identifiquei expostas, como upload multipart. Fazer atualização compatível e testes, evitando `npm audit fix --force` sem revisar mudanças principais. Guardar o relatório bruto em CI e avaliar caminhos realmente alcançáveis.

### S8 — P2: endurecimento de autenticação e borda

Tokens também são retornados no corpo de login/register/refresh, embora o navegador use cookies HttpOnly. Reduzir esse retorno no fluxo web. Acrescentar validação de origem para mutações conforme a topologia final; SameSite=Lax já mitiga requisições cross-site comuns, portanto ausência de token CSRF isoladamente não demonstra exploração.

Configurar `trust proxy` conforme o número de proxies confiáveis e impedir spoofing de cabeçalhos na borda. O contador de rate limit atual é local por processo. Validar limites atrás do rewrite Next e em múltiplas instâncias. Normalizar e-mail, validar limite de senha compatível com bcrypt e planejar recuperação de acesso. Não encontrei recuperação de senha, confirmação de e-mail nem gestão de sessões.

## Confiabilidade e eficiência

### E1 — P1: jobs concluídos bloqueiam sincronizações futuras

`sync.service.ts:36` usa ID fixo por item/trigger para WEBHOOK e SCHEDULED_POLL, enquanto `sync.module.ts:10` retém 100 concluídos. Enquanto esse job existir, novas tentativas de adicioná-lo são ignoradas. Em instalação pequena, a fila pode parar de sincronizar aquele item por tempo indefinido. [Semântica oficial BullMQ](https://docs.bullmq.io/guide/jobs/job-ids).

Usar deduplicação apenas durante execução/espera e permitir novo ciclo após conclusão. Proteger também a concorrência entre triggers diferentes do mesmo item. Critério de aceite: dois webhooks separados por uma conclusão produzem duas sincronizações, e eventos simultâneos não causam escrita concorrente desnecessária.

### E2 — P1: retries anunciados no README não estão configurados

Queues têm retenção, mas não `attempts`/`backoff`. Os módulos HTTP Pluggy/Gemini não configuram timeout. Uma falha transitória pode deixar jobs falhos sem nova tentativa, e uma chamada pendurada ocupa worker. Configurar timeout, backoff com jitter, limites por fornecedor e recuperação observável. [Retries BullMQ](https://docs.bullmq.io/guide/retrying-failing-jobs).

Quando Gemini falha, retorna array vazio e a categoria vira Outros; a transação deixa de ser candidata pelo filtro `categoryId: null`. Separar fallback temporário de classificação final. Validar resposta do modelo com schema: índice dentro do lote, sem duplicação, categoria permitida e confiança finita entre 0 e 1.

### E3 — P1: sincronização parcial perde categorização

`runSync` só enfileira IDs criados na execução atual, depois de terminar todas as contas. Se falhar após inserir parte das transações, a próxima execução as considera existentes e elas podem ficar sem categoria indefinidamente. Reconciliar transações sem categoria independentemente de terem sido criadas neste job, ou usar outbox/checkpoints por lote.

### E4 — P2: releitura integral e consultas por transação

Cada sync percorre todo o histórico e faz `findUnique` + `upsert` sequenciais por transação. A categorização também busca cache e grava por linha. Isso aumenta latência, CPU do PostgreSQL e custo por conexão remota.

Preferir sincronização incremental/reconciliação conforme suporte Pluggy, buscar IDs/cache em lote e gravar em lotes limitados. Selecionar só os campos necessários. Medir duração, volume, p95 das rotas, crescimento de raw e conexões de banco antes de adicionar caches ou índices indiscriminadamente. `contains` pode exigir índice trigram com escala; paginação por cursor e desempate por ID evitam instabilidade em datas iguais.

### E5 — P1: indicadores financeiros têm semântica incorreta

`insights.service.ts:208` soma `averageAmount` e chama de total mensal, ignorando `intervalDays`. Despesa semanal e anual entram como mensais. Normalizar para estimativa mensal e explicitar a hipótese.

Dashboard usa último ponto disponível como “último mês”, sem preencher meses sem gastos. Pode comparar meses não consecutivos ou mês parcial com completo. Maiores categorias usa seis meses no dashboard, sem explicitar esse período. Insights completos usam todo o histórico. Tornar período visível e uniforme.

Agregações consideram todo valor negativo como gasto e ignoram moeda. Transferências internas/pagamentos de fatura podem distorcer consumo, e moedas diferentes não devem ser somadas como BRL. Definir modelo de despesa e tratamento de conta/cartão/transferência com fixtures antes de confiar nos totais.

### E6 — P2: recorrências e anomalias exigem reconciliação

Grupos que deixam de atingir os critérios podem permanecer ACTIVE porque o loop simplesmente os ignora. Marcar grupos não confirmados na recomputação. Anomalias consultam histórico sem limite superior; ao pedir mês passado, meses posteriores podem entrar na média. Meses zerados estão ausentes. Há mistura de início de mês local no Node com agregação PostgreSQL. Fixar calendário/timezone e janela semiaberta, testar virada do mês e dados sem movimento.

## Usabilidade e acessibilidade

Veredito de integridade: identidade visual coerente e específica ao produto, mas fluxos de erro ainda não passam para publicação. Notas abaixo são estimativas por código e imagem histórica, não certificação WCAG nem Lighthouse.

| Dimensão | Nota /4 | Evidência principal |
|---|---:|---|
| Acessibilidade | 2 | Contraste insuficiente e campos sem nome acessível |
| Performance de interface | 3 | Widget carregado sob demanda; solicitações antigas podem vencer buscas novas |
| Responsividade | 2 | Navegação mobile existente; tabela com rolagem e linhas rígidas |
| Temas | 3 | Tokens light/dark consistentes, alguns pares falham contraste |
| Integridade funcional | 1 | Falhas de API viram relatórios vazios aparentemente válidos |
| Total provisório | 11/20 | Melhorias significativas necessárias |

### U1 — P1: erros parecem ausência legítima de dados

`insights/page.tsx:20` transforma erro em relatório zerado e mostra “Nada fora do comum”. `transactions/page.tsx:52` mostra “Nenhuma transação”; `connections/page.tsx:61` mostra nenhuma conexão; dashboard pode manter skeleton para sempre. Distinguir loading, erro, vazio e sucesso; oferecer tentar novamente e informar última atualização. Comando sugerido: `$impeccable harden`.

### U2 — P1: sessão inválida pode prender o usuário

O proxy decide por presença do refresh cookie e redireciona login para dashboard. Se o token foi revogado em outro dispositivo, o refresh retorna 401, mas os cookies não são limpos nem há saída centralizada no cliente. Logout depende de autenticação; se falhar, navega para login mesmo com cookie presente. Implementar invalidação local via endpoint de limpeza de cookies e redirecionamento recuperável. Comando: `$impeccable harden`.

### U3 — P1: contraste calculado insuficiente para texto pequeno

`globals.css` e seus usos em dicas, rótulos do gráfico e botões:

- `#9a9ca4` sobre branco: 2,74:1.
- `#6c6e77` sobre `#1a1b1f`: 3,39:1.
- Branco sobre accent dark `#7b7bea`: 3,58:1.

Ficam abaixo de 4,5:1 para texto normal (WCAG 1.4.3). Ajustar tokens verificando ambos os temas. Comando: `$impeccable colorize`.

### U4 — P2: formulário, teclado e movimento

Busca e selects de categoria em `transactions/page.tsx` carecem de label/aria-label próprio; cabeçalho de tabela não nomeia automaticamente o select. Adicionar nomes por transação, alertas anunciados e `aria-current` na navegação. Skeleton anima indefinidamente sem alternativa reduced-motion. Botões de 28px são pequenos para toque; ampliar para cerca de 44px sem alegar que todo alvo abaixo de 44 viola WCAG AA. Comando: `$impeccable harden`.

### U5 — P2: ações e pesquisa precisam de feedback confiável

Busca tem debounce, mas não cancela requisição já iniciada; resposta antiga pode substituir filtro novo. PATCH de categoria não captura falha. Sincronização não apresenta estado pendente local e o polling depende apenas do status UPDATING do agregador, não do job local. Adicionar AbortController/controle de versão, estados pending/success/error e desabilitar repetição enquanto a operação está em curso. Comando: `$impeccable harden`.

### U6 — P2: mobile e entendimento do produto

Conexões tem título e CTA na mesma linha sem quebra adaptativa; linhas de categorias reservam larguras fixas que pressionam telas estreitas. A tabela tem `min-w-[560px]`: rolagem é intencional, mas cartões mobile podem facilitar leitura. Testar 320/390/768/1280px e zoom 200%, safe-area da navegação inferior, valores grandes e textos longos. Expor filtros de período/conta/categoria já existentes na API e identificar claramente modo sandbox. Comandos: `$impeccable adapt`, `$impeccable clarify`.

Pontos a preservar: cookies HttpOnly/Secure em produção, hash bcrypt, hash de refresh no banco, guard global, validação de DTOs comuns, SQL parametrizado, isolamento por usuário na maior parte das consultas, paginação limitada, Decimal no banco, labels de autenticação, foco global, gráfico com foco e descrição acessível, navegação móvel, tokens de tema, carregamento dinâmico do widget e endpoint consolidado de insights.

## Hospedagem: estratégia compatível com a arquitetura

O processo Nest inclui workers BullMQ e cron. Deve ficar ativo, inclusive sem visitantes. Um frontend estático sozinho não executa o sistema; Next depende do rewrite `/api`. Não converter a API para funções efêmeras sem redesenhar filas e agendamento.

| Caminho | Adequação | Limites e custos verificados |
|---|---|---|
| Oracle Cloud Always Free, VM + Docker | Melhor candidato a custo zero mantendo arquitetura | Disponibilidade regional pode faltar; instâncias ociosas podem ser recuperadas. Exige administrar SO, backups, TLS e atualizações. |
| Railway Hobby com web, API/workers, PostgreSQL e Redis | Caminho mais simples operacionalmente para piloto | US$5 mínimo com esse valor incluído em uso; consumo excedente é cobrado. Não significa stack inteira por US$5. |
| Vercel Hobby + servidor persistente para API | Bom frontend para demonstração pessoal | Hobby restrito a uso pessoal não comercial; API/workers, Redis e banco continuam necessários. |
| Render gratuito | Demonstração tolerante a interrupções | Web service dorme após 15 minutos; PostgreSQL gratuito expira em 30 dias. Cron e workers embutidos param com o processo. |
| Neon Free como banco externo | Alternativa para protótipo | 0,5 GB e 100 CU-h/mês por projeto na página consultada; raw/logs podem consumir armazenamento rapidamente. |

Fontes: [Oracle](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm), [Railway](https://railway.com/pricing), [Vercel](https://vercel.com/docs/plans/hobby), [Render](https://render.com/docs/free), [Neon](https://neon.com/pricing). Consultadas nesta revisão; confirmar no provisionamento. Railway também oferece teste de US$5/30 dias e depois US$1 mensal de crédito no Free, insuficiência para esta stack contínua é uma avaliação de arquitetura, não medição realizada.

### Recomendação gratuita para demonstração

VM Oracle elegível, com proxy HTTPS (por exemplo Caddy), Next, Nest com workers, PostgreSQL e Redis na mesma rede Docker. Somente entrada web/TLS pública; banco e Redis privados. Persistir PostgreSQL e Redis, configurar AOF e política noeviction apropriada às filas, backup criptografado fora da VM e restauração ensaiada. Confirmar compilação/execução ARM64 se usar Ampere. Evitar tamanho de VM escolhido apenas pelo máximo gratuito: medir o necessário. Se não houver capacidade gratuita, seguir para piloto pago ou demo com limitações explícitas.

### Recomendação de menor manutenção para piloto

Railway Hobby: um serviço Next, um Nest sempre ativo incluindo workers, PostgreSQL e Redis privados. Inicialmente uma réplica Nest para evitar cron duplicado. Subdomínios fornecidos pela plataforma dispensam comprar domínio nesta fase. Definir limite e alertas de consumo; observar custo real por uma semana e projetar mês. O mínimo de US$5 não é teto. Custos Pluggy, Gemini, domínio opcional e backups são separados; gratuidade do sandbox não comprova acesso gratuito a bancos reais.

### Ajustes concretos de implantação

1. Corrigir `config.service.ts:29`: REDIS_URL atualmente perde protocolo TLS `rediss:`, username e database index. Suportar URL completa/config equivalente e credenciais com encoding correto.
2. Definir NODE_ENV=production explicitamente nos serviços; os Dockerfiles não o fazem. Hoje o schema assume development, o que afeta cookies, docs e webhook.
3. Configurar BACKEND_URL durante build do Next; rewrite fica incorporado. Se build/execução exigirem topologias distintas, adaptar conscientemente. Manter navegador na mesma origem e validar cookies no domínio publicado.
4. Configurar webhook HTTPS estável com segredo, conferir headers realmente registrados e permitir atualização após rotação; o código atual ignora webhook já existente sem atualizar segredo.
5. Acrescentar health/readiness para API, banco e Redis, desligamento gracioso e métricas de fila/falhas. Migration deve ser etapa controlada de release; seed a cada boot aumenta acoplamento e chance de falha.
6. Criar Dockerfiles multi-stage, executar como usuário não root, retirar ferramentas de desenvolvimento da imagem final e adicionar `.dockerignore`. Alinhar `start:prod` (`dist/main`) com saída real esperada pelo Docker (`dist/src/main.js`); validar pelo build.
7. O Compose atual é local: expõe PostgreSQL e Redis, usa senha default e não persiste Redis. Não reutilizá-lo diretamente como implantação pública.
8. Versionar procedimento de backup/restore, rollback de aplicação e migração, limites de retenção e monitoramento de custo/armazenamento. Separar ambientes e credenciais de sandbox/produção.

## Sequência proposta e critérios de aceite

1. Segurança/isolamento: S1–S6, dependências e E1–E3. Provar com testes dois usuários, renovação simultânea, desconexão com erro externo, webhook duplicado e Redis temporariamente fora.
2. Correção funcional: fixtures para mensalização, meses zerados, transferências/cartões, timezone e retry após sync parcial. Simular falhas HTTP sem mostrar relatório válido zerado.
3. Interface: aplicar harden, colorize, adapt e clarify nos pontos documentados; finalizar com `$impeccable polish`. Rodar auditoria novamente após os ajustes. Essas etapas podem ser executadas separadamente ou em conjunto.
4. Build reproduzível: acompanhar os avisos de instalação sem desativar verificação, corrigir lint e start:prod, e rodar Prisma generate, builds, lint e testes em CI. Publicar somente sandbox após passar.
5. Piloto privado: decidir entre Oracle gratuito e Railway, medir carga/custo, executar restore, testar cookies e callbacks no endereço final. Depois avaliar abertura para dados reais e usuários externos.

Decisão sugerida: começar com sandbox privado, manter a arquitetura e priorizar confiabilidade. Oracle se custo zero for requisito; Railway se reduzir manutenção for mais importante. Não há necessidade de reescrever o sistema para iniciar esse piloto.
