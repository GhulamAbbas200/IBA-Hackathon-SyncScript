# SyncScript

SyncScript is a powerful, real-time narrative intelligence and collaboration platform designed to help teams organize, analyze, and synthesize information from various sources. It features secure "Vaults" for managing content, role-based access control, and real-time synchronization.

## 🚀 Features

- **Secure Vaults**: Create and manage isolated workspaces (Vaults) for different projects or teams.
- **Role-Based Access Control (RBAC)**: Granular permissions for Owners, Contributors, and Viewers.
- **Multi-Source Support**: Add URLs, PDFs (via AWS S3), and other documents as sources.
- **Real-Time Collaboration**: Live updates using Socket.io for shared sessions.
- **Annotations**: Highlight and annotate content within sources.
- **Audit Logging**: Track all user actions and changes within a vault.
- **Responsive UI**: Modern, glassmorphism-inspired interface built with Next.js and Tailwind CSS.
- **Secure Authentication**: JWT-based auth with encrypted passwords.

## 🛠️ Tech Stack

### Client (Frontend)
- **Framework:** [Next.js 16](https://nextjs.org/) (App Router, React 19)
- **Styling:** [Tailwind CSS 4](https://tailwindcss.com/), `clsx`, `tailwind-merge`
- **Animation:** [Framer Motion](https://www.framer.com/motion/)
- **Icons:** [Lucide React](https://lucide.dev/)
- **HTTP Client:** Axios
- **Real-time:** Socket.io-client

### Server (Backend)
- **Runtime:** [Node.js](https://nodejs.org/) with Express
- **Database:** PostgreSQL
- **ORM:** [Prisma](https://www.prisma.io/)
- **Caching:** Redis
- **Storage:** AWS S3 (via `@aws-sdk/client-s3`)
- **Authentication:** JWT, Bcrypt
- **Validation:** Zod
- **Real-time:** Socket.io

### Infrastructure & DevOps
- **Containerization:** Docker & Docker Compose (PostgreSQL, Redis)
- **Language:** TypeScript (Full-stack)

## 📋 Prerequisites

Ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v18+ recommended)
- [Docker & Docker Compose](https://www.docker.com/) (for database and cache)
- [Git](https://git-scm.com/)

## ⚙️ Environment Setup

You need to configure environment variables for both the client and server.

### Server Configuration
Create a `.env` file in the `server` directory based on the following template:

```env
# Database (matches docker-compose service)
DATABASE_URL="postgresql://user:password@localhost:5432/syncscript"

# JWT Secret (generate a strong random string)
JWT_SECRET="your-super-secret-jwt-key"

# AWS S3 Configuration (for file uploads)
AWS_REGION="us-east-1"
AWS_BUCKET_NAME="your-bucket-name"
AWS_ACCESS_KEY_ID="your-access-key-id"
AWS_SECRET_ACCESS_KEY="your-secret-access-key"
```

### Client Configuration
No specific `.env` is enforcing strict requirements for the build in the provided code, but if you have API endpoints configured differently, check `client/src/lib/api.ts` or `next.config.ts`. Typical setups might check for `NEXT_PUBLIC_API_URL`.

## 🚀 Installation & Running

### 1. Start Infrastructure (One-time Setup)
Use Docker Compose to spin up the PostgreSQL database and Redis instance.

```bash
# From project root
docker-compose up -d
```
*This will also run a helper container to push the Prisma schema to the database.*

### 2. Backend Setup
Navigate to the server directory, install dependencies, and start the server.

```bash
cd server
npm install

# Run database migrations (if not handled by docker)
npx prisma generate
npx prisma db push

# Start in development mode
npm run dev
```
The server will start (default port usually 3000, 4000, or 5000 - check `index.ts`).

### 3. Frontend Setup
Open a new terminal, navigate to the client directory, and start the application.

```bash
cd client
npm install
npm run dev
```
The application will be available at `http://localhost:3000`.

## 📂 Project Structure

```
SyncScript/
├── client/                 # Next.js Frontend
│   ├── src/
│   │   ├── app/            # App Router pages
│   │   ├── components/     # Reusable UI components
│   │   ├── lib/            # Utilities & API clients
│   └── package.json
├── server/                 # Express Backend
│   ├── src/
│   │   ├── controllers/    # Request handlers
│   │   ├── middleware/     # Auth & validation middleware
│   │   ├── routes/         # API route definitions
│   │   └── index.ts        # Entry point
│   ├── prisma/             # Database schema
│   └── package.json
├── docker-compose.yml      # DB & Redis services
└── README.md
```

