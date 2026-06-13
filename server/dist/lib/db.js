import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from '../db/schema.js';
import dotenv from 'dotenv';
dotenv.config();
const { Pool } = pg;
// We assume DATABASE_URL is set in the environment or we use a default local connection
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/tenderiq';
export const pool = new Pool({
    connectionString,
});
export const db = drizzle(pool, { schema });
// Auto-migration helper to set up Postgres tables programmatically
export async function initDb() {
    let client;
    try {
        client = await pool.connect();
        // Enable pgvector extension
        await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
        // In a real production app we would use Drizzle migrations
        // For this prototype, we'll sync the schema if needed or rely on manual migration setup.
        console.log('[DB] Connected to PostgreSQL with pgvector.');
    }
    catch (error) {
        console.error('[DB] Failed to initialize PostgreSQL connection (Server will start in degraded mode for testing):', error.message);
    }
    finally {
        if (client)
            client.release();
    }
}
