import crypto from 'crypto';
import { Queue, Worker } from 'bullmq';

// Redis Connection Configuration (GCP Memorystore or Local)
const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
  maxRetriesPerRequest: process.env.REDIS_HOST ? null : 1,
  enableOfflineQueue: process.env.REDIS_HOST ? true : false,
};

// 1. Direct Webhook Sender
export async function dispatchWebhookDirect(
  url: string,
  secret: string,
  event: string,
  payload: any
): Promise<boolean> {
  const body = JSON.stringify({ event, timestamp: Date.now(), data: payload });
  
  // Compute signature (HMAC-SHA256)
  const signature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5-second timeout limit

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-TenderIQ-Signature': signature,
        'User-Agent': 'TenderIQ-Webhook-Bot/1.0'
      },
      body,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return res.ok;
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.error(`[WebhookDispatcher] Direct dispatch error to ${url}:`, err.message || err);
    return false;
  }
}

// 2. Setup BullMQ Queue for Async processing with exponential backoffs
let webhooksQueue: Queue | null = null;
let webhookWorker: Worker | null = null;

try {
  webhooksQueue = new Queue('webhooks', { connection });
  
  webhookWorker = new Worker('webhooks', async job => {
    const { url, secret, event, payload } = job.data;
    console.log(`[WebhookWorker] Processing job ${job.id} for event ${event}`);
    const success = await dispatchWebhookDirect(url, secret, event, payload);
    if (!success) {
      throw new Error(`Webhook dispatch to ${url} failed`);
    }
    return { success: true };
  }, { 
    connection,
    limiter: {
      max: 5,
      duration: 1000
    }
  });

  webhookWorker.on('failed', (job, err) => {
    console.error(`[WebhookWorker] Job ${job?.id} failed after attempts:`, err.message);
  });

  webhookWorker.on('completed', (job) => {
    console.log(`[WebhookWorker] Job ${job?.id} completed successfully`);
  });
} catch (e: any) {
  console.warn('[WebhookDispatcher] Could not initialize BullMQ webhooks queue, falling back to direct delivery mode:', e.message);
}

// 3. Queue Dispatch Wrapper
export async function queueWebhookDispatch(
  url: string,
  secret: string,
  event: string,
  payload: any
) {
  if (webhooksQueue) {
    try {
      await webhooksQueue.add('dispatch', { url, secret, event, payload }, {
        attempts: 6, // 1 original + 5 retries (1m, 5m, 15m, 1h, 6h)
        backoff: {
          type: 'exponential',
          delay: 60000 // Start with 1 minute delay
        }
      });
      console.log(`[WebhookDispatcher] Enqueued webhook event ${event} to ${url}`);
      return;
    } catch (err: any) {
      console.warn(`[WebhookDispatcher] Redis offline or queue error. Falling back to direct dispatch:`, err.message);
    }
  }

  // Fallback direct execution when Redis is down
  const success = await dispatchWebhookDirect(url, secret, event, payload);
  if (!success) {
    console.warn(`[WebhookDispatcher:Fallback] Direct delivery failed for ${url}. Attempting 1 fallback retry in 60s.`);
    setTimeout(async () => {
      await dispatchWebhookDirect(url, secret, event, payload);
    }, 60000);
  }
}
