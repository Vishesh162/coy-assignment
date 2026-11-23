FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3107
ENV DATA_FILE=/app/data/state.json
COPY package*.json ./
RUN npm ci --omit=dev && mkdir -p /app/data && chown node:node /app/data
COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder /app/public ./public
COPY next.config.mjs ./
COPY scripts/start.mjs ./scripts/start.mjs
USER node
EXPOSE 3107
VOLUME /app/data
CMD ["npm", "start"]
