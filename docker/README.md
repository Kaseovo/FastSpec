# Docker Configuration

This directory contains Docker configuration files for deploying FastSpec in containerized environments.

## Files

- **docker-compose.yml**: Production Docker Compose configuration
- **docker-compose.dev.yml**: Development Docker Compose configuration with hot-reload
- **backend.Dockerfile**: Backend container configuration
- **frontend.Dockerfile**: Frontend container configuration

## Usage

### Production Deployment

```bash
docker-compose -f docker-compose.yml up --build -d
```

Access the application:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

### Development with Docker

```bash
docker-compose -f docker-compose.dev.yml up --build
```

This configuration includes:
- Volume mounts for hot-reload
- Development dependencies
- Automatic restart on code changes

### Stop Services

```bash
docker-compose -f docker-compose.yml down
# or for dev
docker-compose -f docker-compose.dev.yml down
```

## Note

For local development without Docker, please refer to the main README.md in the project root. Local development is recommended for faster iteration and easier debugging.
