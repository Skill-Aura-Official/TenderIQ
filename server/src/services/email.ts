import { Resend } from 'resend';

// Initialize Resend SDK if API key is provided
const apiKey = process.env.RESEND_API_KEY;
const resend = apiKey ? new Resend(apiKey) : null;
const fromEmail = process.env.RESEND_FROM_EMAIL || 'TenderIQ <onboarding@resend.dev>';

interface TenderRecommendation {
  title: string;
  matchScore: number;
  estimatedValue: string | number | null;
  emdAmount: string | number | null;
  submissionDeadline: string | Date;
  aiSummary: string | any;
  portalSlug: string;
  sourceUrl: string;
  stateCodes: string | string[];
  issuingAuthority: string;
}

interface UserProfile {
  email: string;
  companyName: string;
  subscriptionTier: string;
  isVerified: boolean;
}

/**
 * Format currency to Indian Rupees (INR)
 */
function formatCurrency(value: string | number | null): string {
  if (value === null || value === undefined || value === '') return 'Not specified';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return 'Not specified';
  
  // Format to lakhs or crores for better readability
  if (num >= 10000000) {
    return `₹${(num / 10000000).toFixed(2)} Cr`;
  } else if (num >= 100000) {
    return `₹${(num / 100000).toFixed(2)} Lakhs`;
  }
  
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(num);
}

/**
 * Format deadline date
 */
function formatDate(date: string | Date): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'N/A';
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

/**
 * Parses and formats the AI Summary JSON/text
 */
function formatAiSummary(aiSummary: any): string {
  if (!aiSummary) return '';
  
  let summaryObj: any = null;
  if (typeof aiSummary === 'string') {
    try {
      summaryObj = JSON.parse(aiSummary);
    } catch {
      // If it's a plain string, check if it's formatted as bullet points
      return `<p style="margin: 0; color: #cbd5e1; font-size: 14px; line-height: 1.5;">${aiSummary}</p>`;
    }
  } else {
    summaryObj = aiSummary;
  }

  if (summaryObj) {
    // If it's an array of strings
    if (Array.isArray(summaryObj)) {
      return `<ul style="margin: 0; padding-left: 20px; color: #cbd5e1; font-size: 14px; line-height: 1.5;">
        ${summaryObj.map(point => `<li style="margin-bottom: 4px;">${point}</li>`).join('')}
      </ul>`;
    }
    
    // If it's an object with keys (e.g. keyPoints, workSummary, pqRequirements)
    if (typeof summaryObj === 'object') {
      const keys = Object.keys(summaryObj);
      if (keys.length > 0) {
        let html = '<ul style="margin: 0; padding-left: 20px; color: #cbd5e1; font-size: 14px; line-height: 1.5;">';
        for (const [key, value] of Object.entries(summaryObj)) {
          const formattedKey = key
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase());
          
          if (Array.isArray(value)) {
            html += `<li style="margin-bottom: 6px;"><strong>${formattedKey}:</strong>
              <ul style="margin: 4px 0 0 16px; padding-left: 0; list-style-type: circle;">
                ${value.map(val => `<li>${val}</li>`).join('')}
              </ul>
            </li>`;
          } else {
            html += `<li style="margin-bottom: 4px;"><strong>${formattedKey}:</strong> ${value}</li>`;
          }
        }
        html += '</ul>';
        return html;
      }
    }
  }
  
  return `<p style="margin: 0; color: #cbd5e1; font-size: 14px; line-height: 1.5;">${JSON.stringify(aiSummary)}</p>`;
}

/**
 * Builds the HTML content for the Daily Digest Email
 */
