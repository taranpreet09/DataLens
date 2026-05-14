FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Build with the API URL pointing to the backend service
ARG VITE_API_URL=http://localhost:5000
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build

# ─── Production stage: serve built assets with Vite preview ───────────────────
FROM node:22-alpine

WORKDIR /app

# Install only what's needed to run `vite preview`
COPY package*.json ./
RUN npm ci

COPY --from=build /app/dist ./dist
COPY vite.config.js ./

EXPOSE 4173

CMD ["npx", "vite", "preview", "--host", "0.0.0.0", "--port", "4173"]
