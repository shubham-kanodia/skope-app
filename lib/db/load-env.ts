/**
 * Load .env for standalone scripts (migrate, seed). Next.js loads env files
 * itself for the app runtime, so this is only needed by tsx-run CLI scripts.
 * Imported for its side effect; must run before anything reads process.env.
 */
try {
  process.loadEnvFile(); // Node 20.12+/23, reads .env from cwd
} catch {
  // No .env file (e.g. CI/production where real env vars are injected), fine.
}
