import { Queue, Worker } from 'bullmq';
import { spawn } from 'child_process';
import path from 'path';
import cron from 'node-cron';
import { pool } from '../lib/db.js';

// Connection to Redis (Default locally, should be via ENV in prod)
const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10)
};

// Create the Queue
export const recommendationQueue = new Queue('recommendations', { connection });

// Process the Queue
const recommendationWorker = new Worker('recommendations', async job => {
  const { company_id } = job.data;
  console.log(`[BullMQ] Starting recommendation job for company_id: ${company_id}`);
  
  const scriptPath = path.join(process.cwd(), '../scraper/workers/recommendation_worker.py');
  
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn('python', [scriptPath, '--company_id', company_id.toString()]);
    
    pythonProcess.stdout.on('data', (data) => {
      console.log(`[Python: RecWorker ${company_id}] ${data.toString().trim()}`);
    });
    
    pythonProcess.stderr.on('data', (data) => {
      console.error(`[Python: RecWorker ${company_id} ERR] ${data.toString().trim()}`);
    });
    
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`[BullMQ] Completed recommendation job for company_id: ${company_id}`);
        resolve({ success: true });
      } else {
        reject(new Error(`Python worker exited with code ${code}`));
      }
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
        // Fetch all active company profiles
        const result = await client.query('SELECT id FROM company_profiles WHERE is_active = true');
        const companies = result.rows;
        
        console.log(`[BullMQ Cron] Enqueuing ${companies.length} company recommendation jobs...`);
        
        for (const company of companies) {
          await recommendationQueue.add('calculate_recommendations', { company_id: company.id }, {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 5000
            }
          });
        }
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('[BullMQ Cron] Error enqueuing jobs:', err);
    }
  });
}
