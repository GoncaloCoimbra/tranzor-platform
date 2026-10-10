# Frontend - React + Vite + Tailwind

Modern interface for the multi-tenant logistics management platform.

## ðŸŽ¨ Design System (NEW)

The frontend is undergoing a **complete visual redesign** to match Website and ChatOps modules with a unified design system.

### Current Status ðŸŸ¢
- âœ… **Phase 1 Complete**: Design system & components (600+ lines CSS, 13 components)
- ðŸŸ¡ **Phase 2 Ready**: Page refactoring (0/35 pages done, ~4-5 hours remaining)
- â³ **Phase 3 Pending**: Testing & optimization

### What's New âœ¨
- âœ… Unified design tokens (colors, typography, spacing)
- âœ… New component library (Button, Input, Card, Badge, Alert)
- âœ… Light/Dark mode support with automatic switching (toggle ðŸŒ™)
- âœ… Brand red color (#d90429) with semantic palette
- âœ… New layout (Header, Sidebar, Footer) integrated

### Getting Started ðŸš€

**If you're refactoring pages:**
1. Read [PHASE1_COMPLETE.md](./PHASE1_COMPLETE.md) (2-min overview)
2. Follow [START_HERE.md](./START_HERE.md) (quick action plan)
3. Reference [PAGE_MIGRATION_EXAMPLE.md](./PAGE_MIGRATION_EXAMPLE.md) (before/after example)

**Key Component Usage:**
```tsx
import { Button, Input, Card, Badge, Alert } from '@/components/common';

<Button variant="primary">Save</Button>
<Input label="Email" type="email" />
<Card header={<h2>Title</h2>}>Content</Card>
<Badge variant="success">Active</Badge>
```

### Documentation ðŸ“š
All redesign guides in `frontend/` root:
- [PHASE1_COMPLETE.md](./PHASE1_COMPLETE.md) â€” Session summary
- [START_HERE.md](./START_HERE.md) â€” Quick action plan (read this first!)
- [IMPLEMENTATION_COMPLETE.md](./IMPLEMENTATION_COMPLETE.md) â€” Complete roadmap
- [PAGE_MIGRATION_EXAMPLE.md](./PAGE_MIGRATION_EXAMPLE.md) â€” Before/after examples
- [REFACTORING_CHECKLIST.md](./REFACTORING_CHECKLIST.md) â€” Component mapping
- [EXAMPLE_REFACTORED_PRODUCTLIST.md](./EXAMPLE_REFACTORED_PRODUCTLIST.md) â€” Full page example

### Quick Start

```bash
# In root, install dependencies
npm install

# Create .env.local or .env
cp .env.example .env.local

# Run in development
npm run --workspace=frontend dev

# Build for production
npm run --workspace=frontend build

# Tests with coverage
npm run --workspace=frontend test

# Tests with watch mode
npm run --workspace=frontend test:watch

# Lint
npm run --workspace=frontend lint

# Format
npm run --workspace=frontend format
```

## Structure

```
src/
â”œâ”€ main.tsx / index.tsx   # Entry point
â”œâ”€ App.tsx                # Root component
â”œâ”€ api/
â”‚  â””â”€ client.ts          # Axios instance + interceptors
â”œâ”€ components/            # Reusable components
â”‚  â”œâ”€ common/
â”‚  â”œâ”€ layout/
â”‚  â””â”€ ...
â”œâ”€ pages/                 # Pages (routes)
â”‚  â”œâ”€ Dashboard.tsx
â”‚  â”œâ”€ Products/
â”‚  â”œâ”€ Vehicles/
â”‚  â””â”€ ...
â”œâ”€ hooks/                 # Custom hooks
â”‚  â””â”€ useAuth.ts
â”œâ”€ contexts/              # Context API
â”œâ”€ services/              # Data logic (non-API)
â”œâ”€ types/                 # TypeScript types
â”œâ”€ utils/                 # Utility functions
â””â”€ styles/                # Global CSS

public/
â”œâ”€ index.html
â”œâ”€ favicon.ico
â””â”€ manifest.json
```

## Environment Variables

```bash
# .env.local
VITE_API_URL=http://localhost:3000/api
VITE_ENV=development
```

## Tests

```bash
# Run tests with coverage
npm run --workspace=frontend test

# Watch mode (useful during development)
npm run --workspace=frontend test:watch
```

### Test Example with React Testing Library

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('should render button', () => {
    render(<MyComponent />);
    const button = screen.getByRole('button', { name: /click/i });
    expect(button).toBeInTheDocument();
  });

  it('should call callback when clicked', async () => {
    const onClick = jest.fn();
    const user = userEvent.setup();
    render(<MyComponent onClick={onClick} />);
    
    const button = screen.getByRole('button');
    await user.click(button);
    
    expect(onClick).toHaveBeenCalled();
  });
});
```

## API and Integration

All HTTP requests should go through `src/api/client.ts`:

```typescript
import { apiClient } from '@api/client';

