FROM node:18-alpine

WORKDIR /app

# Copy package files from frontend folder
COPY package*.json ./
RUN npm install

# Copy the rest of frontend code
COPY . ./

RUN npm run build