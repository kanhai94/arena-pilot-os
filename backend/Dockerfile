FROM node:20-alpine AS base
WORKDIR /app

COPY package*.json ./

FROM base AS development
RUN npm install
COPY . .
ENV NODE_ENV=development
EXPOSE 4000
CMD ["npm", "run", "dev"]

FROM base AS production-deps
RUN npm ci --omit=dev

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=production-deps /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src

RUN mkdir -p /app/logs && chown -R appuser:appgroup /app
USER appuser

EXPOSE 4000
CMD ["npm", "start"]