// GET
const users = await apiClient.get('/users');

// POST
const newProduct = await apiClient.post('/products', {
  name: 'Product',
  price: 100
});

// Centralized error interceptor
apiClient.interceptors.response.use(
  response => response,
  error => {
    // Handle auth errors, redirects, etc.
  }
);
```

## Design System and Tailwind

- Colors: defined in `tailwind.config.js`
- Components: reusable in `components/`
# Frontend Logistics

Frontend da demonstraÃ§Ã£o de portfolio para o mÃ³dulo de logÃ­stica.

## Objetivo
- mostrar o fluxo de gestÃ£o de produtos e stock
- servir como camada visual para a integraÃ§Ã£o com ChatOps

## ExecuÃ§Ã£o local
```bash
cd frontend
npm install
npm start
```
- Search by code, description or supplier
- Filter by state, location, and date
- Sorting and pagination

**Supplier and Vehicle Management**
- Complete CRUD
- Integration with products and transports

**Operations History**
- Complete audit
- Filters by action, entity and user
- Record of all changes

</details>

---

## âœ¨ Features

### Authentication and Security
- Multi-tenant system with total data isolation
- Three profiles: **Super Admin**, **Administrator** and **Operator**
- JWT authentication with refresh tokens
- SQL injection protection via Prisma ORM

### Inventory Management
- **Complete CRUD** of products
- State machine for lifecycle control
- Complete movement history
- Total traceability of each product
- Advanced filters (state, location, supplier, date)

### Analytics Dashboard
- Inventory summary by state
- Distribution charts (donut and bars)
- Movement statistics (last 30 days)
- Top 5 suppliers
- Real-time performance metrics

### ðŸšš Transport Management
- Fleet vehicle registration
- Transport creation and tracking
- Integration with products and states
- Status: In Transit, Delivered, Cancelled

### ðŸ‘¥ Supplier Management
- Complete CRUD of suppliers
- Product linkage
- Supply history

### ðŸ“œ Audit and History
- Automatic recording of all operations
- Filters by: date, action, entity, user
- Complete tracking of changes
- Immutable logs with timestamps

### ðŸ”” Notification System
- Alerts for products stuck in analysis
- Real-time notifications
- Notification history

---

## ðŸ› ï¸ Technology Stack

### Backend
| Technology | Version | Description |
|------------|---------|-------------|
| **Node.js** | 18+ | JavaScript Runtime |
| **TypeScript** | ^5.0 | Typed JavaScript Superset |
| **Express.js** | ^4.18 | Minimalist web framework |
| **Prisma** | ^5.0 | Modern ORM for Node.js |
| **PostgreSQL** | 15 | Relational database |
| **JWT** | - | Stateless authentication |
| **Zod** | ^3.22 | TypeScript schema validation |

### Frontend
| Technology | Version | Description |
|------------|---------|-------------|
| **React** | 18 | UI Library |
| **TypeScript** | ^5.0 | Static typing |
| **React Router** | v6 | SPA routing |
| **Tailwind CSS** | ^3.4 | Utility-first CSS framework |
| **Recharts** | ^2.5 | Charts for React |
| **Axios** | ^1.6 | HTTP client |
| **React Hot Toast** | - | Toast notifications |

### DevOps
- **Docker** & **Docker Compose**
- **PostgreSQL 15** (containerized)

---

## ðŸ—ï¸ Architecture

### Multi-Tenant Pattern

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚          Frontend (React SPA)           â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
               â”‚ HTTP/REST API
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚       Backend (Express + TypeScript)    â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”     â”‚
â”‚  â”‚  Auth Middleware (JWT)         â”‚     â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜     â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”     â”‚
â”‚  â”‚  Multi-Tenant Middleware       â”‚     â”‚
â”‚  â”‚  (companyId isolation)         â”‚     â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜     â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”     â”‚
â”‚  â”‚  Controllers & Services        â”‚     â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜     â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                â”‚ Prisma ORM
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚         PostgreSQL Database             â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”‚
â”‚  â”‚ Company 1 Data (isolated)        â”‚   â”‚
â”‚  â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤   â”‚
â”‚  â”‚ Company 2 Data (isolated)        â”‚   â”‚
â”‚  â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤   â”‚
â”‚  â”‚ Company N Data (isolated)        â”‚   â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### State Machine

```mermaid
stateDiagram-v2
    [*] --> Received
    Received --> UnderAnalysis
    UnderAnalysis --> Approved
    UnderAnalysis --> Rejected
    Rejected --> InReturn
    Approved --> InStorage
    InStorage --> InPreparation
    InStorage --> InExpedition
    InPreparation --> InExpedition
    InPreparation --> Cancelled
    InExpedition --> Delivered
    InReturn --> Received
    InReturn --> Eliminated
    Cancelled --> InStorage
    Delivered --> [*]
    Eliminated --> [*]
