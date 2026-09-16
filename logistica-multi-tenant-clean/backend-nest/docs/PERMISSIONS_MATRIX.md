# Permission Matrix

## Guard model currently implemented

The API currently enforces access through these guards:

- `JwtAuthGuard`: requires a valid bearer token, except routes marked `@Public()`.
- `RolesGuard`: evaluates the `@Roles(...)` metadata. `SUPER_ADMIN` is currently allowed by the guard whenever role metadata exists.
- `TenantGuard`: requires a `companyId` for `ADMIN` and `OPERATOR`, and scopes tenant-aware queries to that company. `SUPER_ADMIN` is global.
- `ApiKeyGuard`: protects the public stock integration endpoint.

There is no `PermissionGuard` class in this repository yet. This document records the verified current middleware instead of claiming a guard that does not exist.

| Area | Controller guard | Role metadata | Tenant scope | Status |
|---|---|---|---|---|
| Auth | Route-level `JwtAuthGuard` | Route-specific | Not applicable | Verified |
| Companies | `JwtAuthGuard`, `RolesGuard`, route `TenantGuard` | `SUPER_ADMIN`, `ADMIN`, `OPERATOR` by route | Company reads/writes checked | Verified |
| Dashboard | `JwtAuthGuard`, `RolesGuard`, `TenantGuard` | `ADMIN`, `OPERATOR`, `SUPER_ADMIN` | `companyId` applied for non-super-admin | Verified |
| Products | `JwtAuthGuard`, `RolesGuard`, `TenantGuard` | `ADMIN`, `OPERATOR` | `companyId` applied | Verified |
| Suppliers | `JwtAuthGuard`, `RolesGuard`, `TenantGuard` | Controller/route metadata | `companyId` applied | Verified |
| Vehicles | `JwtAuthGuard`, `RolesGuard`, `TenantGuard` | Controller/route metadata | `companyId` applied | Verified |
| Transports | `JwtAuthGuard`, `RolesGuard`, `TenantGuard` | Controller/route metadata | `companyId` applied | Verified |
| Users | `JwtAuthGuard`, `RolesGuard`, `TenantGuard` | Controller/route metadata | `companyId` applied | Verified |
| Super admin | `JwtAuthGuard`, `RolesGuard` | `SUPER_ADMIN` at controller level | Global | Verified |
| Audit log | `JwtAuthGuard`, `RolesGuard`, `TenantGuard` | Route metadata | `companyId` applied | Verified |
| Notifications | `JwtAuthGuard`, `RolesGuard` | Route metadata | Service scopes by company | Verified |
| Reports | `JwtAuthGuard`, `RolesGuard`, `TenantGuard` | Route metadata | `companyId` applied | Verified |

## Remaining permission hardening

A separate `PermissionGuard` should only be introduced with an explicit permission model (for example, `company.read`, `user.write`, and `product.write`). Until that model exists, replacing the existing role and tenant guards would create an undocumented authorization contract.

The E2E suite covers tenant isolation and super-admin access for companies, users, dashboard statistics, and user creation. It does not claim 100% route-level authorization coverage.
