import { configDefaults, defineConfig } from "vitest/config";

// Agent worktrees live under .claude/ and contain copies of the tests; never collect them.
export default defineConfig({ test: { exclude: [...configDefaults.exclude, ".claude/**"] } });
