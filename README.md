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
git clone https://github.com/GoncaloCoimbra/full-stack-distributed-commerce.git
cd full-stack-distributed-commerce
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

Para uma visão geral, arranque e testes do módulo de comunicação, consulte o [README do ChatOps](./Chatops/README.md).

## Docker Compose

### Estado de estabilidade e validação

A stack Docker foi ajustada para evitar falhas causadas pelas restrições de pull anónimo do Docker Hub. As imagens dos serviços de dados foram substituídas por equivalentes públicos em `public.ecr.aws/docker/library/...`, mantendo a mesma versão principal e sem alterar a lógica da aplicação. Esta mudança foi aplicada ao Compose da raiz e às stacks produtivas/compatibilidade relevantes, mantendo a execução local compatível com o arquivo `.env` real.

Também foi validada a sincronização do lockfile de dependências: o projeto foi corrigido para que `npm ci` funcione corretamente tanto na raiz como no módulo de logística, sem necessidade de alterar a aplicação em si. A verificação foi feita com a stack real e os serviços iniciaram em estado saudável.

### Desenvolvimento integrado

O Compose carrega automaticamente `docker-compose.override.yml` quando se executa o ficheiro base:

```sh
cp .env.example .env
# Substitui todos os valores replace-with-* por credenciais locais únicas.
docker compose config
docker compose up --build
```

O Compose exige autenticação em MongoDB e Redis e credenciais definidas para as bases de dados e serviços auxiliares. As portas de desenvolvimento são publicadas apenas em `127.0.0.1`. O ficheiro base define MongoDB, Redis, PostgreSQL para os três serviços, ClickHouse e a API Commerce; a sobreposição acrescenta ChatOps, Logística e as respetivas interfaces.

MongoDB cria o utilizador root apenas quando inicializa um volume de dados vazio. Para um volume já existente, não apagues nem recries dados: faz backup e configura a autenticação/utilizador com um procedimento de migração aprovado antes de apontar `MONGODB_URI` autenticado para essa instância.

### Staging

`docker-compose.staging.yml` é uma sobreposição ao ficheiro base, não uma stack autónoma:

```sh
docker compose -f docker-compose.yml -f docker-compose.staging.yml config
docker compose -f docker-compose.yml -f docker-compose.staging.yml up --build
```

