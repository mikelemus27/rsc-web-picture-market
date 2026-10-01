# This Dockerfile builds the frontend app as a lightweight Bun-based runtime container.
# It keeps the runtime image small and optimized for production use while still having the app code and dependencies available inside /app.
FROM oven/bun:1.3-alpine

# Set the working directory inside the container to /app so all subsequent commands run from the app root.
WORKDIR /app

# Copy dependency manifests first so Docker can cache package installation efficiently.
# This allows rebuilds to reuse the installed dependencies whenever the app source changes but the lockfile does not.
COPY package.json bun.lock ./

# Copy the application source code into the container.
# The frontend logic lives under src/, so it is mounted into the container for runtime execution.
COPY src/ ./src

# Install only production dependencies to minimize image size and keep the container focused on runtime behavior.
RUN bun install --production

# Expose the application port so the container can receive traffic from the host or from other project services.
EXPOSE 4001

# Optional test command kept as a commented example for local validation.
# This can be uncommented when running frontend tests inside the container.
#CMD ["bun", "test", "./tests/usuarios.frontend.api.test.ts"]
CMD ["bun", "test", "./tests/usuarios.frontend.api.test.ts"]
