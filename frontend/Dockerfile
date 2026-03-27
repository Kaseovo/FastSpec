FROM node:18-alpine

WORKDIR /app

# Copy package files from frontend folder
COPY frontend/package.json ./
COPY frontend/package-lock.json* ./
RUN npm install

# Copy the rest of frontend code
COPY frontend/. ./

RUN npm run build