```

---

## ðŸš€ Getting Started

### Prerequisites

Make sure you have installed:
- **Node.js** 18 or higher
- **npm** or **yarn**
- **Docker** and **Docker Compose** (optional, but recommended)
- **PostgreSQL 15** (if not using Docker)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/your-user/logistica-multi-tenant.git
cd logistica-multi-tenant
```

2. **Install dependencies**

Backend:
```bash
cd backend
npm install
```

Frontend:
```bash
cd frontend
npm install
```

### Configuration

1. **Environment Variables**

Create a `.env` file in the `backend/` folder:

```env
# Environment
NODE_ENV=development

# Server
PORT=3000

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/logistica

# JWT
JWT_SECRET=your-super-secure-secret-key-minimum-32-random-characters
JWT_EXPIRES_IN=7d

# CORS (optional)
CORS_ORIGIN=http://localhost:3000
```

2. **Database with Docker (Recommended)**

```bash
# Start PostgreSQL
docker-compose up -d

# Run migrations
cd backend
npx prisma migrate dev
npx prisma generate
```

**Or without Docker:**

```bash
# Create database manually in PostgreSQL
createdb logistica

# Run migrations
cd backend
npx prisma migrate dev
npx prisma generate
```

3. **Database Seed (Optional)**

```bash
cd backend
npm run seed
```

This creates:
- 1 Super Admin
- 1 Example Company
- 1 Administrator
- 1 Operator
- Some test products

### Run the Application

**Development Mode:**

Terminal 1 - Backend:
```bash
cd backend
npm run dev
```

Terminal 2 - Frontend:
```bash
cd frontend
npm start
```

**Modo ProduÃ§Ã£o:**

```bash
# Backend
cd backend
npm run build
npm start

# Frontend
cd frontend
npm run build
# Serve the build/ folder with nginx or another server
```

### Acesso

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3000
- **Prisma Studio**: http://localhost:5555 (execute `npx prisma studio`)

---

## ðŸ“ Estrutura do Projeto

