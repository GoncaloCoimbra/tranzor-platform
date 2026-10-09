# ChatOps

ChatOps é o módulo de comunicação em equipa da plataforma Tranzor. Inclui uma interface React/Vite, uma API Fastify em TypeScript, comunicação em tempo real por WebSocket, PostgreSQL com Prisma e Redis.

## Funcionalidades

- Autenticação com contas do Commerce, usando uma sessão protegida por cookie.
- Canais, mensagens em tempo real, conversas e grupos privados.
- Chamadas individuais e de grupo, com áudio/vídeo e partilha de ecrã através de WebRTC.
- Comandos de chat para consultar operações do Commerce e da Logística, sujeitos às permissões configuradas no backend.

## Arranque integrado com Docker Compose

Na raiz do repositório, inicia a stack de desenvolvimento:

```sh
docker compose up --build
```

Abre [http://localhost:3006](http://localhost:3006) e inicia sessão com uma conta do Commerce. A stack integrada liga o ChatOps ao Commerce, PostgreSQL e Redis; usa as credenciais de desenvolvimento locais e não as publiques nem as reutilizes em produção. Para encerrar os serviços, usa `docker compose down`. A base de dados da stack integrada é guardada no volume Docker `postgres_chatops_data`; o Compose autónomo de `Chatops/` usa a pasta `Chatops/pgdata`. Não removas esses dados como parte de uma limpeza normal de containers.

## Desenvolvimento local

Os comandos seguintes são úteis para trabalhar nos projetos isoladamente. O backend precisa de PostgreSQL e Redis disponíveis e de variáveis de ambiente válidas; para autenticação, `JWT_SECRET` tem de coincidir com o do Commerce. A stack Compose integrada configura essas ligações automaticamente.

Backend:

```sh
cd Chatops/backend
npm ci
npx prisma generate
npm run dev
```

Frontend, num segundo terminal:

```sh
cd Chatops/frontend
npm ci
npm run dev
```

Por omissão, a API HTTP usa a porta `3002`, o WebSocket a `9001` e o Vite a `5173`. Na stack integrada, o frontend fica disponível na porta `3006`.

## Verificações

Backend:

```sh
cd Chatops/backend
npm run check
npm test
```

Frontend:

```sh
cd Chatops/frontend
npm run check
npm test
npm run build
```

Os fluxos foram também testados manualmente com contas reais. As chamadas dependem das permissões de microfone/câmara do navegador e da conectividade entre os participantes; esse teste manual não substitui testes automatizados nem garante conectividade em todas as redes.

## Configuração e limites operacionais

- Não coloques passwords, tokens, chaves de API, `JWT_SECRET` ou `TURN_SHARED_SECRET` em ficheiros versionados. Usa variáveis de ambiente e valores distintos por ambiente.
- O login depende de contas do Commerce e de um `JWT_SECRET` partilhado entre os dois serviços.
- Em Kubernetes, mantém `chatops-backend` com uma réplica: presença, ligações e salas de chamada são estado local do processo, não partilhado.
- Para redes com NAT/firewalls restritivos, configura um servidor TURN real através de `CHATOPS_TURN_URLS` e `CHATOPS_TURN_SHARED_SECRET` na stack integrada. STUN, por si só, não garante conectividade entre redes.
- Presença, ligações WebSocket e salas de chamada são mantidas em memória do backend. Não há coordenação entre réplicas e uma chamada em curso não é recuperada depois de um reinício do backend.
- As migrações Prisma estão em `backend/prisma/migrations`. Antes de aplicar migrações a uma base de dados existente, confirma o estado e faz uma cópia de segurança adequada.
- A configuração Kubernetes existe na raiz do repositório, mas ainda não foi validada num cluster Kubernetes real.

Mais pormenores técnicos: [backend](./backend/README.md) e [frontend](./frontend/README.md). Para a stack completa e instruções Docker/Kubernetes, consulta o [README principal](../README.md).