Antes de executar, define `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `CLICKHOUSE_PASSWORD`, `TYPESENSE_API_KEY`, `JWT_SECRET` e `JWT_REFRESH_SECRET` no ambiente ou no ficheiro `.env` local. A interpolação usa expressões obrigatórias: se faltar uma destas variáveis, o Compose termina com erro em vez de usar uma credencial de staging predefinida.

### Produção

`docker-compose.prod.yml` define uma stack independente. O ficheiro `.env` é usado para interpolação e também carregado no backend:

```sh
docker compose --env-file .env -f docker-compose.prod.yml config
docker compose --env-file .env -f docker-compose.prod.yml up --build
```

Em produção são obrigatórias as credenciais de MongoDB, PostgreSQL, Redis, ClickHouse, Typesense e JWT usadas pela stack; consulta [.env.example](./.env.example) para a lista completa de chaves. Substitui todos os valores `replace-with-*` por segredos fortes, únicos e URL-safe antes de iniciar.
O backend de produção publica a API apenas em `127.0.0.1:3001`; expõe tráfego externo através de um reverse proxy com TLS e regras de acesso apropriadas.

### Redis e portas dos serviços de dados

Na stack integrada, o Redis exige autenticação. `REDIS_PASSWORD` configura o servidor e é usada para construir o URL Redis dos três serviços — Commerce, ChatOps e Logística. A variável é obrigatória em todas as configurações Compose; o mesmo valor tem de ser usado pelos três clientes para preservar o acesso a locks de stock e eventos partilhados.

As portas publicadas dos serviços de dados estão limitadas a loopback:

| Serviço | Porta no host |
| --- | ---: |
| MongoDB | 27017 |
| Redis | 6379 |
| PostgreSQL Commerce | 5435 |
| PostgreSQL Logística | 5433 |
| PostgreSQL ChatOps | 5434 |
| ClickHouse HTTP | 8123 |
| ClickHouse nativo | 9000 |

Esta restrição aplica-se às configurações Compose da raiz. Os Compose autónomos de ChatOps e Logística têm instâncias próprias; consulta os respetivos ficheiros antes de os usar.

## Desempenho e teste de capacidade

Foi executado um ensaio local de 30 minutos com 100 utilizadores virtuais e um catálogo de 100.000 produtos (350 produtos copiados da base local e 99.650 sintéticos), usando uma stack Docker isolada com limites explícitos de CPU e memória. O ensaio completou 189.525 pedidos (105,22 pedidos/s), sem erros HTTP.

| Rota | P95 observado |
| --- | ---: |
| Listagem de produtos | 1.082,3 ms |
| Categorias | 720,4 ms |
| Detalhe do produto | 834,7 ms |
| Pesquisa | 982,6 ms |

O objetivo usado no ensaio era P95 ≤1 s por rota e taxa de erro ≤0,1%: categorias, detalhe, pesquisa e taxa de erros cumpriram-no; a listagem ficou 82,3 ms acima do limite. Estes resultados descrevem um teste local controlado, não uma certificação de produção nem uma previsão de tráfego real. Os dados completos e a análise das métricas estão em [backend/docs/capacity/2026-10-08-200847-full-30min-100vu-summary.md](./backend/docs/capacity/2026-10-08-200847-full-30min-100vu-summary.md); o procedimento e os limites da stack estão documentados em [backend/README.md](./backend/README.md).

## Estado e limitações

- O ChatOps autentica com contas do Commerce através de sessão protegida por cookie; Commerce e ChatOps têm de partilhar o mesmo `JWT_SECRET`. A antiga rota `/auth/dev-token` não está disponível.
- O ChatOps mantém ligações WebSocket, metadados de ligação e estado de canais em memória do processo; esse estado não é partilhado entre réplicas e perde-se quando o processo termina.
- As migrações Prisma do ChatOps estão versionadas em `Chatops/backend/prisma/migrations`. Confirma o estado e a compatibilidade da base de dados antes de as aplicar a uma instalação existente.
- Chamadas de áudio/vídeo e partilha de ecrã usam WebRTC; as salas e a sinalização dependem do processo backend ativo. Um reinício ou uma falha abrupta termina as chamadas em curso. Para redes restritivas, é necessário configurar e testar um serviço TURN real.
- MongoDB, PostgreSQL, Redis e ClickHouse são executados como instâncias únicas nas configurações Compose; não está configurada uma topologia de alta disponibilidade.
- O MongoDB do Compose exige autenticação root inicializada num volume de dados vazio; a aplicação deve usar a URI autenticada definida em `MONGODB_URI`.
- O Compose autónomo de ChatOps monta `./pgdata` para `/var/lib/postgresql/data`. Esse bind mount contém os dados locais da base de dados; preserva-o e não o apagues como parte de uma limpeza do repositório.
- Os manifests Kubernetes estão presentes, mas não foram validados num cluster Kubernetes real. Os deployments usam imagens `:local`, dependem de as imagens existirem nos nós e não constituem um pipeline de publicação. O Ingress ChatOps está preparado para o host `chatops.local`; use TLS e configuração de produção antes de expor a stack fora de um ambiente local.
- As imagens Docker da Logística foram construídas localmente com os comandos indicados em [docs/DEPLOYMENT.md](./logistica-multi-tenant-clean/docs/DEPLOYMENT.md); os manifests Kubernetes continuam por validar em cluster.

## Seeds e credenciais

O seed da Logística em `logistica-multi-tenant-clean/backend-nest/prisma/seed.ts` exige credenciais através de `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`, `DEMO_ADMIN_PASSWORD`, `DEMO_OPERATOR_PASSWORD` e `DEMO_USER_PASSWORD`. Define valores fortes apenas no ambiente de execução; não uses nem publiques passwords de demonstração.
