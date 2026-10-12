# Construção e deployment da Logística

Este guia descreve os contextos de build, os Compose existentes e o estado conhecido dos manifests Kubernetes da Logística. Os exemplos de build partem da raiz do repositório.

## Imagens Docker

### Backend

O Dockerfile do backend está em `logistica-multi-tenant-clean/backend-nest/Dockerfile`, mas o contexto de build tem de ser a raiz de `logistica-multi-tenant-clean`. O Dockerfile copia o `package.json` e o lockfile da raiz, os manifests das workspaces `backend-nest` e `frontend`, e o código de `backend-nest`. Usar `backend-nest/` como contexto deixa estes ficheiros fora do contexto e não corresponde ao Dockerfile.

```sh
docker build \
  -t logistica-backend:local \
  -f logistica-multi-tenant-clean/backend-nest/Dockerfile \
  logistica-multi-tenant-clean
```

### Frontend de produção

O Dockerfile de produção constrói a aplicação React/Vite e serve os ficheiros
de `dist/` através de Nginx na porta `80` do container:

```sh
docker build \
  -t logistica-frontend:local \
  -f logistica-multi-tenant-clean/frontend/Dockerfile \
  logistica-multi-tenant-clean/frontend
```

O [Compose autónomo](../docker-compose.yml) usa `frontend/Dockerfile.dev` e inicia o servidor Vite de desenvolvimento, não o Dockerfile de produção.

## Docker Compose

A partir da raiz do repositório, valida a configuração e, se pretenderes iniciar o ambiente local, usa:

```sh
cp logistica-multi-tenant-clean/.env.example logistica-multi-tenant-clean/.env
# Replace the placeholder credentials in the copied local .env file.
docker compose --env-file logistica-multi-tenant-clean/.env -f logistica-multi-tenant-clean/docker-compose.yml config
docker compose --env-file logistica-multi-tenant-clean/.env -f logistica-multi-tenant-clean/docker-compose.yml up --build
```

O Compose autónomo inclui PostgreSQL, Redis, backend e frontend. Publica a API em `localhost:3002` (container `3000`) e a interface de desenvolvimento em `localhost:3001` (container `3000`). As portas host de PostgreSQL (`5432`) e Redis (`6379`) estão limitadas a `127.0.0.1`.

Na stack integrada da raiz, a API Logística escuta internamente na porta `3000` e é encaminhada pelo proxy Nginx também publicado na porta `3000`. A interface de desenvolvimento publica a porta `3003` no host. A API Commerce mantém a porta `3001`.

## Variáveis de ambiente

O Compose autónomo exige `POSTGRES_PASSWORD`, `REDIS_PASSWORD` e `JWT_SECRET`; não inicia com valores predefinidos para estas credenciais. O ficheiro [`.env.example`](../.env.example) contém placeholders para a interpolação do Compose e tem de ser passado com `--env-file` ao executar a partir da raiz do repositório. O ficheiro [backend-nest/.env.example](../backend-nest/.env.example) contém configuração da aplicação, mas não substitui o ficheiro de interpolação do Compose.

O template [backend-nest/staging.env.example](../backend-nest/staging.env.example) inclui placeholders de staging. Não coloques passwords ou tokens reais em ficheiros versionados.

Na stack integrada, Logística, ChatOps e Commerce partilham um Redis autenticado. Usa a mesma variável `REDIS_PASSWORD` no serviço Redis e nos três URLs clientes. As configurações de staging e produção da raiz exigem `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `CLICKHOUSE_PASSWORD`, `JWT_SECRET` e `JWT_REFRESH_SECRET` para a API Commerce. Os Compose de staging e produção não constituem uma configuração de deployment de produção da Logística.

O MongoDB usado pela stack integrada exige autenticação root, configurada na inicialização do volume. Os serviços de dados em Compose são instâncias únicas, sem configuração de alta disponibilidade.

## Kubernetes

Existem manifests em `k8s/`, incluindo Deployments para backend e frontend e um StatefulSet PostgreSQL. O Deployment Logística declara uma réplica para o backend e o StatefulSet uma instância PostgreSQL; a imagem do frontend serve na porta `80`.

Os manifests não foram validados num cluster Kubernetes real. A presença dos ficheiros ou a construção local das imagens não confirma que os Secrets, a rede, o armazenamento, as migrações ou o arranque funcionem no cluster. A imagem runtime da Logística não inclui a CLI Prisma e os manifests não definem um Job de migração; prepara e valida separadamente um ambiente controlado para aplicar as migrações antes de depender da API. Não consideres o deployment Kubernetes validado até que seja ensaiado no ambiente de destino.

O ChatOps partilhado tem limitações de estado: parte do estado de ligações, presença e salas reside em memória e não é partilhada entre réplicas. As migrações Prisma estão versionadas em `Chatops/backend/prisma/migrations`, mas os manifests não as aplicam automaticamente. O Compose autónomo ChatOps também monta `Chatops/pgdata` para `/var/lib/postgresql/data`; essa pasta contém dados locais PostgreSQL e não deve ser apagada durante uma limpeza.

## Estado dos builds

Os builds seguintes foram executados localmente em 2026-10-02:

| Alvo | Comando executado | Resultado |
| --- | --- | --- |
| Backend e frontend de desenvolvimento | `docker compose -f logistica-multi-tenant-clean/docker-compose.yml build backend frontend` | Imagens construídas |
| Frontend de produção | `docker build -f logistica-multi-tenant-clean/frontend/Dockerfile -t logistica-frontend:block3-validation logistica-multi-tenant-clean/frontend` | Imagem construída |
| Deployment Kubernetes | Sem execução num cluster real | Por validar |

Estes resultados confirmam a construção das imagens nas condições desse ensaio, não o arranque dos containers, a disponibilidade dos serviços ou o deployment num cluster.

## Seed e dados

O seed está em [backend-nest/prisma/seed.ts](../backend-nest/prisma/seed.ts). Obtém as credenciais de `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`, `DEMO_ADMIN_PASSWORD`, `DEMO_OPERATOR_PASSWORD` e `DEMO_USER_PASSWORD`; as passwords têm de passar a validação de força implementada no código.

O seed executa `TRUNCATE` em várias tabelas antes de inserir os dados de exemplo. Não o executes numa base de dados com dados a preservar.