```
logistica-multi-tenant/
â”œâ”€â”€ backend/
â”‚   â”œâ”€â”€ prisma/
â”‚   â”‚   â”œâ”€â”€ schema.prisma          # Schema da BD
â”‚   â”‚   â”œâ”€â”€ migrations/            # MigraÃ§Ãµes
â”‚   â”‚   â””â”€â”€ seed.ts                # Dados iniciais
â”‚   â”œâ”€â”€ src/
â”‚   â”‚   â”œâ”€â”€ config/
â”‚   â”‚   â”‚   â”œâ”€â”€ database.ts        # Prisma Configuration
â”‚   â”‚   â”‚   â””â”€â”€ env.ts             # VariÃ¡veis de ambiente
â”‚   â”‚   â”œâ”€â”€ controllers/           # Controladores de rotas
â”‚   â”‚   â”‚   â”œâ”€â”€ auth.controller.ts
â”‚   â”‚   â”‚   â”œâ”€â”€ products.controller.ts
â”‚   â”‚   â”‚   â”œâ”€â”€ dashboard.controller.ts
â”‚   â”‚   â”‚   â”œâ”€â”€ suppliers.controller.ts
â”‚   â”‚   â”‚   â”œâ”€â”€ vehicles.controller.ts
â”‚   â”‚   â”‚   â”œâ”€â”€ transports.controller.ts
â”‚   â”‚   â”‚   â”œâ”€â”€ auditlog.controller.ts
â”‚   â”‚   â”‚   â””â”€â”€ notifications.controller.ts
â”‚   â”‚   â”œâ”€â”€ middlewares/
â”‚   â”‚   â”‚   â”œâ”€â”€ auth.middleware.ts
â”‚   â”‚   â”‚   â”œâ”€â”€ errorHandler.ts
â”‚   â”‚   â”‚   â”œâ”€â”€ roleCheck.middleware.ts
â”‚   â”‚   â”‚   â””â”€â”€ superAdmin.middleware.ts
â”‚   â”‚   â”œâ”€â”€ routes/               # DefiniÃ§Ã£o de rotas
â”‚   â”‚   â”œâ”€â”€ services/             # LÃ³gica de negÃ³cio
â”‚   â”‚   â”‚   â””â”€â”€ product-state.service.ts
â”‚   â”‚   â”œâ”€â”€ types/                # Tipos TypeScript
â”‚   â”‚   â”‚   â”œâ”€â”€ express.d.ts
â”‚   â”‚   â”‚   â””â”€â”€ product-states.ts
â”‚   â”‚   â”œâ”€â”€ utils/                # UtilitÃ¡rios
â”‚   â”‚   â””â”€â”€ server.ts             # Entry point
â”‚   â”œâ”€â”€ .env                      # VariÃ¡veis de ambiente
â”‚   â”œâ”€â”€ package.json
â”‚   â””â”€â”€ tsconfig.json
â”‚
â”œâ”€â”€ frontend/
â”‚   â”œâ”€â”€ public/
â”‚   â”œâ”€â”€ src/
â”‚   â”‚   â”œâ”€â”€ api/
â”‚   â”‚   â”‚   â””â”€â”€ config.ts        # Axios client
â”‚   â”‚   â”œâ”€â”€ components/           # Componentes React
â”‚   â”‚   â”‚   â”œâ”€â”€ CompanyModal.tsx
â”‚   â”‚   â”‚   â”œâ”€â”€ EditGlobalUserModal.tsx
â”‚   â”‚   â”‚   â”œâ”€â”€ Header.tsx
â”‚   â”‚   â”‚   â”œâ”€â”€ NotificationPanel.tsx
â”‚   â”‚   â”‚   â”œâ”€â”€ PrivateRoute.tsx
â”‚   â”‚   â”‚   â”œâ”€â”€ ProductHistoryModal.tsx
â”‚   â”‚   â”‚   â”œâ”€â”€ StateTransition.tsx
â”‚   â”‚   â”‚   â””â”€â”€ UserFormModal.tsx
â”‚   â”‚   â”œâ”€â”€ contexts/
â”‚   â”‚   â”‚   â””â”€â”€ AuthContext.tsx   # Authentication Context
â”‚   â”‚   â”œâ”€â”€ pages/                # PÃ¡ginas/Rotas
â”‚   â”‚   â”‚   â”œâ”€â”€ AuditLog.tsx
â”‚   â”‚   â”‚   â”œâ”€â”€ CompanyManagement.tsx
â”‚   â”‚   â”‚   â”œâ”€â”€ Dashboard.tsx
â”‚   â”‚   â”‚   â”œâ”€â”€ DashboardAdvanced.tsx
â”‚   â”‚   â”‚   â”œâ”€â”€ GlobalUserManagement.tsx
â”‚   â”‚   â”‚   â”œâ”€â”€ Login.tsx
â”‚   â”‚   â”‚   â”œâ”€â”€ NewProduct.tsx
â”‚   â”‚   â”‚   â”œâ”€â”€ ProductDetails.tsx
â”‚   â”‚   â”‚   â”œâ”€â”€ ProductList.tsx
â”‚   â”‚   â”‚   â”œâ”€â”€ Register.tsx
â”‚   â”‚   â”‚   â”œâ”€â”€ Settings.tsx
â”‚   â”‚   â”‚   â”œâ”€â”€ SuperAdminDashboard.tsx
â”‚   â”‚   â”‚   â”œâ”€â”€ SupplierList.tsx
â”‚   â”‚   â”‚   â”œâ”€â”€ TransportList.tsx
â”‚   â”‚   â”‚   â””â”€â”€ VehicleList.tsx
â”‚   â”‚   â”œâ”€â”€ App.tsx               # Componente raiz
â”‚   â”‚   â”œâ”€â”€ index.tsx             # Entry point
â”‚   â”‚   â””â”€â”€ index.css             # Estilos globais
â”‚   â”œâ”€â”€ tailwind.config.js
â”‚   â”œâ”€â”€ package.json
â”‚   â””â”€â”€ tsconfig.json
â”‚
â”œâ”€â”€ docker/
â”‚   â””â”€â”€ postgres/
â”œâ”€â”€ docker-compose.yml
â”œâ”€â”€ .gitignore
â””â”€â”€ README.md
```