export function buildDailyDigestHtml(user: UserProfile, recommendations: TenderRecommendation[]): string {
  const isPro = user.subscriptionTier === 'pro';
  const isVerified = user.isVerified;

  const tendersHtml = recommendations.map((rec, index) => {
    // Format score badge color
    let scoreColor = '#10b981'; // Green
    if (rec.matchScore < 85) scoreColor = '#eab308'; // Yellow
    if (rec.matchScore < 70) scoreColor = '#f97316'; // Orange

    const state = Array.isArray(rec.stateCodes) 
      ? rec.stateCodes.join(', ') 
      : (typeof rec.stateCodes === 'string' ? JSON.parse(rec.stateCodes || '[]').join(', ') : 'N/A');

    const formattedValue = formatCurrency(rec.estimatedValue);
    const formattedEmd = formatCurrency(rec.emdAmount);
    
    return `
      <!-- Tender Card -->
      <div style="background-color: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 20px; margin-bottom: 20px; font-family: 'Inter', system-ui, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td valign="top">
              <span style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; background-color: #0f172a; padding: 4px 8px; border-radius: 4px; display: inline-block; margin-bottom: 12px;">
                ${rec.portalSlug.toUpperCase()} • ${state}
              </span>
            </td>
            <td valign="top" align="right">
              <span style="font-size: 14px; font-weight: 700; color: ${scoreColor}; background-color: ${scoreColor}1A; border: 1px solid ${scoreColor}40; padding: 4px 10px; border-radius: 20px; display: inline-block;">
                ${rec.matchScore}% Match
              </span>
            </td>
          </tr>
        </table>
        
        <h3 style="margin: 0 0 10px 0; color: #ffffff; font-size: 18px; font-weight: 600; line-height: 1.4;">
          ${rec.title}
        </h3>
        
        <p style="margin: 0 0 16px 0; color: #94a3b8; font-size: 14px; line-height: 1.4;">
          <strong>Authority:</strong> ${rec.issuingAuthority}
        </p>

        <!-- Technical Metadata Details Grid -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 16px; border-top: 1px solid #334155; border-bottom: 1px solid #334155; padding: 12px 0;">
          <tr>
            <td width="33%" valign="top">
              <span style="font-size: 11px; text-transform: uppercase; color: #64748b; display: block; margin-bottom: 4px;">Est. Value</span>
              <strong style="font-size: 14px; color: #f8fafc;">${formattedValue}</strong>
            </td>
            <td width="33%" valign="top">
              <span style="font-size: 11px; text-transform: uppercase; color: #64748b; display: block; margin-bottom: 4px;">EMD Amount</span>
              <strong style="font-size: 14px; color: #f8fafc;">${formattedEmd}</strong>
            </td>
            <td width="33%" valign="top">
              <span style="font-size: 11px; text-transform: uppercase; color: #64748b; display: block; margin-bottom: 4px;">Deadline</span>
              <strong style="font-size: 14px; color: #f43f5e;">${formatDate(rec.submissionDeadline)}</strong>
            </td>
          </tr>
        </table>

        <!-- AI Summary Segment -->
        ${rec.aiSummary ? `
          <div style="background-color: #0f172a; border-left: 4px solid #3b82f6; border-radius: 0 8px 8px 0; padding: 12px 16px; margin-bottom: 16px;">
            <h4 style="margin: 0 0 6px 0; color: #3b82f6; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">AI Match Analysis</h4>
            ${formatAiSummary(rec.aiSummary)}
          </div>
        ` : ''}

        <!-- Action Button -->
        <div style="text-align: right;">
          <a href="${rec.sourceUrl || '#'}" target="_blank" style="background-color: #2563eb; color: #ffffff; padding: 10px 18px; border-radius: 6px; font-size: 14px; font-weight: 600; text-decoration: none; display: inline-block;">
            View Full Tender Documents
          </a>
        </div>
      </div>
    `;
  }).join('');

  // Premium Email Layout Wrapper
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your Daily TenderIQ Digest</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    </head>
    <body style="background-color: #0f172a; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #0f172a; padding: 20px 0;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 600px; background-color: #0b0f19; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);">
              
              <!-- Premium Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #2563eb 100%); padding: 32px 24px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.025em; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">TenderIQ</h1>
                  <p style="margin: 6px 0 0 0; color: #bfdbfe; font-size: 14px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.1em;">Daily Recommendation Digest</p>
                </td>
              </tr>
              
              <!-- Welcome Content -->
              <tr>
                <td style="padding: 24px 24px 12px 24px;">
                  <h2 style="margin: 0 0 8px 0; color: #ffffff; font-size: 20px; font-weight: 600;">Hi ${user.companyName},</h2>
                  <p style="margin: 0; color: #94a3b8; font-size: 15px; line-height: 1.6;">
                    Here are your curated tender opportunities for today. We scanned active portals to match your financial capacity and technical keywords.
                  </p>
                  
                  <!-- Account Badge status info -->
                  <div style="background-color: #1e293b; border-radius: 8px; padding: 12px; margin-top: 16px; margin-bottom: 24px; font-size: 13px; color: #cbd5e1;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td>
                          Tier: <strong style="text-transform: capitalize; color: ${isPro ? '#a855f7' : '#94a3b8'};">${user.subscriptionTier}</strong>
                          ${isVerified ? ' | <strong style="color: #10b981;">✓ Verified Company</strong>' : ' | <strong style="color: #f59e0b;">⚠ Unverified Profile</strong>'}
                        </td>
                        <td align="right">
                          <a href="${process.env.CLIENT_ORIGIN || 'http://localhost:3000'}/dashboard" style="color: #3b82f6; text-decoration: none; font-weight: 600;">Go to Dashboard →</a>
                        </td>
                      </tr>
                    </table>
                  </div>
                </td>
              </tr>
              
              <!-- Tenders List -->
              <tr>
                <td style="padding: 0 24px;">
                  ${tendersHtml}
                </td>
              </tr>
              
              <!-- Empty State in case of 0 recommendations -->
              ${recommendations.length === 0 ? `
                <tr>
                  <td style="padding: 40px 24px; text-align: center; color: #94a3b8;">
                    <p style="font-size: 16px; margin-bottom: 8px;">No new highly-matching tenders found today.</p>
                    <p style="font-size: 14px; margin-top: 0;">Try updating your keywords or increasing your financial bidding capacity on the portal.</p>
                    <a href="${process.env.CLIENT_ORIGIN || 'http://localhost:3000'}/onboarding" style="background-color: #334155; color: #ffffff; padding: 8px 16px; border-radius: 6px; font-size: 14px; text-decoration: none; font-weight: 600; display: inline-block; margin-top: 12px;">
                      Update Bidding Profile
                    </a>
                  </td>
                </tr>
              ` : ''}

              <!-- Premium Footer -->
              <tr>
                <td style="background-color: #090d16; padding: 24px; text-align: center; border-top: 1px solid #1e293b; font-size: 12px; color: #64748b; line-height: 1.5;">
                  <p style="margin: 0 0 8px 0;">
                    You are receiving this daily digest because you matches are active on TenderIQ.
                  </p>
                  <p style="margin: 0;">
                    To modify your notification channels (Email/WhatsApp) or opt out, please edit your 
                    <a href="${process.env.CLIENT_ORIGIN || 'http://localhost:3000'}/settings" style="color: #3b82f6; text-decoration: none;">Notification Preferences</a> on TenderIQ.
                  </p>
                  <p style="margin: 16px 0 0 0; font-size: 11px; color: #475569;">
                    © ${new Date().getFullYear()} TenderIQ. All rights reserved.
                  </p>
                </td>
              </tr>
              
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

/**
 * Main Email Service Trigger
 */
export async function sendDailyDigestEmail(user: UserProfile, recommendations: TenderRecommendation[]): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const isEnabled = !apiKey;
  const count = recommendations.length;
  
  console.log(`[EmailService] Preparing email digest for ${user.email} with ${count} recommendations...`);

  const html = buildDailyDigestHtml(user, recommendations);

  if (!resend) {
    console.log('------------------ [MOCK EMAIL LOG START] ------------------');
    console.log(`To: ${user.email}`);
    console.log(`From: ${fromEmail}`);
    console.log(`Subject: Daily TenderIQ Digest - ${count} Curated Matches Found`);
    console.log(`Body Details: Company '${user.companyName}' (${user.subscriptionTier.toUpperCase()}, ${user.isVerified ? 'Verified' : 'Unverified'})`);
    console.log(`Matches included: ${recommendations.map(r => `${r.title} (${r.matchScore}% Match)`).join(', ')}`);
    console.log('------------------- [MOCK EMAIL LOG END] -------------------');
    
    return { success: true, messageId: `mock-email-id-${Date.now()}` };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [user.email],
      subject: `Daily TenderIQ Digest - ${count} Curated Matches Found`,
      html: html,
    });

    if (error) {
      console.error(`[EmailService] Resend SDK returned error:`, error);
      return { success: false, error: error.message };
    }

    console.log(`[EmailService] Email successfully sent. Message ID: ${data?.id}`);
    return { success: true, messageId: data?.id };
  } catch (err: any) {
    console.error(`[EmailService] Failed to send email via Resend SDK:`, err);
    return { success: false, error: err.message };
  }
}
