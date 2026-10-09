# Docker and Kubernetes

This deployment contains the root Tranzor app, ChatOps and logistics. It is
separate from the existing Compose development workflow; no existing databases,
volumes or running services are modified by creating these files.

## Build the images

Run these commands from the repository root. Set the ChatOps WebSocket URL to
the public `ws://` or `wss://` URL for the ChatOps host before building when it
differs from the local HTTP example.

```sh
docker build -t tranzor-backend:local ./backend
docker build -t tranzor-frontend:local ./frontend
docker build -t chatops-backend:local ./Chatops/backend
docker build -t chatops-frontend:local \
  --build-arg VITE_API_URL=/api \
  --build-arg VITE_WS_URL=ws://chatops.local/ws \
  ./Chatops/frontend
docker build -t logistica-backend:local \
  -f logistica-multi-tenant-clean/backend-nest/Dockerfile \
  ./logistica-multi-tenant-clean
docker build -t logistica-frontend:local \
  -f logistica-multi-tenant-clean/frontend/Dockerfile \
  ./logistica-multi-tenant-clean/frontend
```

For a remote cluster, push these images to a registry and update the image
references in the corresponding Deployments. For a local `kind` cluster, load
the built images with `kind load docker-image`; use the equivalent image-loading
command for other local Kubernetes distributions.

## Secrets

Copy `k8s/secrets.env.example` to `k8s/secrets.env`, replace every example value
with unique credentials, and keep that file out of version control. Keep each
database URL password identical to the password in the matching
`POSTGRES_*_PASSWORD` entry, each MongoDB URI credential identical to the
MongoDB root entries, and all Redis URLs synchronized with `REDIS_PASSWORD`.
`CHATOPS_JWT_SECRET` must be the same value as `TRANZOR_JWT_SECRET`.
Passwords in URLs must be URL-safe or URL-encoded. Create the namespace and
Secret before applying the workloads:

```sh
kubectl apply -f k8s/namespace.yaml
kubectl -n tranzor create secret generic deployment-secrets \
  --from-env-file=k8s/secrets.env
kubectl apply -k k8s
```

Kubernetes Secrets are not a substitute for a secret manager: configure
encryption at rest and access controls, or use your cluster's supported external
secret integration. Do not commit the populated `secrets.env`.

## Cluster requirements and checks

- A default StorageClass able to provision ReadWriteOnce volumes.
- An NGINX Ingress controller; configure DNS or local host entries for
  `tranzor.local`, `logistica.local` and `chatops.local`.
- ChatOps uses Commerce-backed cookie authentication and is exposed at
  `http://chatops.local` through the frontend NGINX proxy, which forwards API,
  upload and WebSocket paths to the backend. The frontend image's
  `VITE_WS_URL` is fixed at build time; rebuild it with the correct `ws://` or
  `wss://` URL whenever the hostname or TLS configuration changes.
- Keep `chatops-backend` at one replica: its live presence, connections and call
  rooms are process-local. The local `http://` setup is not suitable for public
  production traffic; configure TLS, production cookie settings and verify
  authentication and WebSocket behavior before external exposure.
- Apply Tranzor and logistics Prisma migrations to their PostgreSQL databases
  before relying on those APIs. The ChatOps directory currently has no
  versioned Prisma migrations; its database schema needs a separately reviewed
  initialization process. The manifests do not run `prisma db push` or alter
  schemas automatically.

After the databases are ready, the Tranzor image applies its migrations on
startup and fails to start if migration deployment fails. Logistics migrations
can be run explicitly from a running backend container:

```sh
kubectl -n tranzor exec deploy/logistica-backend -- \
  npx prisma migrate deploy --schema prisma/schema.prisma
```

Render and inspect the resources before applying them:

```sh
kubectl kustomize k8s
kubectl diff -k k8s
kubectl apply -k k8s
kubectl -n tranzor get pods,services,ingress,pvc
```

Database and WebSocket workloads deliberately start with one replica. MongoDB,
PostgreSQL, Redis and ClickHouse here are single-node StatefulSets, not
high-availability database clusters. ChatOps keeps live connections and message
state in process memory, so increasing its replicas would change behavior.
Use managed data services or a separately designed HA topology for production
availability requirements.
