import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Raiz do monorepo (apps/web → ../../)
const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export default defineConfig(({ mode }) => {
  // Carrega todas as variáveis do .env da raiz (sem filtro de prefixo)
  const env = loadEnv(mode, rootDir, "");

  return {
    plugins: [react()],
    // Expõe VITE_* do .env da raiz para o bundle do browser
    envDir: rootDir,
    server: {
      port: Number(env["PORT_WEB"]) || 3000,
    },
  };
});
