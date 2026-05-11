FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .

RUN mkdir -p storage/uploads storage/parsed storage/cache

EXPOSE 5000

CMD ["node", "server.js"]
