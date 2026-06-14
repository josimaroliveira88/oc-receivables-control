FROM node:18-alpine

WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

COPY . .

RUN npx prisma generate

RUN chmod +x /app/entrypoint.sh

EXPOSE 4000

ENTRYPOINT ["/bin/sh", "/app/entrypoint.sh"]
