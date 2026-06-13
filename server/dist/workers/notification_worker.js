import { Queue, Worker } from 'bullmq';
import cron from 'node-cron';
import { db } from '../lib/db.js';
import { recommendationBatches, companyProfiles, users, recommendations, tenders } from '../db/schema.js';
import { eq, and, isNull } from 'drizzle-orm';
import { sendDailyDigestEmail } from '../services/email.js';
import { sendWhatsAppAlert } from '../services/whatsapp.js';
// Redis Connection Configuration (GCP Memorystore or Local)
const connection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
    // Fail fast locally if Redis is down, allowing graceful dry-runs/mocks
    maxRetriesPerRequest: process.env.REDIS_HOST ? null : 1,
    enableOfflineQueue: process.env.REDIS_HOST ? true : false,
};
// Create the Notification BullMQ Queue
export const notificationQueue = new Queue('notifications', { connection });
// Process the Notification Queue
const notificationWorker = new Worker('notifications', async (job) => {
    const { type, data } = job.data;
    console.log(`[NotificationWorker] Processing job ID: ${job.id}, Type: ${type}`);
    if (type === 'send_email') {
        const { user, recs } = data;
        const result = await sendDailyDigestEmail(user, recs);
        if (!result.success) {
            throw new Error(`Email sending failed: ${result.error}`);
        }
        return result;
    }
    if (type === 'send_whatsapp') {
        const { payload } = data;
        const result = await sendWhatsAppAlert(payload);
        if (!result.success) {
            throw new Error(`WhatsApp sending failed: ${result.error}`);
        }
        return result;
    }
    throw new Error(`Unknown job type: ${type}`);
}, {
    connection,
    limiter: {
        max: 10, // Max 10 messages per second to respect external rate limits
        duration: 1000
    }
});
notificationWorker.on('failed', (job, err) => {
    console.error(`[NotificationWorker] Job ${job?.id} failed: ${err.message}`);
});
notificationWorker.on('completed', (job, result) => {
    console.log(`[NotificationWorker] Job ${job?.id} completed successfully! Result:`, result);
});
/**
 * Main Orchestrator: Finds ready batches and enqueues individual send jobs
 */
