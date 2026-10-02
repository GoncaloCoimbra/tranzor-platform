# Guia de dados de demonstração da Logística

Este guia descreve como o seed da aplicação prepara dados de exemplo e onde são definidas as credenciais. Não existem passwords de demonstração para reutilizar.

## Ambiente local

O módulo inclui uma API NestJS, uma aplicação frontend React Scripts, PostgreSQL e Redis. O Compose autónomo está em [docker-compose.yml](./docker-compose.yml); os comandos abaixo são executados a partir da raiz do repositório:

```sh
docker compose -f logistica-multi-tenant-clean/docker-compose.yml config
docker compose -f logistica-multi-tenant-clean/docker-compose.yml up --build
```

No Compose autónomo, a API publica a porta `3002` do host e a interface de desenvolvimento publica `3001`. A configuração não carrega automaticamente os ficheiros de exemplo de ambiente.

## Credenciais do seed

O seed ativo está em [backend-nest/prisma/seed.ts](./backend-nest/prisma/seed.ts). Lê estas variáveis do ambiente:

| Variável | Utilização |
| --- | --- |
| `SUPER_ADMIN_EMAIL` | Endereço de email do superadministrador |
| `SUPER_ADMIN_PASSWORD` | Password do superadministrador |
| `DEMO_ADMIN_PASSWORD` | Password do utilizador de demonstração com função de administrador |
| `DEMO_OPERATOR_PASSWORD` | Password do utilizador de demonstração com função de operador |
| `DEMO_USER_PASSWORD` | Password dos utilizadores de demonstração |

O seed termina com erro se faltar uma destas variáveis ou se alguma password não cumprir a validação do código: entre 8 e 128 caracteres, pelo menos uma letra maiúscula e um algarismo. Define valores próprios e fortes no ambiente de execução; não os guardes neste documento nem no controlo de versões. O ficheiro [backend-nest/.env.example](./backend-nest/.env.example) contém valores de substituição, não credenciais válidas.

O seed cria contas de demonstração e dados associados a empresas de exemplo. Os endereços de email são definidos em `backend-nest/prisma/seed.ts`; as passwords não são literais no ficheiro, são lidas das variáveis acima.

## Atenção aos dados existentes

Antes de inserir os dados de exemplo, o seed executa uma instrução `TRUNCATE` sobre várias tabelas da base de dados, com reinício de identidades e cascata. Não o executes numa base de dados com dados a preservar.

## Limites da validação

A configuração Compose e a construção local das imagens não demonstram que a aplicação foi iniciada ou que o fluxo de login funciona. Os manifests Kubernetes do módulo ainda não foram validados num cluster real.

Para a visão geral do repositório, consulta o [README principal](../README.md).
