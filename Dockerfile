FROM node:24.19.0-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src
RUN npm run build

FROM node:24.19.0-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=8080 DATABASE_PREPROVISIONED=true
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json server.js database-config.js ./
COPY --chown=node:node src/data ./src/data
USER node
EXPOSE 8080
CMD ["node", "server.js"]