export async function triggerDailyNotifications() {
    console.log('[NotificationCron] Starting daily notification dispatch cycle...');
    try {
        // 1. Query recommendation batches that are ready but have not been notified
        const readyBatches = await db
            .select({
            batchId: recommendationBatches.id,
            companyId: recommendationBatches.companyId,
            companyName: companyProfiles.companyName,
            userId: companyProfiles.userId,
            clerkId: users.clerkId,
            email: users.email,
            whatsappOptIn: users.whatsappOptIn,
            channelOptOutEmail: users.channelOptOutEmail,
            channelOptOutWhatsapp: users.channelOptOutWhatsapp,
            subscriptionTier: users.subscriptionTier,
            isVerified: companyProfiles.isVerified,
        })
            .from(recommendationBatches)
            .innerJoin(companyProfiles, eq(recommendationBatches.companyId, companyProfiles.id))
            .innerJoin(users, eq(companyProfiles.userId, users.id))
            .where(and(eq(recommendationBatches.status, 'ready'), isNull(recommendationBatches.notifiedAt)));
        console.log(`[NotificationCron] Found ${readyBatches.length} ready batches to notify.`);
        for (const batch of readyBatches) {
            try {
                // 2. Fetch recommended tenders for this company profile
                const recs = await db
                    .select({
                    title: tenders.title,
                    matchScore: recommendations.score,
                    estimatedValue: tenders.estimatedValue,
                    emdAmount: tenders.emdAmount,
                    submissionDeadline: tenders.submissionDeadline,
                    aiSummary: tenders.aiSummary,
                    portalSlug: tenders.portalSlug,
                    sourceUrl: tenders.sourceUrl,
                    stateCodes: tenders.stateCodes,
                    issuingAuthority: tenders.issuingAuthority,
                })
                    .from(recommendations)
                    .innerJoin(tenders, eq(recommendations.tenderId, tenders.id))
                    .where(eq(recommendations.companyId, batch.companyId))
                    .orderBy(recommendations.score); // order by score DESC (or ASC for standard order, usually sorted DESC in worker)
                console.log(`[NotificationCron] Batch ${batch.batchId}: fetched ${recs.length} recommendations for ${batch.companyName}.`);
                // 3. Enqueue Email Digest job if not opted out
                if (!batch.channelOptOutEmail) {
                    console.log(`[NotificationCron] Enqueuing send_email for ${batch.email}`);
                    const emailJobData = {
                        type: 'send_email',
                        data: {
                            user: {
                                email: batch.email,
                                companyName: batch.companyName,
                                subscriptionTier: batch.subscriptionTier,
                                isVerified: batch.isVerified,
                            },
                            recs: recs,
                        }
                    };
                    if (process.env.MOCK_NOTIFICATIONS === 'true') {
                        console.log(`[NotificationCron] Mock mode active. Direct email trigger...`);
                        await sendDailyDigestEmail(emailJobData.data.user, emailJobData.data.recs);
                    }
                    else {
                        try {
                            await notificationQueue.add('send_email', emailJobData, {
                                attempts: 3,
                                backoff: { type: 'exponential', delay: 5000 }
                            });
                        }
                        catch (redisErr) {
                            console.warn(`[NotificationCron] Redis is offline. Executing email dispatch directly:`, redisErr.message);
                            await sendDailyDigestEmail(emailJobData.data.user, emailJobData.data.recs);
                        }
                    }
                }
                else {
                    console.log(`[NotificationCron] Email is opted out for company: ${batch.companyName}`);
                }
                // 4. Enqueue WhatsApp job if opted in and not opted out
                if (batch.whatsappOptIn && !batch.channelOptOutWhatsapp) {
                    const topMatch = recs[0] || null;
                    if (topMatch) {
                        console.log(`[NotificationCron] Enqueuing send_whatsapp for ${batch.companyName}`);
                        const whatsappJobData = {
                            type: 'send_whatsapp',
                            data: {
                                payload: {
                                    clerkId: batch.clerkId,
                                    companyName: batch.companyName,
                                    count: recs.length,
                                    topTitle: topMatch.title,
                                    topState: Array.isArray(topMatch.stateCodes)
                                        ? topMatch.stateCodes.join(', ')
                                        : (typeof topMatch.stateCodes === 'string' ? JSON.parse(topMatch.stateCodes || '[]').join(', ') : 'N/A'),
                                    topValue: topMatch.estimatedValue,
                                }
                            }
                        };
                        if (process.env.MOCK_NOTIFICATIONS === 'true') {
                            console.log(`[NotificationCron] Mock mode active. Direct WhatsApp trigger...`);
                            await sendWhatsAppAlert(whatsappJobData.data.payload);
                        }
                        else {
                            try {
                                await notificationQueue.add('send_whatsapp', whatsappJobData, {
                                    attempts: 3,
                                    backoff: { type: 'exponential', delay: 5000 }
                                });
                            }
                            catch (redisErr) {
                                console.warn(`[NotificationCron] Redis is offline. Executing WhatsApp dispatch directly:`, redisErr.message);
                                await sendWhatsAppAlert(whatsappJobData.data.payload);
                            }
                        }
                    }
                }
                else {
                    console.log(`[NotificationCron] WhatsApp is not enabled (OptIn: ${batch.whatsappOptIn}, OptOut: ${batch.channelOptOutWhatsapp}) for company: ${batch.companyName}`);
                }
                // 5. Update notified_at for the batch
                await db
                    .update(recommendationBatches)
                    .set({ notifiedAt: new Date() })
                    .where(eq(recommendationBatches.id, batch.batchId));
                console.log(`[NotificationCron] Batch ${batch.batchId} marked as notified.`);
            }
            catch (err) {
                console.error(`[NotificationCron] Error processing batch ${batch.batchId}:`, err);
            }
        }
    }
    catch (err) {
        console.error(`[NotificationCron] Failed to run database queries for notifications:`, err.message);
        // Graceful degraded mode fallback for testing (only in dev/test/mock environments)
        const isDev = process.env.NODE_ENV !== 'production' && (process.env.NODE_ENV === 'test' || process.env.MOCK_NOTIFICATIONS === 'true' || err.message.includes('connect'));
        if (isDev) {
            console.log('[NotificationCron:DEGRADED] Running in mock/degraded mode. Simulating a ready batch trigger...');
            const mockUser = {
                email: 'developer@example.com',
                companyName: 'Mock Developer MSME',
                subscriptionTier: 'pro',
                isVerified: true,
            };
            const mockRecs = [
                {
                    title: 'Construction of Smart Road and Drainage System at Sector 15',
                    matchScore: 92,
                    estimatedValue: 12000000, // 1.2 Crore
                    emdAmount: 240000,
                    submissionDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
                    aiSummary: JSON.stringify([
                        'Execute 4.5km road widening with high-density asphalt overlay.',
                        'Requires bid capacity of at least 1.5x estimated value and ISO-9001 certification.'
                    ]),
                    portalSlug: 'mahatenders',
                    sourceUrl: 'https://mahatenders.gov.in/tender/12345',
                    stateCodes: ['MH'],
                    issuingAuthority: 'Maharashtra Public Works Department (PWD)',
                },
                {
                    title: 'Supply, Installation & Commissioning of 100KW Roof-top Solar PV System',
                    matchScore: 79,
                    estimatedValue: 4500000, // 45 Lakhs
                    emdAmount: 90000,
                    submissionDeadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
                    aiSummary: JSON.stringify({
                        workDetails: 'Procure and mount solar grids on municipal administrative offices.',
                        strictPrequalification: 'Must have successfully completed 3 similar solar projects in the last 3 years.'
                    }),
                    portalSlug: 'etenders_up',
                    sourceUrl: 'https://etender.up.nic.in/tender/54321',
                    stateCodes: ['UP'],
                    issuingAuthority: 'Uttar Pradesh New and Renewable Energy Development Agency',
                }
            ];
            console.log('[NotificationCron:DEGRADED] Executing Mock Email Digest send directly...');
            await sendDailyDigestEmail(mockUser, mockRecs);
            console.log('[NotificationCron:DEGRADED] Executing Mock WhatsApp alert send directly...');
            await sendWhatsAppAlert({
                clerkId: 'user_mock_clerk_id_123',
                companyName: mockUser.companyName,
                count: mockRecs.length,
                topTitle: mockRecs[0].title,
                topState: 'MH',
                topValue: mockRecs[0].estimatedValue,
            });
            console.log('[NotificationCron:DEGRADED] Mock execution complete.');
        }
        else {
            throw err;
        }
    }
}
/**
 * Initializes the daily notification Cron scheduler at 8:00 AM
 */
export function startNotificationCron() {
    console.log('[NotificationCron] Initializing daily 8 AM Notification Cron...');
    // Schedule to run at 8:00 AM every day: '0 8 * * *'
    cron.schedule('0 8 * * *', async () => {
        console.log('[NotificationCron Triggered] Executing morning digest distribution...');
        await triggerDailyNotifications();
    });
}
