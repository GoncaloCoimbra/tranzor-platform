# Backend ChatOps

Serviço Node.js e TypeScript baseado em Fastify. Expõe uma API HTTP na porta `3002` e um servidor WebSocket na porta `9001`. Usa Prisma para aceder a PostgreSQL e Redis para publicar eventos.

## Desenvolvimento local

```sh
npm install
npx prisma generate
npm run dev
```

Os scripts disponíveis estão definidos em `package.json`: `npm run build`, `npm start`, `npm test` e os comandos de validação e arranque de staging. O seed em [prisma/seed.ts](./prisma/seed.ts) cria um produto e um cliente de demonstração; não define credenciais de login.

## Docker

O [Dockerfile](./Dockerfile) constrói uma imagem multi-stage para o backend e expõe as portas `3002` e `9001`. A partir da raiz do repositório:

```sh
docker build -t chatops-backend:local -f Chatops/backend/Dockerfile Chatops/backend
```

O [Compose autónomo](../docker-compose.yml) define PostgreSQL e Redis, não o backend. O PostgreSQL monta `./pgdata` em `/var/lib/postgresql/data`; esta pasta contém os dados locais e não deve ser apagada como limpeza de ficheiros.

Na stack integrada, o serviço backend está definido em [docker-compose.override.yml](../../docker-compose.override.yml) e usa `node:20-bullseye`, montando o código e instalando dependências no arranque. A imagem Docker acima não é usada por essa sobreposição.

## Redis e configuração

Na stack integrada, o ChatOps partilha o serviço Redis da raiz com Commerce e Logística. `REDIS_PASSWORD` autentica o Redis e o `REDIS_URL` do ChatOps tem de conter a mesma password que os outros dois clientes. Usa o mesmo valor ao configurar os serviços que comunicam entre si.

O Compose autónomo de [Chatops/docker-compose.yml](../docker-compose.yml) cria um Redis separado e, atualmente, não configura password nesse serviço. Não confundas essa instância local com o Redis autenticado da stack integrada.

O ficheiro [staging.env.example](./staging.env.example) está versionado e inclui placeholders para `REDIS_PASSWORD`, `REDIS_URL`, `JWT_SECRET`, `DATABASE_URL`, `PORT` e `WS_PORT`. Substitui os placeholders por valores adequados ao ambiente; não coloques segredos reais no repositório.

## Endpoints e transporte

| Método e caminho | Comportamento |
| --- | --- |
| `GET /health` | Estado de arranque, base de dados, Redis, WebSocket e métricas de runtime |
| `GET /readyz` | Estado de prontidão do processo |
| `GET /livez` | Estado de vida do processo |
| `GET /metrics` | Contadores e estado de runtime em JSON |
| `GET /metrics/prometheus` | Métricas no formato Prometheus |
| `GET /auth/dev-token` | Emite um token de desenvolvimento quando `NODE_ENV` não é `production` |

O endpoint `/auth/dev-token` responde como não encontrado quando `NODE_ENV=production`. O WebSocket usa o token no cabeçalho `Authorization: Bearer <token>` e está configurado, por omissão, na porta `9001`.

## Estado e limitações

- `/auth/dev-token` é um mecanismo de desenvolvimento, não um fluxo de autenticação de produção. A rota não existe em produção; não exponhas ChatOps publicamente até existir e ser validado um fluxo de autenticação adequado.
- O código de autenticação usa `JWT_SECRET` e contém um valor de fallback no código. Define um segredo forte fora do repositório; a aplicação não deve ser tratada como pronta para produção apenas por ocultar a rota de token de desenvolvimento.
- Não existe histórico de migrações Prisma versionadas em `prisma/migrations`. O schema e o seed estão no repositório, mas a evolução reproduzível do schema da base de dados requer um processo de migração versionado.
- Ligações WebSocket, metadados de ligação, presença e cache de histórico dos canais residem em memória do processo. Não são partilhados entre réplicas e o estado em memória perde-se quando o processo termina. As mensagens também são persistidas através do Prisma.
- As configurações Compose usam instâncias únicas de PostgreSQL e Redis, sem configuração de alta disponibilidade.
- O MongoDB não é utilizado pelo Compose autónomo de ChatOps; esse Compose define PostgreSQL e Redis. Na stack integrada, a instância MongoDB comum não tem autenticação configurada.
- A configuração Kubernetes está documentada na raiz, mas não foi validada num cluster real.
