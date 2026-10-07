# ChatOps frontend

Este frontend consome o backend do ChatOps em tempo real.

## Quick start
```bash
cd Chatops/frontend
npm install
npm run dev
```

## Run tests
```bash
cd Chatops/frontend
npm test
```

## Configuração
- A interface usa a própria origem do navegador para a API (`/api`) e para o WebSocket (`/ws`).
- No Docker Compose de desenvolvimento, o Vite encaminha `/api` e `/uploads` para `chatops-backend:3002` e `/ws` para `chatops-backend:9001`. Assim, outros dispositivos usam o host pelo qual abriram a interface, em vez do seu próprio `localhost`.
- Fora do Docker, o proxy Vite usa por omissão `http://localhost:3002` e `ws://localhost:9001`; podem ser definidos `DOCKER_BACKEND_URL` e `DOCKER_WS_URL` para outros destinos.
