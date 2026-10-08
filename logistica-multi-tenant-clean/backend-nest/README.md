# Backend-Nest

Código ativo e produtivo da API NestJS com Prisma, Swagger e design modular.

## Quick Start

O arranque confirma PostgreSQL e Redis com cinco tentativas por omissão; `ALLOW_DEGRADED=true` é a única opção para continuar sem uma dependência, e `STARTUP_MAX_ATTEMPTS`/`STARTUP_RETRY_DELAY_MS` configuram o número de tentativas e o backoff.

```bash
# Instalar dependências (na raiz)
npm install

# Configure .env
cp .env.example .env

# Rodar migrações
npm run --workspace=backend-nest prisma:migrate

# Seed (dados iniciais)
npm run --workspace=backend-nest seed

# Rodar em desenvolvimento
npm run --workspace=backend-nest start:dev

# Testes
npm run --workspace=backend-nest test
npm run --workspace=backend-nest test:cov
npm run --workspace=backend-nest test:e2e
```

## Estrutura

```
src/
├─ main.ts                 # Entry point com Swagger setup
├─ app.module.ts           # Root module
├─ app.controller.ts       # Health check e rotas globais
├─ common/                 # Shared (guards, pipes, interceptors)
│  ├─ guards/
│  ├─ interceptors/
│  ├─ pipes/
│  └─ interfaces/
├─ modules/                # Features (auth, users, products, etc.)
│  ├─ auth/
│  ├─ users/
│  ├─ products/
│  ├─ vehicles/
│  └─ ...
├─ database/               # Prisma + migrations
├─ types/                  # TypeScript types globais
└─ config/                 # Variáveis de ambiente e setup

prisma/
├─ schema.prisma           # Modelo de dados
├─ migrations/             # Change history
└─ seed.ts                 # Dados iniciais
```

## API Documentation

Swagger disponível em: `http://localhost:3000/api/docs`

- Todos os endpoints estão anotados com `@ApiOperation()` e `@ApiProperty()`
- Exemplos incluídos nos DTOs
- JWT Authentication documented

## Testes

```bash
# Unitários
npm run --workspace=backend-nest test

# Com cobertura
npm run --workspace=backend-nest test:cov

# E2E
npm run --workspace=backend-nest test:e2e

# Guard + watch
npm run --workspace=backend-nest test:watch
```

## Variáveis de Ambiente

Veja `.env.example` para a lista completa. Essenciais:

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/logistica_dev
JWT_SECRET=replace-with-a-secure-random-secret
CORS_ORIGIN=http://localhost:3001
NODE_ENV=development
```

## Padrões

- **Modules**: cada feature em seu módulo separado
- **Services**: lógica de negócio
- **Controllers**: endpoints HTTP
- **DTOs**: validation with class-validator
- **Guards**: JWT, roles, tenant
- **Interceptors**: logging, transform, audit

## Additional Documentation

- [ARCHITECTURE.md](../docs/ARCHITECTURE.md) - Decisões de design
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Como contribuir
- [DEPLOYMENT.md](../docs/DEPLOYMENT.md) - Deploy to production

---

**Last update:** February 2026
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
