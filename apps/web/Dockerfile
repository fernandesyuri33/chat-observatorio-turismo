FROM node:20-alpine AS build

# Habilita o pnpm via Corepack dentro do container.
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

WORKDIR /app

# Copia manifests primeiro para reaproveitar a layer de dependências quando só o código-fonte mudar.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY libs/contracts/package.json libs/contracts/package.json
COPY libs/domain/package.json libs/domain/package.json

# Instala dependências do workspace usando o lockfile exato.
RUN pnpm install --frozen-lockfile

# Copia os arquivos do projeto depois das dependências para melhorar o cache de build.
COPY . .

# Valores de build expostos para o Vite (`import.meta.env`).
ARG VITE_API_URL=http://localhost:3001
ARG VITE_LOOKER_EMBED_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_LOOKER_EMBED_URL=$VITE_LOOKER_EMBED_URL

# Compila libs compartilhadas para disponibilizar os artefatos usados pelo tsc do web.
RUN pnpm -C libs/domain build && pnpm -C libs/contracts build

# Gera os arquivos estáticos em apps/web/dist.
RUN pnpm -C apps/web build

# Serve o bundle estático com uma imagem mínima de runtime do Nginx.
FROM nginx:1.27-alpine AS runtime

COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80
