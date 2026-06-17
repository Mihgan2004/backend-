FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY apps/backend/package*.json ./apps/backend/

RUN npm install

COPY . .

WORKDIR /app/apps/backend
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app

COPY --from=builder /app/apps/backend/.medusa/server ./

ENV NODE_ENV=production
ENV PORT=9000

RUN npm install --omit=dev

EXPOSE 9000

CMD ["npm", "run", "start"]
