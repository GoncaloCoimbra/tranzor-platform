# Logistics module

Este é o diretório ativo do módulo de logística para este workspace.

## Início rápido

```bash
cd logistica-multi-tenant-clean
npm install
npm run install:all
npm run start-all
```

## Variáveis de ambiente

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/logistica
JWT_SECRET=replace-with-a-secure-random-secret
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3001
```

Integrações autenticadas devem receber credenciais através de variáveis de ambiente ou de um gestor de secrets. Não coloque chaves reais no código, neste README ou no controlo de versões.

## Capacidades atuais

- API REST NestJS com autenticação JWT, RBAC e isolamento por `companyId`.
- Gestão de produtos, transportes, veículos, fornecedores, notificações e auditoria.
- Paginação e filtros para listagens de produtos, transportes e reservas.
- Reservas de stock com estados `RESERVED`, `CONFIRMED`, `RELEASED` e `EXPIRED`.
- Lock Redis para reduzir conflitos concorrentes nas operações de reserva. A eficácia em produção ainda requer validação no ambiente de destino.
- API keys para integrações de serviço. As chaves devem ser fornecidas por secret manager ou variável protegida e nunca documentadas com o seu valor.
- Eventos em tempo real para atualizações de transportes e reservas, quando o gateway WebSocket está ativo.

## Testes

```bash
npm run build-all
npm run test-all
```

## Estado de implementação e validação

Implementado no backend ativo:

- API keys com hash e isolamento por `companyId` para integrações.
- Modelo `StockReservation` com estados `RESERVED`, `CONFIRMED`, `RELEASED` e `EXPIRED`.
- Reservas ligadas à criação, despacho e cancelamento de transportes.
- Rooms WebSocket autenticadas por tenant.
- Dashboard com quantidade reservada e stock disponível.

Validação executada localmente:

- Endpoint de stock por SKU com SKU real e API key tenant-scoped: `200`.
- PostgreSQL e Redis locais ativos durante a suite de integração.
- Suite backend completa: `13` suites e `77` testes passados.
- Build backend Nest passado.
- Cliente frontend Socket.IO tenant-aware ligado ao Dashboard.
- Typecheck frontend passado (`tsc --noEmit`).
- Build frontend de produção passado com `GENERATE_SOURCEMAP=false`.
- CI: correção TS6 para `baseUrl` aplicada em [frontend/tsconfig.json](frontend/tsconfig.json).
- CI: testes Jest CommonJS estabilizados; backend legado localmente com `14` suites e `39` testes passados.

Uma feature só deve ser marcada como validada depois de o comando correspondente ser executado e o resultado registado.

## Teste de carga

Com o backend em execução, o teste mede pedidos concorrentes e termina com erro se houver respostas HTTP não-2xx ou falhas de rede:

```powershell
cd backend-nest
npm run load-test -- --help
$env:LOAD_PATH='/health'; $env:LOAD_DURATION_SECONDS='30'; $env:LOAD_CONCURRENCY='10'; npm run load-test
```

Para um endpoint autenticado, defina também `$env:LOAD_TOKEN` e use, por exemplo, `$env:LOAD_PATH='/api/dashboard/stats'`. Execute primeiro em staging, com dados representativos, e aumente a concorrência gradualmente. Registe p95, taxa de erros e CPU/RAM/PostgreSQL antes de declarar uma capacidade de produção.

## Observação importante

- A pasta [logistica-multi-tenant](../logistica-multi-tenant) permanece apenas como referência histórica e não é a fonte principal para o trabalho atual.
- Se o backend não iniciar, confirme o `DATABASE_URL` e rode `npx prisma generate` em [logistica-multi-tenant-clean/backend-nest](backend-nest).

- Legacy refactor scripts: scripts in the `scripts/legacy-refactor/` directory are one-time migration/refactor tools kept for historical reference and should not be considered part of the active build or runtime workflow.

### Data Layer

| Service         | Technology     | Version | Purpose                      |
| --------------- | -------------- | ------- | ---------------------------- |
| **Database**    | PostgreSQL     | 15      | Relational database          |
| **Migrations**  | Prisma Migrate | 5.0+    | Type-safe schema versioning  |
| **ORM Adapter** | Prisma Client  | 5.0+    | Auto-generated query builder |

### Infrastructure Configuration

| Component                | Technology     | Status                                 |
| ------------------------ | -------------- | -------------------------------------- |
| **Containerization**     | Docker         | Configured, not deployed               |
| **Composition**          | Docker Compose | Local dev environment                  |
| **Kubernetes Manifests** | k8s YAML files | Present, not validated in live cluster |
| **CI/CD**                | GitHub Actions | Configured                             |
| **Package Manager**      | npm            | Working                                |

### DevOps & Infrastructure

| Component          | Technology | Purpose             |
| ------------------ | ---------- | ------------------- |
| **Reverse Proxy**  | Nginx      | Static file serving |
| **Load Balancing** | —          | Not configured      |
| **Monitoring**     | —          | Not configured      |

### Security Frameworks

- **JWT Authentication** with refresh token rotation ✅
- **Multi-tenant Isolation** via Guards & Row-Level Filter ✅
- **Role-Based Access Control (RBAC)** — 3 roles (Super Admin, Administrator, Operator) ✅
- **SQL Injection Prevention** via Prisma ORM ✅
- **Password Hashing** — bcrypt with salt rounds ✅

---

---

## 🏗️ Architecture

### System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                    Client Layer                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │   React 18 SPA (http://localhost:3001)                   │  │
│  │   • Dashboard (Recharts analytics)                        │  │
│  │   • Product Management (CRUD)                             │  │
│  │   • User Management & RBAC                                │  │
│  │   • Multi-tenant aware (companyId in context)             │  │
│  └──────────┬───────────────────────────────────────────────┘  │
│             │ HTTP REST + JSON                                 │
└─────────────┼────────────────────────────────────────────────────┘
              │
┌─────────────▼────────────────────────────────────────────────────┐
│                    API Gateway Layer                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  NestJS Application (http://localhost:3000)              │   │
│  │  • Swagger OpenAPI Documentation (/api/docs)             │   │
│  │  • Global Exception Filters                              │   │
│  │  • Request/Response Logging                              │   │
│  └──────────┬───────────────────────────────────────────────┘   │
└─────────────┼───────────────────────────────────────────────────┘
              │
┌─────────────▼────────────────────────────────────────────────────┐
│                  Security & Auth Layer                            │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  1. JwtAuthGuard          → Validates JWT tokens           │  │
│  │  2. TenantGuard          → Injects current companyId       │  │
│  │  3. RolesGuard @Roles()  → Validates user permissions      │  │
│  │  4. Request Logging      → Tracks all operations           │  │
│  └────────────┬─────────────────────────────────────────────┘   │
└───────────────┼──────────────────────────────────────────────────┘
                │
┌───────────────▼──────────────────────────────────────────────────┐
│               Business Logic Layer (Modules)                      │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐              │
│  │  Products    │ │  Users       │ │  Companies   │              │
│  │  • CRUD      │ │  • Auth      │ │  • Settings  │              │
│  │  • Movement  │ │  • Roles     │ │  • License   │              │
│  │  • Analytics │ │  • Audit Log │ │  • Branding  │              │
│  └──────────────┘ └──────────────┘ └──────────────┘              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐              │
│  │  Transport   │ │  Suppliers   │ │  Notification│              │
│  │  • Routes    │ │  • Registry  │ │  • Queue     │              │
│  │  • Vehicles  │ │  • Contacts  │ │  • Alerts    │              │
│  │  • Tracking  │ │  • History   │ │  • Email     │              │
│  └──────────────┘ └──────────────┘ └──────────────┘              │
└───────────┬──────────────────────────────────────────────────────┘
            │
┌───────────▼──────────────────────────────────────────────────────┐
│           Data Access Layer (Prisma ORM)                          │
│  • Type-safe database queries                                     │
│  • Automatic migration management                                │
│  • Connection pooling                                             │
│  • Query optimization                                             │
└───────────┬──────────────────────────────────────────────────────┘
            │ SQL
┌───────────▼──────────────────────────────────────────────────────┐
│         PostgreSQL 15 Database                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │            Company Isolation (Row-Level)                    │ │
│  │ ┌──────────────────┐  ┌──────────────────┐                 │ │
│  │ │  Company A Data  │  │  Company B Data  │  ...            │ │
│  │ │ • Users (Tenant) │  │ • Users (Tenant) │                 │ │
│  │ │ • Products       │  │ • Products       │                 │ │
│  │ │ • Transports     │  │ • Transports     │                 │ │
│  │ │ • Suppliers      │  │ • Suppliers      │                 │ │
│  │ └──────────────────┘  └──────────────────┘                 │ │
│  │    [Fully Isolated & Secure]                               │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  • Shared Tables: Users, Companies, Audit Logs                  │
│  • Tenant Filters: WHERE company_id = $1 on all queries         │
└────────────────────────────────────────────────────────────────────┘
```

