# Containerize the CLI frontend as a Bun-based microservice
FROM bun:1.3-alpine
WORKDIR /app
COPY package.json bun.lock ./
COPY src/ ./src
RUN bun install --production
EXPOSE 4001
CMD ["bun", "run", "src/index.ts"]