---

## ðŸ“– Usage

### ðŸŽ¬ Basic Operation Flow

#### 1. Company Registration

1. Go to **http://localhost:3000/register**
2. Fill in:
   - Company name
   - Tax ID
   - Email, phone, address
   - Administrator user data
3. After registration, login with the created credentials

#### 2. Login

- **URL**: http://localhost:3000/login
- Test credentials (after seed):
  - **Admin**: `admin@example.pt` / `admin123`
  - **Operator**: `operator@example.pt` / `operator123`

#### 3. Add Product

1. Go to **Products** â†’ **New Product**
2. Fill in required data:
   - Unique code
   - Description
   - Quantity and unit
   - Supplier
   - Location (optional)
   - Notes (optional)
3. Product is automatically created in **Received** state

#### 4. Manage States

1. In product list, click on a product
2. Click **Change State**
3. Select next allowed state (transitions validated automatically)
4. Add notes if necessary
5. Confirm transition

**Example Flow:**
```
Received â†’ Under Analysis â†’ Approved â†’ In Storage â†’ 
In Preparation â†’ In Expedition â†’ Delivered
```

#### 5. Check History

- Click on a product to see all movements
- Or go to **History** to see all system operations
- Filters by date, action, entity or user

#### 6. Dashboard

- Acede ao **Dashboard** para:
  - Ver resumo do inventÃ¡rio por estado
  - Analisar distribuiÃ§Ã£o com grÃ¡ficos
  - Monitorizar movimentaÃ§Ãµes recentes
  - Identify products stopped for longer time

---

## ðŸ”Œ API Endpoints

### Authentication

| MÃ©todo | Endpoint | DescriÃ§Ã£o | Auth |
|--------|----------|-----------|------|
| POST | `/api/auth/register` | Company registration and admin |  |
| POST | `/api/auth/login` | Login |  |
| GET | `/api/auth/me` | Dados do utilizador |  |

### Products

