FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml turbo.json pnpm-lock.yaml ./
COPY packages ./packages
COPY apps/api/package.json ./apps/api/
RUN pnpm install --ignore-scripts
COPY apps/api ./apps/api
# Build workspace packages so dist/ is available for Node runtime (contracts package is consumed as compiled JS).
RUN pnpm --filter @ai-padrao/contracts build
# Generate Prisma client explicitly because `--ignore-scripts` above suppresses the postinstall hook.
RUN pnpm --filter @ai-padrao/api exec prisma generate
# Compile api to dist/ so start:prod (`node dist/main`) can run the baked output.
RUN pnpm --filter @ai-padrao/api build
EXPOSE 3001
CMD ["pnpm", "--filter", "@ai-padrao/api", "run", "start:prod"]