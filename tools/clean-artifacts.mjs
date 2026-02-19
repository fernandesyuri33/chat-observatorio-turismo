import { readdirSync, rmSync, statSync, existsSync } from "node:fs";
import { join, extname } from "node:path";

const roots = ["apps", "libs"];
const deletableExtensions = [".js", ".js.map", ".d.ts"];

let deletedCount = 0;

function isInSrcFolder(filePath) {
  return filePath.split(/[\\/]/).includes("src");
}

function hasTsSourceForArtifact(filePath) {
  if (filePath.endsWith(".js")) {
    const base = filePath.slice(0, -3);
    return existsSync(`${base}.ts`) || existsSync(`${base}.tsx`);
  }

  if (filePath.endsWith(".js.map")) {
    const base = filePath.slice(0, -7);
    return existsSync(`${base}.ts`) || existsSync(`${base}.tsx`);
  }

  if (filePath.endsWith(".d.ts")) {
    const base = filePath.slice(0, -5);
    return existsSync(`${base}.ts`) || existsSync(`${base}.tsx`);
  }

  return false;
}

function visit(directory) {
  const entries = readdirSync(directory);

  for (const entry of entries) {
    const fullPath = join(directory, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      visit(fullPath);
      continue;
    }

    const ext = extname(fullPath);
    const isCandidate =
      deletableExtensions.includes(ext) ||
      fullPath.endsWith(".js.map") ||
      fullPath.endsWith(".d.ts");

    if (!isCandidate) {
      continue;
    }

    if (!isInSrcFolder(fullPath)) {
      continue;
    }

    if (!hasTsSourceForArtifact(fullPath)) {
      continue;
    }

    rmSync(fullPath, { force: true });
    deletedCount += 1;
  }
}

for (const root of roots) {
  if (!existsSync(root)) continue;
  visit(root);
}

console.log(`Removed ${deletedCount} generated artifact file(s) from src folders.`);
