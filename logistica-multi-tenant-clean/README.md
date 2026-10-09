# Logística

Módulo de gestão logística multi-tenant. O repositório contém uma API NestJS com Prisma e PostgreSQL e uma aplicação web React.

## Componentes

| Caminho | Componente |
| --- | --- |
| `backend-nest/` | API NestJS em TypeScript, com Prisma |
| `frontend/` | Aplicação React criada com React Scripts (Create React App) |
| `backend-nest/prisma/` | Schema, migrações e seed Prisma |
| `k8s/` | Manifests Kubernetes |

O frontend usa `react-scripts start` e `react-scripts build`, conforme os scripts do seu `package.json`; não é uma aplicação Vite.

## Arranque local com Docker Compose

O [Compose autónomo](./docker-compose.yml) define PostgreSQL, Redis, backend e frontend. A partir da raiz do repositório:

```sh
docker compose -f logistica-multi-tenant-clean/docker-compose.yml config
docker compose -f logistica-multi-tenant-clean/docker-compose.yml up --build
```

O ficheiro usa o [Dockerfile do backend](./backend-nest/Dockerfile) com contexto na raiz deste módulo e o `frontend/Dockerfile.dev` para a interface em desenvolvimento. O ficheiro [backend-nest/.env.example](./backend-nest/.env.example) contém placeholders de configuração; o Compose não o carrega automaticamente.

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

## Construção e validação

Os seguintes builds de imagem foram executados localmente em 2026-10-02:

| Alvo | Comando | Resultado |
| --- | --- | --- |
| Backend e frontend de desenvolvimento | `docker compose -f logistica-multi-tenant-clean/docker-compose.yml build backend frontend` | Imagens construídas |
| Frontend de produção | `docker build -f logistica-multi-tenant-clean/frontend/Dockerfile -t logistica-frontend:block3-validation logistica-multi-tenant-clean/frontend` | Imagem construída |
| Manifests Kubernetes | Não foi executado num cluster Kubernetes real | Por validar |

A construção da imagem não comprova o arranque ou o comportamento da aplicação em execução. Os manifests em `k8s/` também não foram validados num cluster real.

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
