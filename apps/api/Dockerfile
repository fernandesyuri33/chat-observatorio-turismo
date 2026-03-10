FROM node:20-alpine AS base

# Habilita o pnpm via Corepack dentro do container.
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

WORKDIR /app

# Copia primeiro apenas manifests de dependencias para maximizar cache de layers.
# Se só o código-fonte mudar e os manifests não mudarem, o `pnpm install` é reaproveitado.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json nx.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY libs/domain/package.json libs/domain/package.json
COPY libs/contracts/package.json libs/contracts/package.json
COPY libs/policy/package.json libs/policy/package.json
COPY libs/llm/package.json libs/llm/package.json
COPY libs/providers/package.json libs/providers/package.json
COPY libs/application/package.json libs/application/package.json

# Instala dependências do workspace com base no lockfile.
RUN pnpm install --frozen-lockfile

# Copia o repositório completo apenas depois de instalar dependências.
COPY . .

# Compila a API e todas as bibliotecas internas necessárias em runtime.
RUN pnpm nx run-many -t build -p domain contracts policy llm providers application api

EXPOSE 3001

# Inicia a API compilada em apps/api/dist.
CMD ["pnpm", "-C", "apps/api", "start"]
