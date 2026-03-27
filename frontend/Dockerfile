FROM node:18-alpine

WORKDIR /app

# Copy frontend source from build context
COPY . .

RUN npm install && npm run build
EXPOSE 3000

CMD ["sh", "-c", "npm run dev"]
