# Tranzor Platform

Plataforma composta por três serviços: Commerce, para operações de comércio eletrónico; ChatOps, para comandos e comunicação em tempo real; e Logística, para gestão logística multi-tenant. Este repositório inclui os respetivos serviços, aplicações frontend, configurações Docker Compose e manifests Kubernetes.

## Tecnologias e componentes

| Componente | Implementação confirmada |
| --- | --- |
| Commerce | Node.js, TypeScript, Express, Prisma, PostgreSQL, MongoDB, Redis e ClickHouse |
| Frontend Commerce | React e Vite |
| ChatOps | Node.js, TypeScript, Fastify, WebSocket, Prisma e Redis |
| Logística | NestJS, Prisma, PostgreSQL e Redis |
| Frontend Logística | React Scripts (Create React App) |
| Execução local | Docker Compose |

## Obter o código

```sh
git clone https://github.com/GoncaloCoimbra/tranzor-platform.git
cd tranzor-platform
```

## Estrutura do repositório

```text
backend/                         API Commerce
frontend/                        Aplicação web Commerce
Chatops/backend/                 Serviço ChatOps
Chatops/frontend/                Interface ChatOps
logistica-multi-tenant-clean/
  backend-nest/                  API Logística e schema Prisma
  frontend/                      Interface Logística
  docs/                          Documentação do módulo
docker-compose.yml               Serviços de dados e API Commerce
docker-compose.override.yml      Serviços de desenvolvimento integrados
docker-compose.staging.yml       Sobreposição de configuração de staging
docker-compose.prod.yml          Stack Compose de produção
k8s/                             Manifests Kubernetes
```

Documentação por serviço: [Commerce](./backend/README.md), [ChatOps](./Chatops/backend/README.md), [Logística](./logistica-multi-tenant-clean/README.md) e [guia de deployment da Logística](./logistica-multi-tenant-clean/docs/DEPLOYMENT.md).

## Docker Compose

### Desenvolvimento integrado

O Compose carrega automaticamente `docker-compose.override.yml` quando se executa o ficheiro base:

```sh
docker compose config
docker compose up --build
```

O ficheiro base define MongoDB, Redis, PostgreSQL para os três serviços, ClickHouse e a API Commerce. A sobreposição acrescenta os serviços ChatOps e Logística e respetivas interfaces.

Há uma colisão de portas publicada na configuração atual: a API Commerce e a interface de Logística tentam ambas usar a porta de host `3001`. A validação `docker compose config` confirma a sintaxe e a interpolação, mas não confirma que serviços com portas em conflito conseguem arrancar simultaneamente.

### Staging

`docker-compose.staging.yml` é uma sobreposição ao ficheiro base, não uma stack autónoma:

```sh
docker compose -f docker-compose.yml -f docker-compose.staging.yml config
docker compose -f docker-compose.yml -f docker-compose.staging.yml up --build
```

Antes de executar, define `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `CLICKHOUSE_PASSWORD`, `JWT_SECRET` e `JWT_REFRESH_SECRET` no ambiente ou no ficheiro `.env` local. A interpolação usa expressões obrigatórias: se faltar uma destas variáveis, o Compose termina com erro em vez de usar uma credencial de staging predefinida.

### Produção

`docker-compose.prod.yml` define uma stack independente. O ficheiro `.env` é usado para interpolação e também carregado no backend:

```sh
docker compose --env-file .env -f docker-compose.prod.yml config
docker compose --env-file .env -f docker-compose.prod.yml up --build
```

Em produção são obrigatórias `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `CLICKHOUSE_PASSWORD`, `JWT_SECRET` e `JWT_REFRESH_SECRET`. Os valores de `.env.example` são apenas placeholders: substitui-os por segredos fortes antes de qualquer utilização fora de desenvolvimento.

### Redis e portas dos serviços de dados

Na stack integrada, o Redis exige autenticação. `REDIS_PASSWORD` configura o servidor e é usada para construir o URL Redis dos três serviços — Commerce, ChatOps e Logística. Em desenvolvimento existe um valor de fallback local; staging e produção exigem a variável. O mesmo valor tem de ser usado pelos três clientes para preservar o acesso a locks de stock e eventos partilhados.

As portas publicadas dos serviços de dados estão limitadas a loopback:

| Serviço | Porta no host |
| --- | ---: |
| MongoDB | 27017 |
| Redis | 6379 |
| PostgreSQL Commerce | 5432 |
| PostgreSQL Logística | 5433 |
| PostgreSQL ChatOps | 5434 |
| ClickHouse HTTP | 8123 |
| ClickHouse nativo | 9000 |

Esta restrição aplica-se às configurações Compose da raiz. Os Compose autónomos de ChatOps e Logística têm instâncias próprias; consulta os respetivos ficheiros antes de os usar.

## Estado e limitações

- O endpoint ChatOps `/auth/dev-token` emite um token de desenvolvimento fora de `NODE_ENV=production`; em produção responde como não encontrado. Não existe ainda um fluxo de autenticação de produção documentado para ChatOps.
- O ChatOps mantém ligações WebSocket, metadados de ligação e estado de canais em memória do processo; esse estado não é partilhado entre réplicas e perde-se quando o processo termina.
- O schema Prisma do ChatOps está no repositório, mas não existe histórico de migrações Prisma versionadas em `Chatops/backend/prisma/migrations`.
- MongoDB, PostgreSQL, Redis e ClickHouse são executados como instâncias únicas nas configurações Compose; não está configurada uma topologia de alta disponibilidade.
- O MongoDB do Compose não tem autenticação configurada.
- O Compose autónomo de ChatOps monta `./pgdata` para `/var/lib/postgresql/data`. Esse bind mount contém os dados locais da base de dados; preserva-o e não o apagues como parte de uma limpeza do repositório.
- Os manifests Kubernetes estão presentes, mas não foram validados num cluster Kubernetes real. A validação de configuração ou a construção de imagens não substitui um ensaio de deployment num cluster.
- As imagens Docker da Logística foram construídas localmente com os comandos indicados em [docs/DEPLOYMENT.md](./logistica-multi-tenant-clean/docs/DEPLOYMENT.md); os manifests Kubernetes continuam por validar em cluster.

## Seeds e credenciais

O seed da Logística em `logistica-multi-tenant-clean/backend-nest/prisma/seed.ts` exige credenciais através de `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`, `DEMO_ADMIN_PASSWORD`, `DEMO_OPERATOR_PASSWORD` e `DEMO_USER_PASSWORD`. Define valores fortes apenas no ambiente de execução; não uses nem publiques passwords de demonstração.
