FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml turbo.json pnpm-lock.yaml ./
COPY packages ./packages
COPY apps/web/package.json ./apps/web/
RUN pnpm install --ignore-scripts
COPY apps/web ./apps/web
# Compile web so `next start` can serve the built output.
RUN pnpm --filter @ai-padrao/web build
EXPOSE 3000
CMD ["pnpm", "--filter", "@ai-padrao/web", "run", "start"]