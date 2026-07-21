FROM node:20-slim
WORKDIR /app

# only copy package manifests first for caching
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 3000
CMD [ "node", "server/index.mjs" ]
