# Logística

Módulo de gestão logística multi-tenant. O repositório contém uma API NestJS com Prisma e PostgreSQL e uma aplicação web React.

## Componentes

| Caminho | Componente |
| --- | --- |
| `backend-nest/` | API NestJS em TypeScript, com Prisma |
| `frontend/` | Aplicação React e TypeScript com Vite |
| `backend-nest/prisma/` | Schema, migrações e seed Prisma |
| `../k8s/` | Manifests Kubernetes partilhados da plataforma |

O frontend usa Vite: `npm run start` inicia o servidor de desenvolvimento, `npm run build` executa o type-check e cria a build de produção, e `npm test` executa os testes Vitest.

## Arranque local com Docker Compose

O [Compose autónomo](./docker-compose.yml) define PostgreSQL, Redis, backend e frontend. A partir da raiz do repositório:

```sh
cp logistica-multi-tenant-clean/.env.example logistica-multi-tenant-clean/.env
docker compose --env-file logistica-multi-tenant-clean/.env -f logistica-multi-tenant-clean/docker-compose.yml config
docker compose --env-file logistica-multi-tenant-clean/.env -f logistica-multi-tenant-clean/docker-compose.yml up --build
```

O ficheiro usa o [Dockerfile do backend](./backend-nest/Dockerfile) com contexto na raiz deste módulo e o `frontend/Dockerfile.dev` para a interface em desenvolvimento. O ficheiro [.env.example](./.env.example) contém os valores de interpolação do Compose; substitui os placeholders antes de iniciar. O Compose não carrega automaticamente `backend-nest/.env`.

## Portas

| Configuração | Serviço | Porta publicada no host | Porta no container |
| --- | --- | ---: | ---: |
| Compose autónomo | API backend | 3002 | 3000 |
| Compose autónomo | Interface de desenvolvimento | 3001 | 3000 |
| Compose integrado da raiz | API através do proxy Nginx | 3000 | 3000 |
| Compose integrado da raiz | Interface de desenvolvimento | 3003 | 3000 |
| Imagem frontend de produção | Nginx | não publicada pelo Compose autónomo | 80 |

## Redis e bases de dados

O Compose autónomo cria uma instância própria de Redis e exige `POSTGRES_PASSWORD`, `REDIS_PASSWORD` e `JWT_SECRET`; não inicia com credenciais predefinidas. Copia [.env.example](./.env.example) para `.env` e substitui os placeholders. As portas publicadas no host estão limitadas a `127.0.0.1`.

Os avatares são guardados num volume persistente e só são servidos pela rota autenticada `GET /auth/avatar`; o diretório não é publicado como ficheiro estático.

Na stack integrada definida na raiz, Logística, ChatOps e Commerce partilham o mesmo Redis autenticado. Define uma única `REDIS_PASSWORD` para o servidor Redis e para os três URLs clientes. Não reutilizes credenciais de desenvolvimento em staging ou produção.

O Compose autónomo usa uma única instância PostgreSQL para o módulo. O Compose integrado usa um serviço PostgreSQL separado para Logística. Não está configurada alta disponibilidade para estas instâncias.

## Testes e construção

Na raiz de `logistica-multi-tenant-clean/`, instala as dependências e executa os testes:

```sh
npm ci
npm run --workspace=backend-nest test
npm run --workspace=frontend test
```

Para validar os builds TypeScript e Vite:

```sh
npm run --workspace=backend-nest build
npm run --workspace=frontend build
```

Os testes E2E do backend usam PostgreSQL e precisam de `DATABASE_URL` e das dependências externas configuradas:

```sh
npm run --workspace=backend-nest test:e2e
```

Os manifests Kubernetes partilhados estão em `../k8s/`. Foram documentados comandos de build e aplicação, mas não há validação desta stack num cluster Kubernetes real; a criação de uma imagem não comprova o arranque nem o comportamento da aplicação.

## Seed e dados

O seed está em [backend-nest/prisma/seed.ts](./backend-nest/prisma/seed.ts). Exige `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`, `DEMO_ADMIN_PASSWORD`, `DEMO_OPERATOR_PASSWORD` e `DEMO_USER_PASSWORD`; as passwords têm de passar a validação de força definida pelo código. Não existem passwords de demonstração para copiar deste README.

O seed executa `TRUNCATE` em várias tabelas antes de inserir os dados de exemplo. Não o executes numa base de dados que contenha dados a preservar.

## Estado e limitações

- As configurações Compose usam instâncias únicas de PostgreSQL e Redis; não fornecem alta disponibilidade.
- O MongoDB usado pela stack integrada da raiz exige autenticação root num volume inicializado; o Compose autónomo deste módulo não define MongoDB.
- O ChatOps autentica com contas do Commerce através de sessão protegida por cookie; Commerce e ChatOps têm de partilhar o mesmo `JWT_SECRET`. A antiga rota `/auth/dev-token` não está disponível.
- As migrações Prisma do ChatOps estão versionadas em `Chatops/backend/prisma/migrations`. Mensagens e grupos são persistidos; ligações WebSocket, presença e salas de chamada permanecem em memória do processo e não são partilhadas entre réplicas.
- Chamadas e partilha de ecrã usam WebRTC; as chamadas em curso não são recuperadas após reinício do backend. Para redes restritivas é necessário configurar e testar um servidor TURN. Os manifests Kubernetes do ChatOps ainda não foram validados num cluster real.
- O Compose autónomo ChatOps monta `Chatops/pgdata` como `./pgdata:/var/lib/postgresql/data`. Essa pasta contém dados locais PostgreSQL e não deve ser apagada durante a limpeza do repositório.
