FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build 2>&1 || (cat /tmp/build.log 2>/dev/null || true; exit 1)

FROM node:20-alpine AS runtime

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./

RUN apk add --no-cache postgresql-client

EXPOSE 3000

CMD ["node", "dist/main"]
