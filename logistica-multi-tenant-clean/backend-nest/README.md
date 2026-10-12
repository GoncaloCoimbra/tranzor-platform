# Backend Logística

API de logística multi-tenant construída com NestJS, TypeScript e Prisma. Usa
PostgreSQL para persistência e Redis para dependências partilhadas. A API
expõe documentação Swagger em `/api/docs` e endpoints de estado em `/health`,
`/readyz` e `/livez`.

## Desenvolvimento

Executa os comandos a partir de `logistica-multi-tenant-clean/`:

```sh
npm ci
npm run --workspace=backend-nest start:dev
```

O backend usa a porta `3000` por omissão. Define `DATABASE_URL`, `REDIS_URL` e
`JWT_SECRET` no ambiente; os exemplos e as restantes opções estão em
[.env.example](./.env.example). Para executar sem containers, usa endereços de
PostgreSQL e Redis acessíveis a partir do host, não os nomes de serviço `db` e
`redis` da rede Docker.

## Prisma e seed

O schema e as migrações estão em `prisma/`. Em desenvolvimento, aplica
migrações com:

```sh
npm run --workspace=backend-nest prisma:migrate
```

O seed requer as variáveis de credenciais documentadas em
[.env.example](./.env.example). **Não o executes numa base de dados com dados a
preservar:** o seed limpa tabelas antes de criar os dados iniciais.

## Testes e build

```sh
npm run --workspace=backend-nest test
npm run --workspace=backend-nest test:cov
npm run --workspace=backend-nest test:e2e
npm run --workspace=backend-nest build
```

Os testes E2E precisam de uma base de dados de teste configurada. Não apontes
testes ou seeds a uma base de dados de produção.

## Docker e deployment

O [README do módulo](../README.md) documenta o Compose autónomo e integrado,
portas, configuração e limitações. Os manifests Kubernetes partilhados estão
em [k8s/](../../k8s/); ainda não foram validados num cluster real.
