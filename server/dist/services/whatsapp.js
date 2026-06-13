import { createClerkClient } from '@clerk/backend';
// Initialize Clerk Client for retrieving user phone number if needed
const clerkSecretKey = process.env.CLERK_SECRET_KEY;
const clerk = clerkSecretKey ? createClerkClient({ secretKey: clerkSecretKey }) : null;
// Wati API configuration
const watiApiUrl = process.env.WATI_API_URL;
const watiApiKey = process.env.WATI_API_KEY;
/**
 * Format currency for WhatsApp message (short format)
 */
function formatWhatsAppCurrency(value) {
    if (value === null || value === undefined || value === '')
        return 'Not specified';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num))
        return 'Not specified';
    if (num >= 10000000) {
        return `₹${(num / 10000000).toFixed(2)} Cr`;
    }
    else if (num >= 100000) {
        return `₹${(num / 100000).toFixed(2)} Lakhs`;
    }
    return `₹${num.toLocaleString('en-IN')}`;
}
/**
 * Fetch phone number from Clerk for a user
 */
export async function getUserPhoneNumberFromClerk(clerkId) {
    if (!clerk) {
        console.log(`[WhatsAppService] Clerk client not initialized (no key), returning mock phone number`);
        return '+919999999999';
    }
    try {
        const user = await clerk.users.getUser(clerkId);
        // Find the primary phone number or the first phone number in the list
        if (user.phoneNumbers && user.phoneNumbers.length > 0) {
            const primaryPhone = user.phoneNumbers.find(p => p.id === user.primaryPhoneNumberId);
            return primaryPhone ? primaryPhone.phoneNumber : user.phoneNumbers[0].phoneNumber;
        }
        return null;
    }
    catch (err) {
        console.error(`[WhatsAppService] Failed to fetch user from Clerk for id ${clerkId}:`, err.message || err);
        if (process.env.MOCK_NOTIFICATIONS === 'true' || process.env.NODE_ENV === 'test') {
            console.log(`[WhatsAppService] Falling back to mock phone number (+919999999999) for testing`);
            return '+919999999999';
        }
        return null;
    }
}
/**
 * Main WhatsApp Service trigger
 */
export async function sendWhatsAppAlert(payload) {
    const { clerkId, companyName, count, topTitle, topState, topValue } = payload;
    console.log(`[WhatsAppService] Preparing WhatsApp alert for Clerk ID: ${clerkId}...`);
    // Get phone number
    const phoneNumber = await getUserPhoneNumberFromClerk(clerkId);
    if (!phoneNumber) {
        console.error(`[WhatsAppService] No phone number found for Clerk User ID: ${clerkId}. Aborting WhatsApp alert.`);
        return { success: false, error: 'PHONE_NUMBER_NOT_FOUND' };
    }
    const formattedValue = formatWhatsAppCurrency(topValue);
    // Pre-approved Template text:
    // "Hi {company_name}, we found {count} tenders matching your profile today. Top match: {title} in {state} (Value: {value}). Reply 'VIEW' to see full details."
    const simulatedMessage = `Hi ${companyName}, we found ${count} tenders matching your profile today. Top match: ${topTitle} in ${topState} (Value: ${formattedValue}). Reply 'VIEW' to see full details.`;
    if (!watiApiUrl || !watiApiKey) {
        console.log('------------------ [MOCK WHATSAPP LOG START] ------------------');
        console.log(`To: ${phoneNumber}`);
        console.log(`Message: ${simulatedMessage}`);
        console.log('------------------- [MOCK WHATSAPP LOG END] -------------------');
        return { success: true, externalId: `mock-wati-id-${Date.now()}` };
    }
    // Real Wati API Template call
    try {
        const url = `${watiApiUrl.replace(/\/$/, '')}/api/v1/sendTemplateMessage?whatsappNumber=${encodeURIComponent(phoneNumber)}`;
        const watiPayload = {
            template_name: 'tender_alert_v1', // Pre-approved template name
            broadcast_name: `TenderIQ Daily Alert - ${new Date().toISOString().slice(0, 10)}`,
            parameters: [
                { name: 'company_name', value: companyName },
                { name: 'count', value: count.toString() },
                { name: 'title', value: topTitle },
                { name: 'state', value: topState },
                { name: 'value', value: formattedValue }
            ]
        };
        console.log(`[WhatsAppService] Sending Wati POST to ${url}...`);
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${watiApiKey}`
            },
            body: JSON.stringify(watiPayload)
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[WhatsAppService] Wati API returned status ${response.status}: ${errorText}`);
            return { success: false, error: `WATI_API_ERROR_${response.status}` };
        }
        const data = await response.json();
        console.log(`[WhatsAppService] WhatsApp message sent via Wati successfully. Wati Result:`, data);
        // Wati usually returns a structure with message ID or result
        return { success: true, externalId: data?.id || data?.result || 'success' };
    }
    catch (err) {
        console.error(`[WhatsAppService] Failed to send WhatsApp via Wati API:`, err);
        return { success: false, error: err.message };
    }
}
