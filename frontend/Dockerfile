FROM node:18-alpine

WORKDIR /app

# Copy frontend source from build context
COPY . .

# Debug: print Node/npm versions and directory contents before install
RUN node -v && npm -v && ls -l && cat package.json && cat package-lock.json && npm ci && npm run build

EXPOSE 3000

CMD ["sh", "-c", "npm run dev"]
