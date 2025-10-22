# 🚀 MindsDB RAG Assistant Platform Startup Guide

This guide will help you get the MindsDB RAG Assistant platform up and running in different environments.

## 📋 Prerequisites

### Required Software
- **Node.js 18+** - [Download here](https://nodejs.org/)
- **Docker & Docker Compose** - [Download here](https://www.docker.com/get-started)
- **Git** - [Download here](https://git-scm.com/)

### Optional Tools
- **AWS CLI** - For cloud deployment
- **PostgreSQL Client** - For database management
- **Redis CLI** - For cache management

## 🛠️ Quick Start (Development)

### 1. Clone and Setup
```bash
# Clone the repository
git clone <repository-url>
cd mindsdb-rag-assistant

# Run the automated setup script
./scripts/dev-setup.sh
```

The setup script will:
- ✅ Check prerequisites (Node.js, Docker)
- ✅ Install npm dependencies
- ✅ Create `.env` file with defaults
- ✅ Start PostgreSQL and Redis containers
- ✅ Run database migrations
- ✅ Verify system health

### 2. Start Development Server
```bash
npm run dev
```

Your platform will be available at:
- **API**: http://localhost:3000
- **Health Check**: http://localhost:3000/health
- **API Docs**: http://localhost:3000/api/docs

## 🔧 Manual Setup (Step by Step)

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
```bash
# Copy example environment file
cp .env.example .env

# Edit the .env file with your configuration
nano .env  # or use your preferred editor
```

### 3. Start Infrastructure Services
```bash
# Start PostgreSQL and Redis
./scripts/start.sh dev

# Or manually with docker-compose
docker-compose up -d postgres redis
```

### 4. Database Setup
```bash
# Complete database setup (includes schema, migrations, and vector setup)
./scripts/setup-db.sh

# Or manually:
npm run db:generate
docker compose exec -T postgres psql -U postgres -d mindsdb_rag < database/migrations/001_initial_schema.sql
docker compose exec -T postgres psql -U postgres -d mindsdb_rag < drizzle/0000_*.sql
docker compose exec postgres psql -U postgres -d mindsdb_rag -c "ALTER TABLE documents ALTER COLUMN embedding TYPE vector(1536) USING embedding::vector;"
docker compose exec postgres psql -U postgres -d mindsdb_rag -c "CREATE INDEX IF NOT EXISTS idx_documents_embedding_ivfflat ON documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);"

# Optional: Seed with sample data
npm run db:seed
```

### 5. Start the Application
```bash
# Development mode (with hot reload)
npm run dev

# Production mode
npm run build
npm start
```

## 🐳 Docker Deployment Options

### Development with Tools
```bash
# Start with development tools (pgAdmin, Redis UI)
./scripts/start.sh tools
npm run dev
```

Access development tools:
- **pgAdmin**: http://localhost:8080 (admin@mindsdb.com / admin)
- **Redis UI**: http://localhost:8081

### Production Deployment
```bash
# Start production environment
./scripts/start.sh prod

# Build and start application
npm run build
npm start
```

## 🌐 Environment Configurations

### Development (.env)
```bash
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug

# Local database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mindsdb_rag
DB_USERNAME=postgres
DB_PASSWORD=password

# Local Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Development settings
METRICS_ENABLED=true
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

### Production (.env.production)
```bash
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Production database (RDS)
DB_HOST=your-rds-endpoint.amazonaws.com
DB_PORT=5432
DB_NAME=mindsdb_rag_prod
DB_USERNAME=your-db-user
DB_PASSWORD=your-secure-password
DB_SSL=true

# Production Redis (ElastiCache)
REDIS_HOST=your-elasticache-endpoint.amazonaws.com
REDIS_PORT=6379
REDIS_TLS=true

# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# Security
JWT_SECRET=your-production-jwt-secret
ENCRYPTION_KEY=your-production-encryption-key
CORS_ORIGINS=https://your-domain.com
```

## 🔍 Service Health Checks

### Check System Status
```bash
# Quick health check
npm run health

# Or manually
curl http://localhost:3000/health
```

### Individual Service Checks
```bash
# PostgreSQL
docker-compose exec postgres pg_isready -U postgres -d mindsdb_rag

# Redis
docker-compose exec redis redis-cli ping

# Application logs
docker-compose logs -f
```

## 📊 Available Services & Endpoints

### Core API Endpoints
| Service | Endpoint | Description |
|---------|----------|-------------|
| Health | `/health` | System health check |
| API Info | `/api` | API version and endpoints |
| Chat | `/api/chat` | RAG-enhanced chat |
| Documents | `/api/documents` | Document management |
| Sessions | `/api/sessions` | Session management |
| Search | `/api/search/semantic` | Semantic search |
| Checkout | `/api/checkout` | E-commerce checkout |
| Bedrock Agent | `/api/bedrock-agent` | AWS Bedrock AI |

### Infrastructure Services
| Service | Port | Access |
|---------|------|--------|
| PostgreSQL | 5432 | localhost:5432 |
| Redis | 6379 | localhost:6379 |
| pgAdmin | 8080 | http://localhost:8080 |
| Redis UI | 8081 | http://localhost:8081 |

## 🧪 Testing the Platform

### Run Tests
```bash
# All tests
npm test

# Specific test suites
npm run test:e2e          # End-to-end tests
npm run test:security     # Security tests
npm run test:performance  # Performance tests

# With coverage
npm run test:coverage
```

### Manual API Testing
```bash
# Test health endpoint
curl http://localhost:3000/health

# Test chat endpoint (requires auth)
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{
    "query": "Hello, how can you help me?",
    "merchantId": "test-merchant",
    "sessionId": "test-session"
  }'
```

## 🔧 Development Commands

### Database Management
```bash
npm run db:generate    # Generate schema from code
./scripts/setup-db.sh  # Complete database setup
npm run db:push        # Push schema to database
npm run db:studio      # Open Drizzle Studio
npm run db:reset       # Reset database completely
npm run db:seed        # Seed with sample data
```

### Docker Management
```bash
npm run docker:up      # Start all services
npm run docker:down    # Stop all services
npm run docker:logs    # View logs
npm run docker:reset   # Reset all data
```

### Code Quality
```bash
npm run lint           # Lint code
npm run format         # Format code
npm run type-check     # TypeScript check
npm run security:audit # Security audit
```

## 🚨 Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>
```

#### Database Connection Failed
```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Check logs
docker-compose logs postgres

# Restart PostgreSQL
docker-compose restart postgres
```

#### Redis Connection Failed
```bash
# Check Redis status
docker-compose ps redis

# Test Redis connection
docker-compose exec redis redis-cli ping

# Restart Redis
docker-compose restart redis
```

#### Permission Denied on Scripts
```bash
# Make scripts executable
chmod +x scripts/*.sh
```

### Reset Everything
```bash
# Complete reset (removes all data)
./scripts/reset.sh

# Or manually
docker-compose down -v
docker-compose up -d
npm run db:migrate
```

## 📈 Monitoring & Logs

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f postgres
docker-compose logs -f redis

# Application logs (when running)
npm run dev  # Shows logs in console
```

### Monitoring Endpoints
```bash
# Health check
curl http://localhost:3000/health

# Detailed health
curl http://localhost:3000/health/detailed

# Metrics (if enabled)
curl http://localhost:3000/metrics
```

## 🌍 Production Deployment

### AWS Infrastructure
```bash
# Deploy infrastructure
npm run infra:deploy

# Destroy infrastructure
npm run infra:destroy
```

### Environment Variables for Production
Ensure these are set in your production environment:
- `NODE_ENV=production`
- Database credentials (RDS)
- Redis credentials (ElastiCache)
- AWS credentials and region
- Security keys (JWT, encryption)
- CORS origins for your domain

### Production Checklist
- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] SSL certificates installed
- [ ] Security headers configured
- [ ] Monitoring and logging set up
- [ ] Backup strategy implemented
- [ ] Load balancer configured
- [ ] Auto-scaling configured

## 🆘 Getting Help

### Documentation
- **API Documentation**: `/docs/api/README.md`
- **Architecture**: `/.kiro/specs/mindsdb-rag-assistant/design.md`
- **Requirements**: `/.kiro/specs/mindsdb-rag-assistant/requirements.md`

### Support Commands
```bash
# System information
npm run health

# Generate support report
npm run security:report

# View configuration
cat .env
```

### Useful Resources
- [MindsDB Documentation](https://docs.mindsdb.com/)
- [AWS Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Redis Documentation](https://redis.io/documentation)

---

## 🎉 Success!

If everything is working correctly, you should see:
- ✅ All services running (`docker-compose ps`)
- ✅ Health check passing (`curl http://localhost:3000/health`)
- ✅ API responding (`curl http://localhost:3000/api`)
- ✅ Database connected
- ✅ Redis connected

Your MindsDB RAG Assistant platform is now ready for development! 🚀