### Multi-Tenant Isolation Strategy

| Layer           | Isolation Method   | Implementation                                    |
| --------------- | ------------------ | ------------------------------------------------- |
| **Frontend**    | Context & State    | User company stored in AuthContext                |
| **API Gateway** | Route Guards       | TenantGuard extracts companyId from JWT           |
| **Database**    | Row-Level Security | WHERE company_id = $userId filters in every query |
| **Audit**       | Automatic Logging  | AuditLog tracks user & company for each operation |

### Product State Machine

```
     ┌─ [Received]
     │      │
     ├─────〉[UnderReview] ─────┐
     │      │                   │
     │     Rejected             │ Approved
     │      │                   │
     │      └─〉[UnderReturn]    └─〉[InStorage]
     │           │                   │
     │           └─ Received        │
     │                              │  Preparation
     │                              ├──────────────┐
     │                              │              │
     │                        [InPreparation]      │
     │                              │              │
     │                              └──〉[InShipment]
     │                                      │
     │                                   Delivered
     │                                      │
     │                                    [END]
     │
     └─ Cancelled ──〉[InStorage] (can be resumed)
     └─ Disposed ──〉[END]
```

---

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have:

- **Node.js 18+** ([download](https://nodejs.org/))
- **PostgreSQL 15** ([download](https://www.postgresql.org/)) or Docker
- **Git** ([download](https://git-scm.com/))

### Installation & Setup

**Step 1: Clone & Install**

```bash
git clone https://github.com/GoncaloCoimbra/logistica-multi-tenant.git
cd logistica-multi-tenant
npm install
```

**Step 2: Configure Environment**

```bash
cd backend-nest
cp .env.example .env  # Or create .env manually
```

**Step 3: Database Setup**

**Option A: With Docker (Recommended)**

```bash
docker-compose up -d  # Starts PostgreSQL
npx prisma migrate deploy
npx prisma generate
```

**Option B: Manual PostgreSQL**

```bash
createdb logistica  # Create database
npx prisma migrate deploy
npx prisma generate
```

**Step 4: Start Application**

```bash
# From root directory
npm run start-all
```

Open:

- 🖥️ **Frontend:** http://localhost:3001
- 🔧 **API Docs:** http://localhost:3000/api/docs
- 📊 **Database Studio:** `npm run prisma:studio` in backend-nest

### Quick Demo Data

```bash
cd backend-nest
npm run seed:demo  # Populates 10+ suppliers & 12 products
```

---

**👉 For detailed demo walkthrough, see [DEMO.md](./DEMO.md)**

---

npm run dev

# Terminal 2 — Frontend

cd frontend
npm run dev

````

**Production mode:**
```bash
# Backend
cd backend-nest
npm run build && npm start

# Frontend
cd frontend
npm run build
# Serve the build/ folder with nginx or similar
````

### Access

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **Prisma Studio**: http://localhost:5555 (run `npx prisma studio`)

---

## 📁 Project Structure

### Directory Layout

```
logistica-multi-tenant/
│
├── 📂 backend/                      # DEPRECATED — Express (legacy)
│                                    # ⚠️ Do not add new features here
│
├── 📂 backend-nest/                 # ⭐ Active NestJS API & Database
│   ├── prisma/
│   │   ├── schema.prisma            # Database schema with models
│   │   ├── migrations/              # Automatic migration history
│   │   └── seed.ts                  # Initial seeding script
│   │
│   ├── src/
│   │   ├── auth/                    # Authentication (JWT, Guards)
│   │   ├── companies/               # Company management & settings
│   │   ├── common/                  # Common filters, DTOs, exceptions
│   │   ├── controllers/             # API endpoint handlers
│   │   ├── database/                # Database connection, transactions
│   │   ├── modules/                 # Feature modules (Products, Users, etc)
│   │   ├── products/                # Product CRUD & state machine
│   │   ├── services/
│   │   │   ├── UserService
│   │   │   ├── ProductService
│   │   │   ├── SupplierService
│   │   │   ├── TransportService
│   │   │   └── NotificationService
│   │   │
│   │   ├── transports/              # Logistics & vehicle tracking
│   │   ├── users/                   # User management & roles
│   │   ├── vehicles/                # Fleet management
│   │   ├── suppliers/               # Supplier registry
│   │   ├── notifications/           # Alert system
│   │   ├── types/                   # TypeScript interfaces & enums
│   │   │
│   │   ├── app.controller.ts        # Root API controller
│   │   ├── app.module.ts            # Root DI module
│   │   ├── app.service.ts           # Root service
│   │   └── main.ts                  # NestJS bootstrap
│   │
│   ├── test/
│   │   ├── app.e2e-spec.ts          # End-to-end tests
│   │   ├── auth.e2e-spec.ts         # Auth flow tests
│   │   └── jest-e2e.json            # E2E test config
│   │
│
│   ├── seed.ts                      # Demo seeding script
│   ├── Dockerfile                   # Container image definition
│   ├── package.json                 # Dependencies & scripts
│   ├── nest-cli.json                # NestJS CLI config
│   ├── tsconfig.json                # TypeScript base config
│   ├── tsconfig.build.json          # Build config
│   └── eslint.config.mjs            # ESLint rules
│
├── 📂 frontend/                     # ⭐ React 18 SPA (UI Layer)
│   ├── src/
│   │   ├── styles/                  # Global styles & design system (NEW)
│   │   │   └── unified-system.css   # CSS variables, dark mode, tokens
│   │   │
│   │   ├── components/
│   │   │   ├── common/              # Unified component library (NEW)
│   │   │   │   ├── Button.tsx       # Primary UI button (6 variants)
│   │   │   │   ├── Input.tsx        # Form input with validation
│   │   │   │   ├── Card.tsx         # Container component
│   │   │   │   ├── Badge.tsx        # Status badges (5 variants)
│   │   │   │   ├── Alert.tsx        # Alert/notification component
│   │   │   │   └── index.ts         # Exports all components
│   │   │   │
│   │   │   ├── layout/              # Page layout components (NEW)
│   │   │   │   ├── UnifiedHeader.tsx # Header with 🌙 theme toggle
│   │   │   │   ├── UnifiedSidebar.tsx # Navigation sidebar
│   │   │   │   └── UnifiedFooter.tsx  # Footer component
│   │   │   │
│   │   │   ├── UserManagementTable
│   │   │   ├── ProductCard
│   │   │   └── ... (other components)
│   │   │
│   │   ├── layouts/
│   │   │   └── UnifiedLayout.tsx    # Main layout with theme manager (NEW)
│   │   │
│   │   ├── pages/                   # Route pages (32 pages total)
│   │   │   ├── Dashboard            # Main dashboard
│   │   │   ├── ProductList          # Products CRUD
│   │   │   ├── SupplierList         # Suppliers management
│   │   │   ├── TransportList        # Logistics tracking
│   │   │   ├── Profile              # User profile
│   │   │   ├── Settings             # App settings
│   │   │   ├── Login                # Authentication
│   │   │   └── ... (27 more pages, all refactored)
│   │   │
│   │   ├── lib/                     # Utility functions, constants
│   │   ├── App.tsx                  # Main App component
│   │   └── index.tsx                # React DOM render
│   │
│   ├── Dockerfile                   # Nginx container for production
│   ├── package.json                 # Dependencies & scripts
│   ├── tailwind.config.js           # Tailwind CSS configuration
│   ├── tsconfig.json                # TypeScript config
│   └── vite.config.ts               # Vite build config
│
├── 📂 k8s/                          # Kubernetes manifests (NOT VALIDATED - see status section)
│   └── *.yaml                       # Present for reference only
│
├── 📂 docs/                         # Documentation
│   ├── ARCHITECTURE.md              # System design deep-dive
│   ├── DEPLOYMENT.md                # Production deployment guide
│   ├── SECURITY.md                  # Security best practices
│   ├── API.md                       # Full API reference
│   ├── TESTING.md                   # Testing strategy
│   └── ROADMAP.md                   # Feature roadmap
│
├── docker-compose.yml               # Local dev environment setup
├── package.json                     # Root monorepo config
├── .gitignore
├── .env.example                     # Environment template
├── DEMO.md                          # Demo guide & walkthroughs
├── README.md                        # This file
└── LICENSE                          # MIT License
```

### Key Directories Explained

**`backend-nest/src/`** — Core API Logic

- **auth/** : JWT token generation, refresh logic, login/register endpoints
- **modules/** : Feature-specific business logic organized by domain
- **common/** : Shared Guards (TenantGuard, RolesGuard), Filters, DTOs, Exceptions
- **database/** : Prisma interactions, transactions, connection management

**`frontend/src/`** — React Application Structure

- **api/** : Axios instance with interceptors, error handling, API calls
- **contexts/** : AuthContext (user, company), TenantContext
- **hooks/** : useAuth(), useProducts(), useAsync() custom React hooks
- **pages/** : Full-page components (routed via React Router)
- **components/** : Reusable UI components (tables, forms, cards, modals)

---

## 💻 Development Guide

### Code Example Walkthrough

#### Example 1: Creating a Product (Backend)

**Service Layer** (`backend-nest/src/products/products.service.ts`):

```typescript
@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async create(input: CreateProductDto, companyId: string) {
    // Validate supplier exists in this company
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: input.supplierId, companyId },
    });
    if (!supplier) throw new BadRequestException('Supplier not found');

    // Create product with initial state
    return this.prisma.product.create({
      data: {
        code: input.code,
        description: input.description,
        quantity: input.quantity,
        companyId,
        supplierId: input.supplierId,
        state: 'RECEIVED', // Initial state
        location: input.location || 'Warehouse A',
      },
    });
  }

  // Multi-tenant isolation: only fetch products for this company
  async findByCompany(companyId: string) {
    return this.prisma.product.findMany({
      where: { companyId },
      include: { supplier: true },
    });
  }
}
```

**Controller Layer** (`backend-nest/src/controllers/products.controller.ts`):

```typescript
@Controller('api/products')
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
export class ProductsController {
  constructor(private service: ProductsService) {}

  @Post()
  @Roles('ADMIN', 'OPERATOR')
  async create(
    @Body() input: CreateProductDto,
    @Req() req: any // Contains companyId injected by TenantGuard
  ) {
    const product = await this.service.create(input, req.user.companyId);
    this.logger.log(`Product created: ${product.code}`, 'ProductsController');
    return product;
  }

  @Get()
  async list(@Req() req: any) {
    const products = await this.service.findByCompany(req.user.companyId);
    return { data: products, count: products.length };
  }
}
```

#### Example 2: Listing Products (Frontend)

**Hook** (`frontend/src/hooks/useProducts.ts`):

```typescript
export const useProducts = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/products');
      setProducts(response.data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  return { products, loading, error, refetch: fetchProducts };
};
```

**Component** (`frontend/src/pages/ProductList.tsx`):

```tsx
export const ProductList = () => {
  const { products, loading, error } = useProducts();
  const { user } = useAuth();

  if (loading) return <p>Carregando produtos...</p>;
  if (error) return <Alert type="error">{error}</Alert>;

  return (
    <div>
      <h1>Lista de Produtos</h1>
      <button>Novo Produto</button>
      <table>
        <tbody>
          {products.map((p) => (
            <tr key={p.id}>
              <td>{p.code}</td>
              <td>{p.state}</td>
              <td>{p.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
```

### Before You Code

1. **Read Requirements** — Understand scope and edge cases
2. **Plan Schema** — Draw database relationships, include `companyId` for isolation
3. **Draw States** — All valid transitions and permissions
4. **Sketch UI** — Filters, tables, forms, error states
5. **Test Plan** — Happy path, error cases, edge cases

### Essential Commands

```bash
# Database
npx prisma studio           # Open Prisma GUI
npx prisma migrate dev      # Create a new migration
npx prisma db seed          # Run seed script

# Testing
npm test                    # Run unit/integration tests
npm run test:e2e           # Run end-to-end tests
npm run test:cov           # Code coverage report

# Code Quality
npm run lint               # ESLint
npm run format             # Prettier
npm run build              # Production build

# Demo
npm run seed:demo          # Populate demo data
npm run start-all          # Both servers + hot-reload
```

### Best Practices Checklist

- ✅ Always validate with Zod before processing
- ✅ Always filter by `companyId` in multi-tenant queries
- ✅ Use Prisma transactions for complex operations
- ✅ Log important operations (created, updated, deleted)
- ✅ Write tests for critical business logic
- ✅ Never hardcode secrets — use environment variables
- ✅ Handle errors gracefully and return meaningful messages
- ✅ Pagination and filtering are implemented for the main product, transport, and reservation listings
- ✅ Use proper HTTP status codes (201 for create, 204 for delete, etc)
- ✅ Add JSDoc comments to public functions

---

## 🧪 Testing & Validation

### Unit Tests (Backend) — PASSING ✅

Os testes unitários cobrem produtos, transportes, reservas, isolamento por tenant e middleware Prisma. O número de testes deve ser obtido da execução atual e não é fixado aqui, porque muda quando novos casos são adicionados.

```
 PASS  src/app.controller.spec.ts
 PASS  src/services/__tests__/user.service.spec.ts
 PASS  src/users/users.service.spec.ts
 PASS  src/modules/transports/__tests__/transports.service.spec.ts
 PASS  src/modules/products/products.service.spec.ts

Test Suites: 5 passed, 5 total
Tests:       43 passed, 43 total
Snapshots:   0 total
Time:        6.573 s
Ran all test suites.
```

**⚠️ Important Note on Test Results:**
Notifications are **best-effort, non-blocking by design**. If notification delivery fails, the product state change still succeeds and returns (with a WARN-level log). This is intentional—a notification failure should never prevent inventory operations. Tests verify this behavior explicitly: they confirm both that (1) status changes complete, and (2) notification delivery is attempted. The tests pass, but failures in the notification subsystem will not cause 500 errors; they are logged and ignored.

**Setup required before running tests:**

```bash
cd backend-nest
npx prisma generate  # Regenerate Prisma client
npm test
```

**Test Coverage Notes:**

- Mocks cover all database operations (product, productMovement, user, notifications)
- Tests verify both status changes AND notification triggers
- Best-effort notification system: product state changes always succeed, notification delivery is non-blocking (documented catch with WARN-level logging)
- Mock cleanup between tests prevents cross-test contamination

Example (`backend-nest/src/products/products.service.spec.ts`):

```typescript
describe('ProductsService', () => {
  let service: ProductsService;
  let prisma: PrismaService;

  beforeEach(() => {
    const module = Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: { product: { create: jest.fn() } } },
      ],
    }).compile();
    service = module.get(ProductsService);
    prisma = module.get(PrismaService);
  });

  it('should create a product', async () => {
    jest.spyOn(prisma.product, 'create').mockResolvedValue({
      id: '1',
      code: 'TEST-001',
      state: 'RECEIVED',
      companyId: 'co1',
    });

    const result = await service.create({ code: 'TEST-001' }, 'co1');
    expect(result.state).toBe('RECEIVED');
    expect(prisma.product.create).toHaveBeenCalled();
  });
});
```

### E2E Tests (Full Flow) — REQUIRES REDIS

**Current status**: 12 failed, 3 passed (Redis connection required)

E2E tests require a running Redis instance at `127.0.0.1:6379`. The test suite connects to a real database and exercises full API flows.

```bash
cd backend-nest
npm run test:e2e
```

**To run E2E tests locally:**

1. Start Redis: `docker run -d -p 6379:6379 redis:7`
2. Run: `npm run test:e2e`

Example (`backend-nest/test/products.e2e-spec.ts`):

```typescript
describe('Products E2E', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  it('should create and list products', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', 'Bearer ' + token)
      .send({ code: 'TEST-001', quantity: 10 });

    expect(res.status).toBe(201);
    expect(res.body.code).toBe('TEST-001');
  });
});
```

### Frontend Tests

Test React components with React Testing Library:

```bash
npm test
```

### Current Test Coverage

- Unit Tests: executar `npm test` para obter o resultado atual da suite.
- E2E Tests: dependem da infraestrutura configurada, incluindo Redis e uma base de dados de teste; os resultados devem ser atualizados após cada alteração de schema ou módulos.
- Load tests: o script existe, mas os resultados dependem do endpoint, dos dados, da infraestrutura e da concorrência utilizados.

---

## 📖 Usage

### Basic Operation Flow

#### 1. Register a Company

1. Go to **http://localhost:5173/register**
2. Fill in company name, tax ID, email, phone, address, and administrator credentials
3. Log in with the newly created credentials

#### 2. Login

- **URL**: http://localhost:5173/login
- Test credentials (after seed):
  - **Admin**: `admin@example.com` / `admin123`
  - **Operator**: `operator@example.com` / `operator123`

#### 3. Add a Product

1. Go to **Products** → **New Product**
2. Fill in: unique code, description, quantity, unit, supplier, location (optional)
3. Product is automatically created in the **Received** state

#### 4. Manage States

1. Click a product in the list
2. Click **Change State**
3. Select the next permitted state (transitions are validated automatically)
4. Add notes if required and confirm

**Example flow:**

```
Received → Under Review → Approved → In Storage → In Preparation → In Shipment → Delivered
```

#### 5. View History

- Click a product to see all its movements
- Or go to **History** for a full system-wide operations log
- Filter by date, action, entity, or user

#### 6. Dashboard

- View inventory summary by state
- Analyse distribution with charts
- Monitor recent movements
- Identify products idle the longest

---

## 🔌 API Endpoints

### Authentication

| Method | Endpoint             | Description              | Auth |
| ------ | -------------------- | ------------------------ | ---- |
| POST   | `/api/auth/register` | Register company & admin | —    |
| POST   | `/api/auth/login`    | Login                    | —    |
| GET    | `/api/auth/me`       | Current user data        | ✅   |

### Products

| Method | Endpoint                       | Description      | Auth     |
| ------ | ------------------------------ | ---------------- | -------- |
| GET    | `/api/products`                | List products    | ✅       |
| GET    | `/api/products/:id`            | Product details  | ✅       |
| POST   | `/api/products`                | Create product   | ✅       |
| PUT    | `/api/products/:id`            | Update product   | ✅       |
| DELETE | `/api/products/:id`            | Delete product   | ✅ Admin |
| POST   | `/api/products/:id/transition` | Change state     | ✅       |
| GET    | `/api/products/:id/history`    | Movement history | ✅       |

### Dashboard

| Method | Endpoint                   | Description           | Auth |
| ------ | -------------------------- | --------------------- | ---- |
| GET    | `/api/dashboard/stats`     | General statistics    | ✅   |
| GET    | `/api/dashboard/by-status` | Distribution by state | ✅   |

### Suppliers

| Method | Endpoint             | Description     | Auth     |
| ------ | -------------------- | --------------- | -------- |
| GET    | `/api/suppliers`     | List suppliers  | ✅       |
| POST   | `/api/suppliers`     | Create supplier | ✅       |
| PUT    | `/api/suppliers/:id` | Update supplier | ✅       |
| DELETE | `/api/suppliers/:id` | Delete supplier | ✅ Admin |

### Vehicles

| Method | Endpoint            | Description    | Auth     |
| ------ | ------------------- | -------------- | -------- |
| GET    | `/api/vehicles`     | List vehicles  | ✅       |
| POST   | `/api/vehicles`     | Create vehicle | ✅       |
| PUT    | `/api/vehicles/:id` | Update vehicle | ✅       |
| DELETE | `/api/vehicles/:id` | Delete vehicle | ✅ Admin |

### Transports

| Method | Endpoint              | Description      | Auth     |
| ------ | --------------------- | ---------------- | -------- |
| GET    | `/api/transports`     | List transports  | ✅       |
| POST   | `/api/transports`     | Create transport | ✅       |
| PUT    | `/api/transports/:id` | Update transport | ✅       |
| DELETE | `/api/transports/:id` | Delete transport | ✅ Admin |

### Audit Log

| Method | Endpoint        | Description     | Auth |
| ------ | --------------- | --------------- | ---- |
| GET    | `/api/auditlog` | List audit logs | ✅   |

### Notifications

| Method | Endpoint                      | Description        | Auth |
| ------ | ----------------------------- | ------------------ | ---- |
| GET    | `/api/notifications`          | List notifications | ✅   |
| PUT    | `/api/notifications/:id/read` | Mark as read       | ✅   |
| PUT    | `/api/notifications/read-all` | Mark all as read   | ✅   |

---

## 🔄 Product States

| State              | Description                             | Allowed Next States         |
| ------------------ | --------------------------------------- | --------------------------- |
| **Received**       | Product just arrived at the warehouse   | Under Review                |
| **Under Review**   | Product being inspected                 | Approved, Rejected          |
| **Approved**       | Product cleared for storage             | In Storage                  |
| **Rejected**       | Non-conforming product                  | Under Return                |
| **In Storage**     | Product stored in the warehouse         | In Preparation, In Shipment |
| **In Preparation** | Product being prepared for dispatch     | In Shipment, Cancelled      |
| **In Shipment**    | Product in transit                      | Delivered                   |
| **Delivered**      | Product delivered to customer _(final)_ | —                           |
| **Under Return**   | Product being returned                  | Received, Disposed          |
| **Cancelled**      | Preparation cancelled                   | In Storage                  |
| **Disposed**       | Product discarded _(final)_             | —                           |

**Rules:**

- Only valid transitions are permitted (validated on the backend)
- Some states require mandatory notes
- Transition history is **immutable** and always recorded
- Permissions are checked before each transition

---

## 🔐 Permissions

### Super Admin

- Manage all companies
- Create global users
- Access aggregated dashboards
- System-wide configuration

### Administrator _(per company)_

- Full access within their company
- Approve or reject products
- Change any state
- Manage company users
- Delete products, suppliers, vehicles

### Operator _(per company)_

- Manage inventory and movements
- **Cannot** approve or reject products
- **Cannot** delete records
- Limited access to certain state transitions

---

## ✅ Implementation Status

### Validated (tested locally with real output)

- [x] Company-scoped routes and tenant-aware access patterns ✅
- [x] Product, supplier, transport, and notification modules ✅
- [x] Backend and frontend startup flow ✅
- [x] Unit tests for core services, reservations, transport flows, and tenant middleware are present
- [x] Authentication and role-based access control (3 roles) ✅
- [x] Audit logging and operation tracking ✅
- [x] Notification system integration (best-effort, non-blocking) ✅
- [x] Pagination and filtering contracts are implemented for the main list endpoints

### Not Yet Validated

- [ ] E2E tests (requires Redis infrastructure)
- [ ] Production deployment
- [ ] Kubernetes deployment (YAML files present but not tested in live cluster)
- [ ] Production-scale load testing or resilience benchmarks
- [ ] End-to-end UX testing with real users
- [ ] Docker image builds and runtime behavior
- [ ] Full CI/CD execution for the current schema and module set

### Not Included (Not in This Repository)

- Production certification of the Redis lock and reservation workflow
- BullMQ queue processor (present in Commerce backend, not in logistics)
- Checkout/saga pattern orchestration (present in Commerce backend, not in logistics)

---

## 🚨 Troubleshooting

### Database Issues

**Problem: "Database connection refused"**

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution:**

```bash
# Check if PostgreSQL is running
docker-compose ps

# If not running, start it
docker-compose up -d

# Verify DATABASE_URL in .env is correct:
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/logistica
```

**Problem: "Prisma migrations pending"**

```
Error: The database schema is not in sync with the Prisma schema.
```

**Solution:**

```bash
cd backend-nest
npx prisma migrate deploy  # Apply pending migrations
npx prisma generate       # Regenerate Prisma client
```

**Problem: "No database named 'logistica'"**

```bash
# Manual PostgreSQL (without Docker)
createdb logistica

# Then run migrations
npx prisma migrate deploy
```

---

### Backend Issues

**Problem: "Port 3000 already in use"**

```bash
# Find & kill process using port 3000
lsof -i :3000        # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Then kill the process
kill -9 <PID>        # macOS/Linux
taskkill /PID <PID> /F  # Windows
```

**Problem: "Cannot find module '@nestjs/core'"**

```bash
cd backend-nest
npm install
npm run build
```

**Problem: "Swagger docs not loading at /api/docs"**

- Ensure backend is running: `npm run start`
- Check firewall allows localhost:3000
- Try clearing browser cache (Ctrl+Shift+Delete)

---

### Frontend Issues

**Problem: "Frontend stuck on 'Loading...' at 3001"**

```bash
# Check if backend is running
curl http://localhost:3000/api/docs

# Check browser console for CORS errors
# If CORS error, verify CORS_ORIGIN in backend .env

# Try hard refresh or clear cache
Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
```

**Problem: "Cannot find module 'react'"**

```bash
cd frontend
npm install
npm run dev
```

**Problem: "Vite dev server port 3001 already in use"**

```bash
# Kill process
lsof -i :3001
kill -9 <PID>

# Or specify different port in vite.config.ts:
export default {
  server: {
    port: 3002  // Change to available port
  }
}
```

---

### Authentication Issues

**Problem: "401 Unauthorized — Invalid token"**

- Token expired? Login again
- Browser local storage cleared? Login again
- Check JWT_SECRET matches between frontend & backend

**Problem: "Cannot login — server error"**

```bash
# Check backend logs for details
npm run dev  # See console output

# Verify user exists in database
npx prisma studio  # Browse Users table
```

**Problem: "No login credentials after seed"**

```bash
# Run the seed script again
cd backend-nest
npm run seed
# Or for demo data:
npm run seed:demo

# Check the output for created credentials
# Look for "Created user: admin@logistica.com"
```

---

### Performance Issues

**Problem: "API calls very slow"**

1. Check database connection: `npx prisma studio`
2. Look for N+1 query problems in logs
3. Ensure indexes exist: `npx prisma db execute -- "CREATE INDEX idx_products_company ON products(company_id);"`

**Problem: "Frontend freezes after clicking buttons"**

- Open DevTools Network tab & check for hanging requests
- Look for errors in browser console
- Check if backend API is responding: `curl http://localhost:3000/api/products`

---

### Docker Issues

**Problem: "docker-compose up fails with error"**

```bash
# Remove old containers and volumes
docker-compose down -v

# Rebuild and start fresh
docker-compose up --build

# Check logs
docker-compose logs postgres
docker-compose logs backend-nest
```

---

### Git & Deployment Issues

**Problem: "Cannot push to GitHub"**

```bash
# Check remote URL is correct
git remote -v

# Fix if wrong
git remote set-url origin https://github.com/YOUR-USERNAME/logistica-multi-tenant.git

# Push
git push origin main
```

---

### Getting Help

1. **Check Existing Issues** → [GitHub Issues](https://github.com/GoncaloCoimbra/logistica-multi-tenant/issues)
2. **Search Error Message** → Copy exact error into Google/Stack Overflow
3. **Check Logs** → `npm run dev` shows detailed error messages
4. **Reset Everything** → `docker-compose down && rm -rf node_modules && npm install`

---

## 🔗 Useful Resources

### Documentation

- [DEMO.md](./DEMO.md) — Complete demo walkthrough
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — Detailed system design
- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) — Production deployment guide

### Official Documentation

- [NestJS Docs](https://docs.nestjs.com/)
- [Prisma Docs](https://www.prisma.io/docs/)
- [React Docs](https://react.dev/)
- [TailwindCSS Docs](https://tailwindcss.com/docs)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)

### Community

- [NestJS Discord](https://discord.gg/G7Qnnhy)
- [Prisma Community](https://www.prisma.io/community)
- [React Community](https://react.dev/community)

---

### Recommended Next Steps

1. Configure and run E2E tests with Redis in CI/CD.
2. Test Docker image builds and container startup.
3. Document deployment flow for production environments.
4. Add integration tests for multi-tenant isolation scenarios.
5. Set up GitHub Actions for automated test runs on commits.
6. Add load testing to validate performance under concurrent requests.
7. If Kubernetes deployment is desired, test k8s manifests in a real cluster (kind or minikube).

---

## 📚 Updated Documentation (June 2026)

### Design System & Frontend Refactoring

- **[IMPLEMENTATION_COMPLETE.md](./frontend/IMPLEMENTATION_COMPLETE.md)** — Complete refactoring guide (32 pages)
- **[START_HERE.md](./frontend/START_HERE.md)** — Quick start for design system
- **[PAGE_MIGRATION_EXAMPLE.md](./frontend/PAGE_MIGRATION_EXAMPLE.md)** — Before/after examples
- **[REFACTORING_CHECKLIST.md](./frontend/REFACTORING_CHECKLIST.md)** — Component mapping reference

### Project Documentation

- **[FINAL_COMPLETION_REPORT.md](../FINAL_COMPLETION_REPORT.md)** — Full project summary
- **[QUICK_START.md](../QUICK_START.md)** — 5-minute quick reference

### API Documentation

- **Live Swagger Docs**: `http://localhost:3000/api/docs` (when running)
- **[API.md](./docs/API.md)** — Complete endpoint reference

---

## 🤝 Contributing

Contributions are welcome!

1. Fork the project
2. Create a branch (`git checkout -b feature/MyFeature`)
3. Commit your changes (`git commit -m 'Add MyFeature'`)
4. Push to the branch (`git push origin feature/MyFeature`)
5. Open a Pull Request

### Guidelines

- Follow the existing code style
- Add tests for new features
- Update documentation as needed
- Keep commits small and focused
- Open an issue before starting extensive work

---

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

## 📞 Support

If you found a bug or have a suggestion:

1. Check existing [Issues](https://github.com/your-org/logistica-multi-tenant/issues)
2. Create a new issue if needed

---

---

**Portfolio module** — Code present in this repository reflects locally validated implementation.
For claims or features not explicitly marked as validated above, see the status section.
