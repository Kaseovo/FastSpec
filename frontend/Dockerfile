FROM node:18-alpine

WORKDIR /app

# Copy frontend source from build context
COPY frontend/ .

# Install dependencies and build the frontend
RUN npm ci && npm run build

EXPOSE 3000

CMD ["sh", "-c", "npm run dev"]
