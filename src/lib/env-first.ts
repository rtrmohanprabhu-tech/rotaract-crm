/**
 * Side-effect module: loads .env into process.env the moment it is imported.
 *
 * Import this FIRST in any standalone script (seed, smoke test). ES modules are
 * evaluated in import order, so putting it above the imports that reach for
 * DATABASE_URL guarantees the value is there before a database client is built.
 */
import { loadEnv } from './load-env.js';

loadEnv();
