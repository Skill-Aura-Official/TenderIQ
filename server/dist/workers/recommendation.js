import { Queue, Worker } from 'bullmq';
import { spawn } from 'child_process';
import path from 'path';
import cron from 'node-cron';
import { pool } from '../lib/db.js';
// Connection to Redis (Production: GCP Memorystore, Development: Local)
const connection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    // For GCP Memorystore, we might need TLS depending on the config
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
    // Fail fast locally if Redis is down, allowing graceful dry-runs/mocks
    maxRetriesPerRequest: process.env.REDIS_HOST ? null : 1,
    enableOfflineQueue: process.env.REDIS_HOST ? true : false,
};
// Create the Queue
export const recommendationQueue = new Queue('recommendations', { connection });
// Process the Queue
const recommendationWorker = new Worker('recommendations', async (job) => {
    const { company_id, limit } = job.data;
    console.log(`[BullMQ] Starting recommendation job for company_id: ${company_id} with limit: ${limit}`);
    const scriptPath = path.join(process.cwd(), '../scraper/workers/recommendation_worker.py');
    return new Promise((resolve, reject) => {
        const pythonProcess = spawn('python', [scriptPath, '--company_id', company_id.toString(), '--limit', limit.toString()]);
        pythonProcess.stdout.on('data', (data) => {
            console.log(`[Python: RecWorker ${company_id}] ${data.toString().trim()}`);
        });
        pythonProcess.stderr.on('data', (data) => {
            console.error(`[Python: RecWorker ${company_id} ERR] ${data.toString().trim()}`);
        });
        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                return reject(new Error(`Python recommendation worker exited with code ${code}`));
            }
            console.log(`[BullMQ] Completed recommendation calculations for company_id: ${company_id}. Spawning summary worker...`);
            const summaryScriptPath = path.join(process.cwd(), '../scraper/workers/summary_worker.py');
            const summaryProcess = spawn('python', [summaryScriptPath, '--company_id', company_id.toString()]);
            summaryProcess.stdout.on('data', (data) => {
                console.log(`[Python: SumWorker ${company_id}] ${data.toString().trim()}`);
            });
            summaryProcess.stderr.on('data', (data) => {
                console.error(`[Python: SumWorker ${company_id} ERR] ${data.toString().trim()}`);
            });
            summaryProcess.on('close', (sumCode) => {
                if (sumCode === 0) {
                    console.log(`[BullMQ] Completed summarization for company_id: ${company_id}`);
                    resolve({ success: true });
                }
                else {
                    reject(new Error(`Python summary worker exited with code ${sumCode}`));
                }
            });
        });
    });
}, { connection });
recommendationWorker.on('failed', (job, err) => {
    console.error(`[BullMQ] Job ${job?.id} failed with error ${err.message}`);
});
// Setup the Node Cron Trigger
export function startRecommendationCron() {
    console.log('[BullMQ] Initializing nightly recommendation Cron job (Runs at 2 AM)');
    cron.schedule('0 2 * * *', async () => {
        console.log('[BullMQ Cron] Triggering nightly recommendation cycle...');
        try {
            const client = await pool.connect();
            try {
                // Fetch all active company profiles with their verification and subscription status
                const result = await client.query(`
          SELECT cp.id, cp.is_verified, u.subscription_tier
          FROM company_profiles cp
          JOIN users u ON cp.user_id = u.id
        `);
                const companies = result.rows;
                console.log(`[BullMQ Cron] Enqueuing ${companies.length} company recommendation jobs...`);
                for (const company of companies) {
                    // Determine volume limit based on verification and subscription tier
                    const limits = {
                        free: company.is_verified ? 5 : 3,
                        starter: 25,
                        pro: 100,
                        enterprise: 200,
                    };
                    let limit = limits[company.subscription_tier] || 3;
                    await recommendationQueue.add('calculate_recommendations', {
                        company_id: company.id,
                        limit: limit
                    }, {
                        attempts: 3,
                        backoff: {
                            type: 'exponential',
                            delay: 5000
                        }
                    });
                }
            }
            finally {
                client.release();
            }
        }
        catch (err) {
            console.error('[BullMQ Cron] Error enqueuing jobs:', err);
        }
    });
}
