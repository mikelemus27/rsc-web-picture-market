# Stage 1: Install dependencies
FROM oven/bun:1-alpine AS deps

# Crea el grupo y usuario en el stage 'deps'
RUN addgroup -S bunuser && adduser -S -D -H -h /dev/null -s /sbin/nologin -G bunuser bunuser

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Stage 2: Build application
FROM oven/bun:1-alpine AS builder

# Crea el grupo y usuario en el stage 'builder' 
RUN addgroup -S bunuser && adduser -S -D -H -h /dev/null -s /sbin/nologin -G bunuser bunuser

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun build ./src/index.ts --outdir ./dist --target bun

# Stage 3: Production image
FROM oven/bun:1-alpine AS production

# Crea el grupo y usuario en el stage 'production' (¡Falta esta parte!)
RUN addgroup -S bunuser && adduser -S -D -H -h /dev/null -s /sbin/nologin -G bunuser bunuser

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules

# Cambia al usuario 'bunuser' en el stage final
USER bunuser

EXPOSE 3000
CMD ["bun", "run", "./dist/index.js"]   
