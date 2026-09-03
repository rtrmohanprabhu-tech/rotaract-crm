import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Minimal .env loader for the standalone scripts (seed, smoke test).
 *
 * Next.js loads .env by itself for `dev`, `build` and `start`; these scripts run
 * outside Next, so they need this. Written by hand rather than depending on a
 * Node version flag or an extra package, so `npm run db:seed` works on any
 * Node 18+.
 *
 * Existing environment variables always win — a value exported in the shell or
 * set by a host like Vercel is never overwritten by the file.
 */
export function loadEnv(file = '.env') {
  const filePath = path.resolve(process.cwd(), file);
  if (!existsSync(filePath)) return;

  for (const rawLine of readFileSync(filePath, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim().replace(/^export\s+/, '');
    if (!key || key in process.env) continue;

    let value = line.slice(eq + 1).trim();
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.endsWith(quote) && value.length > 1) {
      value = value.slice(1, -1);
      if (quote === '"') value = value.replace(/\\n/g, '\n');
    }
    process.env[key] = value;
  }
}
