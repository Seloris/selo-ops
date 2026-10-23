import { readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

// The `.planning` files of a project's checkout, read on request, never written (`session` BR-01).
export interface PlanningReader {
  // The file's text, or null when it is outside the root or cannot be read.
  read(root: string, path: string): string | null;
}

export function createPlanningReader(): PlanningReader {
  return {
    read: (root, path) => {
      const full = resolve(root, path);
      const rel = relative(resolve(root), full);
      if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) return null;
      try {
        return readFileSync(full, "utf8");
      } catch {
        return null;
      }
    },
  };
}
