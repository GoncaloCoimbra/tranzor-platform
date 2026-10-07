# Backend Commerce

API de comércio eletrónico em Node.js e TypeScript, construída com Express. Usa Prisma para PostgreSQL e Mongoose para MongoDB; o código e a configuração do serviço estão neste diretório.

## Desenvolvimento local

```sh
npm install
npx prisma generate
npm run dev
```

Os scripts `build`, `start`, `test`, `test:e2e`, `prisma:migrate` e `prisma:seed` estão definidos em `package.json`. A API usa a porta `3001` por omissão. As rotas de estado incluem `GET /health`, `GET /readyz` e `GET /livez`; `GET /metrics` expõe métricas Prometheus. `tranzor_http_request_duration_ms` mede a latência total do pedido por rota correspondida; `tranzor_shop_operation_duration_ms` separa operações de catálogo, cache, Typesense, hidratação e escritas de visualizações. `tranzor_mongodb_command_duration_ms` mede a duração observada pelo driver MongoDB e `tranzor_mongodb_pool_checkout_duration_ms` mede a espera para obter uma ligação do pool. As métricas não expõem documentos nem parâmetros de consulta.

No arranque, MongoDB e Redis (e PostgreSQL quando `DATABASE_URL` está configurado) são verificados com cinco tentativas por omissão; `ALLOW_DEGRADED=true` permite continuar sem uma dependência e `STARTUP_MAX_ATTEMPTS`/`STARTUP_RETRY_DELAY_MS` configuram as tentativas e o backoff.

O endpoint `GET /api/v1/shop/products` mantém a resposta completa por omissão. As interfaces de cartões podem pedir `?view=summary` para receber apenas os campos usados na listagem; a paginação e os preços mantêm-se iguais, e o detalhe continua disponível no endpoint de produto.

## Docker Compose

O [Compose da raiz](../docker-compose.yml) configura a API Commerce, MongoDB, Redis, ClickHouse e os serviços PostgreSQL usados pelos módulos. O Compose carrega automaticamente [docker-compose.override.yml](../docker-compose.override.yml) em desenvolvimento:

```sh
docker compose config
docker compose up --build
```

O [Compose de staging](../docker-compose.staging.yml) é uma sobreposição ao ficheiro base. O [Compose de produção](../docker-compose.prod.yml) é uma configuração independente e carrega `.env` no backend.

Staging e produção exigem `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `CLICKHOUSE_PASSWORD`, `TYPESENSE_API_KEY`, `JWT_SECRET` e `JWT_REFRESH_SECRET`. O Compose termina com erro quando falta uma variável marcada como obrigatória. Usa valores fortes, únicos e fornecidos fora do controlo de versões; [.env.example](../.env.example) contém placeholders, não credenciais de produção.

Na stack integrada, `REDIS_PASSWORD` configura o serviço Redis e é usada para construir os URLs Redis de Commerce, ChatOps e Logística. Os três clientes têm de usar a mesma password para partilhar locks de stock e eventos.

As portas publicadas dos serviços de dados estão limitadas a `127.0.0.1`. A API Commerce publica `3001`; a interface de desenvolvimento integrada da Logística publica `3003`.

## Construção da imagem

O [Dockerfile](./Dockerfile) instala dependências, gera o cliente Prisma e compila a aplicação. No arranque da imagem, executa `prisma generate` e `prisma migrate deploy` antes de iniciar o servidor.

```sh
docker build -t tranzor-backend:local ./backend
```

## Pesquisa e testes de capacidade

Com `TYPESENSE_HOST` e `TYPESENSE_API_KEY` configurados, Typesense ordena os resultados por relevância e fornece o total exato; MongoDB continua a ser a fonte de verdade e serve de fallback com aviso registado quando Typesense está indisponível. Define uma chave forte fora do controlo de versões. Para reindexar o catálogo existente, compila e executa `npm run search:reindex`.

O ficheiro [docker-compose.capacity.yml](../docker-compose.capacity.yml) cria serviços MongoDB, Redis e Typesense isolados, com limites explícitos de memória e CPU. `CAPACITY_MONGO_CPUS` e `CAPACITY_API_CPUS` permitem comparar os limites de CPU desses serviços sem alterar a stack normal (predefinições: `1.5` e `1.0`). O harness recolhe as métricas do Docker de forma assíncrona para não bloquear a carga e mede a duração do soak com relógio monotónico; uma falha pontual de telemetria fica assinalada no relatório sem apagar os resultados de latência. Usa um projeto Compose dedicado e elimina apenas esse projeto depois do teste. A configuração é uma simulação local limitada, não equivale a staging/produção.

## Estado e limitações

- O MongoDB da stack Compose não tem autenticação configurada.
- MongoDB, PostgreSQL, Redis e ClickHouse são instâncias únicas nas configurações Compose; não está configurada alta disponibilidade.
- O Redis integrado é autenticado por `REDIS_PASSWORD`; não uses uma password diferente nos clientes que comunicam com a mesma instância.
- Os manifests Kubernetes estão presentes em `k8s/`, mas não foram validados num cluster Kubernetes real.
- O ChatOps autentica com contas do Commerce através de sessão protegida por cookie; Commerce e ChatOps têm de partilhar o mesmo `JWT_SECRET`. A antiga rota `/auth/dev-token` não está disponível.
- As migrações Prisma do ChatOps estão versionadas em `Chatops/backend/prisma/migrations`. As mensagens e os grupos são persistidos, mas presença, ligações WebSocket e salas de chamada dependem do processo backend e não são partilhados entre réplicas; as chamadas em curso não são recuperadas após reinício.
- Chamadas e partilha de ecrã usam WebRTC. Para redes restritivas pode ser necessário configurar e validar um servidor TURN; a configuração Kubernetes do ChatOps ainda não foi validada num cluster real.
- O Compose autónomo ChatOps monta `./pgdata` para `/var/lib/postgresql/data`; preserva essa pasta se os dados locais forem necessários.
