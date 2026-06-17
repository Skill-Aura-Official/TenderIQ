// @ts-nocheck
import cron from 'node-cron';
import { eq } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { tenders, organizations, users } from '../db/schema.js';
import crypto from 'crypto';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';

const ALLOWED_DOMAINS = [
  'eprocure.gov.in',
  'etenders.gov.in',
  'mahatenders.gov.in',
  'etender.up.nic.in',
  'sppp.rajasthan.gov.in',
  'wbtenders.gov.in',
  'mptenders.gov.in',
  'eproc.karnataka.gov.in',
  'tntenders.gov.in',
  'www.nprocure.com',
  'tender.telangana.gov.in',
  'etenders.hry.nic.in',
  'eproc.punjab.gov.in',
  'etenders.kerala.gov.in',
  'tender.apeprocurement.gov.in'
];

function verifyUrlDomain(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    const hostname = parsed.hostname.toLowerCase();
    return ALLOWED_DOMAINS.some(domain => hostname === domain || hostname.endsWith('.' + domain));
  } catch (e) {
    return false;
  }
}

function sanitizeHtmlForDb(text: string): string {
  if (!text) return '';
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*(['"])(.*?)\1/gi, '')
    .replace(/<(iframe|object|embed|style|link|meta)\b[^<]*(?:(?!<\/\1>)<[^<]*)*<\/\1>/gi, '');
}

// Use a known organization ID or fetch the first one. Since it's multi-tenant, we need a default org.
async function getDefaultOrgId() {
  const orgs = await db.select().from(organizations).limit(1);
  if (orgs.length > 0) return orgs[0].id;
  // If no orgs, create a default one (usually done on onboarding, but just in case)
  const defaultOrgId = crypto.randomUUID();
  await db.insert(organizations).values({
    name: 'System Default Org',
    createdAt: new Date()
  });
  const newOrgs = await db.select().from(organizations).limit(1);
  return newOrgs[0].id;
}

const execPromise = util.promisify(exec);

export async function scrapePublicTenders() {
  console.log('[Scraper] Starting to fetch new public tenders via Python CPPP scraper...');
  
  try {
    const orgId = await getDefaultOrgId();
    
    // Get an admin user ID to assign as createdBy
    const adminUsers = await db.select().from(users).where(eq(users.role, 'admin')).limit(1);
    const createdBy = adminUsers.length > 0 ? adminUsers[0].id : 'system';

    // Execute the Python script
    const scriptPath = path.join(process.cwd(), '../scraper/cppp_scraper.py');
    const { stdout, stderr } = await execPromise(`python "${scriptPath}"`, { maxBuffer: 1024 * 1024 * 50 }); // 50MB buffer for full site scrape
    
    if (stderr && !stderr.includes('Error fetching XML')) {
       console.log('[Scraper] Python stderr:', stderr);
    }
    
    // The Python script prints exactly the JSON array at the end (or as the only stdout)
    // We parse the last valid JSON array from stdout
    const outputLines = stdout.trim().split('\n');
    let parsedData: any[] = [];
    
    for (let i = outputLines.length - 1; i >= 0; i--) {
        try {
            parsedData = JSON.parse(outputLines[i]);
            if (Array.isArray(parsedData)) break;
        } catch (e) {
            continue;
        }
    }
    
    if (!Array.isArray(parsedData) || parsedData.length === 0) {
        throw new Error('Failed to parse tender data from Python output.');
    }
    
    let insertedCount = 0;

    for (const tender of parsedData) {
      if (!tender.dedupeHash || !tender.title) continue;

      const sourceUrl = `https://eprocure.gov.in/eprocure/app?page=FrontEndTendersByOrganisation&service=page`;
      if (!verifyUrlDomain(sourceUrl)) {
        console.warn(`[Scraper Security] URL not in domain whitelist: ${sourceUrl}`);
        continue;
      }

      // Check if exists
      const existing = await db.select().from(tenders).where(eq(tenders.sourceHash, tender.dedupeHash)).limit(1);
      if (existing.length > 0) {
         continue; // Skip existing
      }

      await db.insert(tenders).values({
        orgId: orgId,
        createdBy: createdBy, 
        portalSlug: sanitizeHtmlForDb(tender.portalSlug || 'cppp'),
        portalTenderId: sanitizeHtmlForDb(tender.referenceNumber || 'UNKNOWN'),
        issuingAuthority: 'Central Public Procurement Portal',
        title: sanitizeHtmlForDb(tender.title),
        categoryCodes: tender.categoryCodes || '[]',
        stateCodes: tender.stateCodes || '[]',
        estimatedValue: tender.estimatedValue ? tender.estimatedValue.toString() : '0',
        emdAmount: tender.estimatedValue ? (tender.estimatedValue * 0.02).toString() : '0',
        submissionDeadline: new Date(tender.submissionDeadline),
        documentOpenDate: new Date(tender.documentOpenDate || new Date()),
        summaryStatus: 'pending', // Requires summarization in Week 3/4
        requiredDocuments: '[]',
        sourceUrl: sourceUrl,
        isCancelled: false,
        lastScrapedAt: new Date(),
        sourceHash: tender.dedupeHash,
        rawText: sanitizeHtmlForDb(tender.rawText)
      });
      insertedCount++;
    }
    
    console.log(`[Scraper] Successfully added ${insertedCount} new tenders from CPPP.`);
    return { success: true, count: insertedCount };
  } catch (error) {
    console.error('[Scraper] Error fetching tenders:', error);
    return { success: false, error: String(error) };
  }
}

export function startScraperCron() {
  // Run every 10 minutes
  cron.schedule('*/10 * * * *', () => {
    console.log('[Cron] Triggering scraper job...');
    scrapePublicTenders();
  });
  console.log('[Scraper] Background cron job initialized.');
}
