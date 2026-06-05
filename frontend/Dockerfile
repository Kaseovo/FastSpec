# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

COPY frontend/package.json ./
COPY frontend/package-lock.json* ./
RUN npm install

COPY frontend/. ./
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html/specs

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
