# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

COPY frontend/package.json ./
COPY frontend/package-lock.json* ./
RUN npm install

COPY frontend/. ./
RUN npm run build

# Stage 2: Serve
FROM node:18-alpine

WORKDIR /app
COPY frontend/. ./
EXPOSE 5173
CMD ["npm", "run", "start", "--", "--host", "0.0.0.0", "--port", "5173"]
