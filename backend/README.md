# Backend Commerce

API de comércio eletrónico em Node.js e TypeScript, construída com Express. Usa Prisma para PostgreSQL e Mongoose para MongoDB; o código e a configuração do serviço estão neste diretório.

## Desenvolvimento local

```sh
npm install
npx prisma generate
npm run dev
```

Os scripts `build`, `start`, `test`, `test:e2e`, `prisma:migrate` e `prisma:seed` estão definidos em `package.json`. A API usa a porta `3001` por omissão. As rotas de estado incluem `GET /health`, `GET /readyz` e `GET /livez`; `GET /metrics` expõe métricas Prometheus.

## Docker Compose

O [Compose da raiz](../docker-compose.yml) configura a API Commerce, MongoDB, Redis, ClickHouse e os serviços PostgreSQL usados pelos módulos. O Compose carrega automaticamente [docker-compose.override.yml](../docker-compose.override.yml) em desenvolvimento:

```sh
docker compose config
docker compose up --build
```

O [Compose de staging](../docker-compose.staging.yml) é uma sobreposição ao ficheiro base. O [Compose de produção](../docker-compose.prod.yml) é uma configuração independente e carrega `.env` no backend.

Staging e produção exigem `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `CLICKHOUSE_PASSWORD`, `JWT_SECRET` e `JWT_REFRESH_SECRET`. O Compose termina com erro quando falta uma variável marcada como obrigatória. Usa valores fortes, únicos e fornecidos fora do controlo de versões; [.env.example](../.env.example) contém placeholders, não credenciais de produção.

Na stack integrada, `REDIS_PASSWORD` configura o serviço Redis e é usada para construir os URLs Redis de Commerce, ChatOps e Logística. Os três clientes têm de usar a mesma password para partilhar locks de stock e eventos.

As portas publicadas dos serviços de dados estão limitadas a `127.0.0.1`. A API Commerce publica `3001`; na configuração integrada, a interface de desenvolvimento da Logística também publica a porta de host `3001`, pelo que ambas não conseguem usar essa porta simultaneamente. O README da raiz descreve essa colisão.

## Construção da imagem

O [Dockerfile](./Dockerfile) instala dependências, gera o cliente Prisma e compila a aplicação. No arranque da imagem, executa `prisma generate` e `prisma migrate deploy` antes de iniciar o servidor.

```sh
docker build -t tranzor-backend:local ./backend
```

## Estado e limitações

- O MongoDB da stack Compose não tem autenticação configurada.
- MongoDB, PostgreSQL, Redis e ClickHouse são instâncias únicas nas configurações Compose; não está configurada alta disponibilidade.
- O Redis integrado é autenticado por `REDIS_PASSWORD`; não uses uma password diferente nos clientes que comunicam com a mesma instância.
- Os manifests Kubernetes estão presentes em `k8s/`, mas não foram validados num cluster Kubernetes real.
- O ChatOps continua a ter limitações próprias: `/auth/dev-token` é apenas para desenvolvimento, não há migrações Prisma versionadas e parte do estado é mantida em memória. O Compose autónomo ChatOps também mantém o bind mount `Chatops/pgdata` para os dados PostgreSQL.
