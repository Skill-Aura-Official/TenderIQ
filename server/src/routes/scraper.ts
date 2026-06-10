import { FastifyInstance } from 'fastify';
import { spawn } from 'child_process';
import path from 'path';

export default async function scraperRoutes(app: FastifyInstance) {
  // Triggered by GCP Cloud Scheduler
  app.get('/trigger', async (request, reply) => {
    const { source } = request.query as { source?: string };
    
    if (!source) {
      return reply.code(400).send({ error: 'Missing source parameter (e.g., ?source=MH)' });
    }

    const validSources = ['MH', 'UP', 'RJ', 'WB', 'MP'];
    if (!validSources.includes(source)) {
      return reply.code(400).send({ error: `Invalid source. Must be one of: ${validSources.join(', ')}` });
    }

    // In a production environment, we should secure this endpoint (e.g. checking a secret token header)
    // to prevent unauthorized triggers.

    const scriptPath = path.join(process.cwd(), '../scraper/gepnic_scraper.py');
    
    // We spawn the process so we don't buffer massive stdout. 
    // The API just waits for the exit code to determine success for the Cloud Scheduler.
    return new Promise((resolve, reject) => {
      console.log(`[Scraper API] Spawning Python scraper for source: ${source}`);
      
      const pythonProcess = spawn('python', [scriptPath, '--source', source]);

      pythonProcess.stdout.on('data', (data) => {
        console.log(`[Scraper: ${source}] ${data.toString().trim()}`);
      });

      pythonProcess.stderr.on('data', (data) => {
        console.error(`[Scraper Error: ${source}] ${data.toString().trim()}`);
      });

      pythonProcess.on('close', (code) => {
        console.log(`[Scraper API] Python process for ${source} exited with code ${code}`);
        if (code === 0) {
          resolve(reply.send({ success: true, message: `Scraper for ${source} completed successfully.` }));
        } else {
          // Cloud scheduler treats non-2xx status as failure and alerts
          resolve(reply.code(500).send({ success: false, error: `Scraper failed with exit code ${code}` }));
        }
      });
    });
  });
}
