# syntax=docker/dockerfile:1

# Debian tabanli imaj bilerek secildi: Prisma'nin sorgu motoru Alpine'da
# ek binaryTargets ayari istiyor, burada kutudan cikar gibi calisiyor.
FROM node:20-bookworm-slim AS base
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---------- bagimliliklar ----------
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# ---------- derleme ----------
FROM base AS builder
# NEXT_PUBLIC_* degiskenleri tarayici paketine DERLEME aninda gomulur.
# Calisma aninda verilirse etkisi olmaz — bu yuzden build arg olarak aliyoruz.
ARG NEXT_PUBLIC_APP_TIMEZONE="Europe/Istanbul"
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY=""
ENV NEXT_PUBLIC_APP_TIMEZONE=$NEXT_PUBLIC_APP_TIMEZONE
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY
# prisma generate bir DATABASE_URL gormek ister; derlemede gercek veritabani gerekmez
ENV DATABASE_URL="postgresql://derleme:derleme@127.0.0.1:5432/derleme"
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---------- calisma ----------
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Migration'lari konteyner icinde calistirabilmek icin Prisma CLI + motor + sema
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh && chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
