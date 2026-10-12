# Frontend Logística

Aplicação web de logística construída com React, TypeScript e Vite. O código
usa React Query para chamadas à API, React Router para navegação e Vitest com
Testing Library para testes de componentes.

## Desenvolvimento

Para executar a plataforma completa em Docker Compose, segue as instruções do
[README do módulo](../README.md). Para trabalhar apenas no frontend, instala
as dependências a partir da raiz `logistica-multi-tenant-clean/`:

```sh
npm ci
npm run --workspace=frontend start
```

O Vite serve a aplicação na porta `3000` por omissão. As chamadas `/api` e
`/ws` são encaminhadas para `DOCKER_BACKEND_URL`; se a variável não estiver
definida, o destino predefinido é `http://localhost:3000`. Define-a para a
origem acessível da API quando o backend estiver a correr noutro endereço.

## Build e testes

```sh
npm run --workspace=frontend build
npm run --workspace=frontend test
```

O build executa `tsc --noEmit` e `vite build`. Os testes usam Vitest e a
configuração em `vite.config.ts`.

## Imagem de produção

O [Dockerfile](./Dockerfile) compila o frontend e serve os ficheiros estáticos
com Nginx. O Compose integrado usa o servidor Vite de desenvolvimento; consulta
o README do módulo para as portas e comandos Compose.
