# MindsDB Setup Guide - Self-Hosted

## 🏠 Self-Hosted MindsDB Setup

Since you're running your own MindsDB instance, here's how to configure it properly:

### Option 1: Docker Setup (Recommended)
```bash
# Pull and run MindsDB with Docker
docker run -p 47334:47334 mindsdb/mindsdb

# Or with persistent storage
docker run -p 47334:47334 -v mindsdb_storage:/root/mindsdb_storage mindsdb/mindsdb
```

### Option 2: Python Installation
```bash
# Install MindsDB
pip install mindsdb

# Start MindsDB server
python -m mindsdb --api http --port 47334

# Or with specific configuration
python -m mindsdb --config /path/to/config.json
```

### Option 3: Docker Compose (Integrated)
Add MindsDB to your existing `docker-compose.yml`:
```yaml
services:
  mindsdb:
    image: mindsdb/mindsdb:latest
    ports:
      - "47334:47334"
    volumes:
      - mindsdb_data:/root/mindsdb_storage
    environment:
      - MINDSDB_STORAGE_PATH=/root/mindsdb_storage
    restart: unless-stopped

volumes:
  mindsdb_data:
```

## 🔧 Configuration for Self-Hosted

### Update your `.env` file:
```bash
# MindsDB Configuration (Self-Hosted)
MINDSDB_ENDPOINT=http://localhost:47334
MINDSDB_API_KEY=your_api_key_or_leave_empty
MINDSDB_USERNAME=mindsdb
MINDSDB_PASSWORD=your_password_or_leave_empty
MINDSDB_TIMEOUT=30000
```

### Authentication Options:

**Option 1: No Authentication (Default)**
```bash
MINDSDB_ENDPOINT=http://localhost:47334
MINDSDB_API_KEY=
MINDSDB_USERNAME=
MINDSDB_PASSWORD=
```

**Option 2: Username/Password**
```bash
MINDSDB_ENDPOINT=http://localhost:47334
MINDSDB_USERNAME=mindsdb
MINDSDB_PASSWORD=your_password
```

**Option 3: API Key**
```bash
MINDSDB_ENDPOINT=http://localhost:47334
MINDSDB_API_KEY=your_custom_api_key
```

## 🧪 Testing Your Self-Hosted Setup

### 1. Check MindsDB is Running
```bash
# Test basic connectivity
curl http://localhost:47334/api/status

# Should return something like:
# {"status": "ok", "version": "23.x.x"}
```

### 2. Test Authentication
```bash
# Test login (if authentication is enabled)
curl -X POST http://localhost:47334/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"mindsdb","password":"your_password"}'
```

### 3. Run Integration Test
```bash
# Build and test the integration
npm run build
npm run mindsdb:test
```

## 🔧 MindsDB Configuration File

Create a `mindsdb_config.json` for advanced configuration:
```json
{
  "api": {
    "http": {
      "host": "0.0.0.0",
      "port": 47334
    }
  },
  "storage": {
    "db": {
      "type": "sqlite",
      "path": "mindsdb.sqlite3"
    }
  },
  "auth": {
    "username": "mindsdb",
    "password": "your_secure_password"
  },
  "integrations": {
    "default_postgres": {
      "enabled": true
    }
  }
}
```

Start with config:
```bash
python -m mindsdb --config mindsdb_config.json
```

## 🐳 Docker Compose Integration

Add MindsDB to your existing stack:
```yaml
# Add to your docker-compose.yml
version: '3.8'
services:
  # Your existing services...
  
  mindsdb:
    image: mindsdb/mindsdb:latest
    container_name: mindsdb-rag
    ports:
      - "47334:47334"
    volumes:
      - mindsdb_data:/root/mindsdb_storage
      - ./mindsdb_config.json:/root/mindsdb_config.json
    environment:
      - MINDSDB_STORAGE_PATH=/root/mindsdb_storage
    networks:
      - mindsdb-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:47334/api/status"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  mindsdb_data:

networks:
  mindsdb-network:
    driver: bridge
```

## 🚀 Quick Start Commands

```bash
# 1. Start MindsDB (choose one method above)
docker run -p 47334:47334 mindsdb/mindsdb

# 2. Update your .env file with local endpoint
cp .env.example .env
# Edit MINDSDB_ENDPOINT=http://localhost:47334

# 3. Test the integration
npm run build
npm run mindsdb:test

# 4. Set up sample data
npm run mindsdb:setup

# 5. Start your application
npm run dev
```

## 🔍 Troubleshooting Self-Hosted MindsDB

### Common Issues:

1. **Connection Refused**
   ```bash
   # Check if MindsDB is running
   docker ps | grep mindsdb
   # or
   ps aux | grep mindsdb
   
   # Check port availability
   netstat -tlnp | grep 47334
   ```

2. **Authentication Issues**
   ```bash
   # Try without authentication first
   MINDSDB_USERNAME=
   MINDSDB_PASSWORD=
   
   # Test direct API access
   curl http://localhost:47334/api/sql/query \
     -H "Content-Type: application/json" \
     -d '{"query":"SELECT 1"}'
   ```

3. **Performance Issues**
   ```bash
   # Increase Docker memory limit
   docker run -p 47334:47334 -m 4g mindsdb/mindsdb
   
   # Check MindsDB logs
   docker logs mindsdb-container-name
   ```

## 📚 Self-Hosted Features

Your self-hosted MindsDB supports:
- ✅ **Full SQL Interface** - All SQL operations
- ✅ **Custom Models** - Train your own ML models
- ✅ **Data Integrations** - Connect to your databases
- ✅ **Knowledge Bases** - Vector storage and search
- ✅ **No Rate Limits** - Full control over usage
- ✅ **Data Privacy** - All data stays on your infrastructure

The MindsDBService automatically detects self-hosted instances and adjusts authentication accordingly!