import { triggerDailyNotifications } from './workers/notification_worker.js';

async function runTest() {
  console.log('[TestRunner] Initiating manual trigger for Daily Notification Engine...');
  // Force MOCK_NOTIFICATIONS to true to run mock/degraded pipelines without Redis/Postgres
  process.env.MOCK_NOTIFICATIONS = 'true';
  process.env.NODE_ENV = 'test';
  
  await triggerDailyNotifications();
  console.log('[TestRunner] Finished triggering. Exiting test script.');
  process.exit(0);
}

runTest().catch(err => {
  console.error('[TestRunner ERROR]', err);
  process.exit(1);
});
