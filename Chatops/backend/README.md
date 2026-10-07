# Backend ChatOps

Serviço Node.js e TypeScript baseado em Fastify. Expõe uma API HTTP na porta `3002` e um servidor WebSocket na porta `9001`. Usa Prisma para aceder a PostgreSQL e Redis para publicar eventos.

## Desenvolvimento local

```sh
npm install
npx prisma generate
npm run dev
```

Os scripts disponíveis estão definidos em `package.json`: `npm run build`, `npm start`, `npm test` e os comandos de validação e arranque de staging. O seed em [prisma/seed.ts](./prisma/seed.ts) cria um produto e um cliente de demonstração; não define credenciais de login.

O arranque confirma PostgreSQL e Redis com cinco tentativas por omissão; `ALLOW_DEGRADED=true` é a única opção para continuar sem uma dependência, e `STARTUP_MAX_ATTEMPTS`/`STARTUP_RETRY_DELAY_MS` configuram o número de tentativas e o backoff.

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
| `POST /auth/login` | Valida credenciais através do Commerce e cria uma sessão protegida por cookie |
| `GET /auth/session` | Revalida a sessão junto do Commerce |
| `POST /auth/logout` | Termina a sessão local |
| `GET /users` e `/groups` | Lista utilizadores que já iniciaram sessão no ChatOps e grupos do utilizador autenticado |
| `/history` e `/channels/*` | Histórico, membros e ficheiros dos canais autorizados |

O acesso requer uma conta Commerce. A mesma `JWT_SECRET` tem de ser configurada no Commerce e no ChatOps. O cookie de sessão é `HttpOnly`; as ligações WebSocket autenticam-se através desse cookie e usam, por omissão, a porta `9001`. A antiga rota `/auth/dev-token` não está disponível.

No canal `#Logística`, estão disponíveis `/stock [SKU]`, `/low-stock` e `/order [id]`. Os comandos de stock consultam a Logística com `LOGISTICS_API_KEY`; `/low-stock` lista até 50 produtos da empresa associada à chave com cinco ou menos unidades. `/order` recebe o ID MongoDB de 24 caracteres de uma encomenda Commerce e consulta o endpoint autenticado com o token da sessão atual; o Commerce só devolve o estado ao proprietário da encomenda (ou a um administrador autorizado). A chave de API não é encaminhada ao Commerce. Sem credenciais configuradas ou se a integração falhar, o ChatOps apresenta um erro explícito. O comando `/approve-credit [id_empresa]` atualiza o estado de crédito através do Prisma e está restrito, por omissão, a utilizadores cujo papel Commerce é `admin`. Pode configurar os papéis autorizados através de `CHATOPS_CREDIT_APPROVER_ROLES` (lista separada por vírgulas); a autorização é verificada no backend, não apenas na interface.

## Estado e limitações

- O login reutiliza contas do Commerce e valida a assinatura e validade do JWT partilhado. Em produção e staging, `JWT_SECRET` tem de estar definido e ser forte.
- As migrações Prisma estão versionadas em `prisma/migrations`, incluindo o schema de grupos privados e utilizadores ChatOps. Não foram aplicadas à base de dados existente nesta alteração; confirma primeiro a compatibilidade do estado atual antes de executar `prisma migrate deploy`.
- A lista de pessoas que já iniciaram sessão no ChatOps e os grupos privados são guardados no PostgreSQL. Só utilizadores que tenham iniciado sessão pelo menos uma vez podem ser adicionados a um grupo.
- Ligações WebSocket, metadados de ligação, presença e cache de histórico dos canais residem em memória do processo. Não são partilhados entre réplicas e o estado em memória perde-se quando o processo termina. As mensagens também são persistidas através do Prisma.
- Chamadas individuais e de grupo usam WebRTC ponto a ponto, com sinalização autenticada pelo WebSocket. Uma chamada de grupo pode convidar até oito pessoas; cada navegador pede acesso ao microfone e, em vídeo, à câmara. O som de chamada e os dispositivos escolhidos são preferências locais do navegador.
- Por omissão, WebRTC usa STUN público. Para redes com NAT/firewalls restritivos, configure `TURN_URLS` (URLs `turn:`/`turns:` separadas por vírgulas) e `TURN_SHARED_SECRET` com o segredo REST do coturn; no coturn, ative `use-auth-secret` e defina `static-auth-secret` com o mesmo segredo. O backend emite credenciais coturn temporárias, por utilizador, com validade de uma hora; o segredo partilhado nunca é enviado ao browser. Configure os equivalentes `CHATOPS_TURN_URLS` e `CHATOPS_TURN_SHARED_SECRET` no `.env` da stack integrada. Sem um serviço TURN acessível, estas opções não criam um relay nem comprovam conectividade externa.
- Chamadas e sinalização não são partilhadas entre réplicas. As salas são voláteis: um encerramento gracioso avisa os participantes e termina a chamada; uma falha abrupta também perde a sala, sem recuperação possível da sessão WebRTC. O frontend fecha o estado local se perder a ligação de sinalização. As chamadas não são restauradas após reinício.
- As chamadas são transitórias e não guardam áudio/vídeo na base de dados. Os comandos que alteram dados, incluindo `/approve-credit`, continuam bloqueados até existir uma integração autorizada.
- As configurações Compose usam instâncias únicas de PostgreSQL e Redis, sem configuração de alta disponibilidade.
- O MongoDB não é utilizado pelo Compose autónomo de ChatOps; esse Compose define PostgreSQL e Redis. Na stack integrada, a instância MongoDB comum não tem autenticação configurada.
- A configuração Kubernetes está documentada na raiz, mas não foi validada num cluster real.