| MÃ©todo | Endpoint | DescriÃ§Ã£o | Auth |
|--------|----------|-----------|------|
| GET | `/api/products` | Lista products |  |
| GET | `/api/products/:id` | Detalhes de um product |  |
| POST | `/api/products` | Criar product |  |
| PUT | `/api/products/:id` | Atualizar product |  |
| DELETE | `/api/products/:id` | Eliminar product |  Admin |
| POST | `/api/products/:id/transition` | Alterar estado |  |
| GET | `/api/products/:id/history` | HistÃ³rico de movimentaÃ§Ãµes |  |

### Dashboard

| MÃ©todo | Endpoint | DescriÃ§Ã£o | Auth |
|--------|----------|-----------|------|
| GET | `/api/dashboard/stats` | EstatÃ­sticas gerais |  |
| GET | `/api/dashboard/by-status` | DistribuiÃ§Ã£o por estado |  |

### Suppliers

| MÃ©todo | Endpoint | DescriÃ§Ã£o | Auth |
|--------|----------|-----------|------|
| GET | `/api/suppliers` | List suppliers |  |
| POST | `/api/suppliers` | Create supplier |  |
| PUT | `/api/suppliers/:id` | Update supplier |  |
| DELETE | `/api/suppliers/:id` | Delete supplier |  Admin |

### Vehicles

| MÃ©todo | Endpoint | DescriÃ§Ã£o | Auth |
|--------|----------|-----------|------|
| GET | `/api/vehicles` | List vehicles |  |
| POST | `/api/vehicles` | Create vehicle |  |
| PUT | `/api/vehicles/:id` | Update vehicle |  |
| DELETE | `/api/vehicles/:id` | Delete vehicle |  Admin |

### Transports

| MÃ©todo | Endpoint | DescriÃ§Ã£o | Auth |
|--------|----------|-----------|------|
| GET | `/api/transports` | List transports |  |
| POST | `/api/transports` | Create transport |  |
| PUT | `/api/transports/:id` | Update transport |  |
| DELETE | `/api/transports/:id` | Delete transport |  Admin |

### Auditoria

| MÃ©todo | Endpoint | DescriÃ§Ã£o | Auth |
|--------|----------|-----------|------|
| GET | `/api/auditlog` | Lista logs de auditoria |  |

### NotificaÃ§Ãµes

| MÃ©todo | Endpoint | DescriÃ§Ã£o | Auth |
|--------|----------|-----------|------|
| GET | `/api/notifications` | Lista notificaÃ§Ãµes |  |
| PUT | `/api/notifications/:id/read` | Marcar como lida |  |
| PUT | `/api/notifications/read-all` | Marcar todas como lidas |  |

---

## ðŸ”„ Product States

### Available States

| State | Description | Next Allowed States |
|-------|-------------|-------------------|
| **Received** | Product just arrived at warehouse | Under Analysis |
| **Under Analysis** | Product being inspected | Approved, Rejected |
| **Approved** | Product approved for storage | In Storage |
| **Rejected** | Non-conforming product | In Return |
| **In Storage** | Product stored in warehouse | In Preparation, In Expedition |
| **In Preparation** | Product being prepared for shipment | In Expedition, Cancelled |
| **In Expedition** | Product in transport | Delivered |
| **Delivered** | Product delivered to client (final) | - |
| **In Return** | Product in return process | Received, Eliminated |
| **Cancelled** | Preparation cancelled | In Storage |
| **Eliminated** | Product discarded (final) | - |

### Transition Rules

- **Only valid transitions** are allowed (validated in backend)
- Some states require **mandatory notes**
- Transition history is **immutable** and always recorded
- Permissions are checked before each transition

---

## Permissions

### Super Admin

**Full system access:**
- Management of all companies
- Creation of new global users
- Access to aggregated dashboards
- System configurations

### Administrator (per company)

**Full access within their company:**
- Approve or reject products
- Change any state
- Manage company users
- Access all modules
- Delete products, suppliers, vehicles

### Operator (per company)

