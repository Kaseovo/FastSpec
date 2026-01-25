FROM node:18-alpine

WORKDIR /app

# Copy frontend source from build context
COPY frontend/ ./frontend/

# Install dependencies and build the frontend
RUN cd ./frontend && npm ci && npm run build

EXPOSE 3000

CMD ["sh", "-c", "cd frontend && npm run dev"]