**Acesso restrito:**
- Gerir inventÃ¡rio e movimentaÃ§Ãµes
- **Cannot** approve or reject products
- **NÃ£o pode** eliminar registos
- Acesso limitado a determinadas transiÃ§Ãµes de estado

---

## ðŸ’» Development Guide

### Before Programming

ðŸ“– **Read the requirements document 3 times:**

1. **First reading**: Understand the general scope
2. **Second reading**: Highlight mandatory fields, transitions, business rules
3. **Third reading**: Make notes about implementation

### Plan Before Coding

Draw on paper or visual tool:

1. **Database Structure**
   - Tables and fields
   - Relationships (FK)
   - Important indexes
   - âš ï¸ Don't forget `companyId` in multi-tenant tables

2. **Fluxo de Estados**
   - Diagrama com todos os estados
   - Setas com transiÃ§Ãµes permitidas
   - Quem pode fazer cada transiÃ§Ã£o

3. **Estrutura de Pastas**
   - Controllers, services, routes
   - Componentes React
   - Logical organization

4. **Application Screens**
   - Rascunho de cada pÃ¡gina
   - PosiÃ§Ã£o de filtros, tabelas, formulÃ¡rios

### Executar Testes

```bash
cd backend
npm test
```

### Generate Prisma Migration

```bash
cd backend
npx prisma migrate dev --name nome_da_migracao
```

### Visualizar Base de Dados

```bash
cd backend
npx prisma studio
```

Acede a http://localhost:5555

### Boas PrÃ¡ticas

-  Sempre validar input com Zod
-  Sempre filtrar por `companyId` em queries multi-tenant
-  Registar operaÃ§Ãµes importantes no audit log
-  Usar transaÃ§Ãµes Prisma para operaÃ§Ãµes complexas
-  Escrever testes para lÃ³gica crÃ­tica
-  Documentar endpoints na API
-  Usar variÃ¡veis de ambiente para secrets

---

## ðŸ—ºï¸ Roadmap

### Fase 1 - ConcluÃ­do 
- [x] Sistema multi-tenant
- [x] JWT Authentication
- [x] Product CRUD
- [x] MÃ¡quina de estados
- [x] Dashboard bÃ¡sico
- [x] Operation history

### Fase 2 - ConcluÃ­do 
- [x] Supplier management
- [x] Vehicle management
- [x] Transport management
- [x] Sistema de notificaÃ§Ãµes
- [x] Dashboard avanÃ§ado
- [x] Super Admin

### Fase 3 - Em Desenvolvimento ðŸš§
- [ ] RelatÃ³rios avanÃ§ados em PDF
- [ ] Data export (Excel, CSV)
- [ ] Carrier API integration
- [ ] Sistema de alertas configurÃ¡vel
- [ ] Mobile app (React Native)

### Fase 4 - Planeado ðŸ“‹
- [ ] Cross-company integration
- [ ] Transport marketplace
- [ ] BI e anÃ¡lise preditiva
- [ ] ERP integration
- [ ] API pÃºblica para terceiros

---

## ðŸ¤ Contribute

Contributions are welcome! This project was developed for the **Commit PT** community on Discord.

1. Fork the project
2. Create a branch for your feature (`git checkout -b feature/MyFeature`)
3. Commit changes (`git commit -m 'Add MyFeature'`)
4. Push to the branch (`git push origin feature/MyFeature`)
5. Open a Pull Request

### Guidelines

- Follow the existing code style
- Add tests for new features
- Update documentation as needed
- Keep commits small and focused

---

## ðŸ“„ License

This project is under the MIT license. See the [LICENSE](LICENSE) file for more details.

---

## ðŸ‘¥ Community

This project was developed for the [**Commit PT**] community
Join the community to:
- Get help with project questions
- Share improvements
- Collaborate with other developers
- Showcase your portfolio

---

## ðŸ“ž Support

If you found any issues or have suggestions:

1. Check existing [Issues](**will add when finished**)
2. Create a new issue if necessary
3. Contact the creator




**Developed by GonÃ§alo Coimbra**
