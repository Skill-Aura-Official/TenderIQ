import { db } from '../lib/db.js';
import { userTenderScores, tenders, companyProfiles } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
export function calculateScore(profile, tender) {
    const currentYear = new Date().getFullYear();
    const companyAge = profile.incorporationYear ? (currentYear - profile.incorporationYear) : 0;
    // Parse JSON columns
    const profileServices = JSON.parse(profile.services || '[]');
    const profileCerts = JSON.parse(profile.certifications || '[]');
    const profileStates = JSON.parse(profile.operatingStates || '[]');
    const tenderCategories = JSON.parse(tender.categoryCodes || '[]');
    const tenderStates = JSON.parse(tender.stateCodes || '[]');
    let tenderCriteria = [];
    try {
        tenderCriteria = JSON.parse(tender.eligibilityCriteria || '[]');
    }
    catch (e) {
        tenderCriteria = [];
    }
    const breakdown = [];
    const missingCriteria = [];
    // Helper to normalize strings for robust keyword matching (converts underscores to spaces)
    const normalize = (s) => s.toLowerCase().replace(/_/g, ' ').trim();
    // 1. Services Match (40 pts)
    // Check if company services overlap with tender categories or tender title keywords
    const serviceOverlap = profileServices.filter(service => tenderCategories.map(c => normalize(c)).includes(normalize(service)) ||
        normalize(tender.title).includes(normalize(service)));
    const serviceMatched = serviceOverlap.length > 0;
    const servicePoints = serviceMatched ? 40 : 0;
    breakdown.push({
        criterion: 'Services/Category Match',
        matched: serviceMatched,
        points: servicePoints,
        maxPoints: 40,
        details: serviceMatched
            ? `Matched services: ${serviceOverlap.slice(0, 3).join(', ')}`
            : 'No overlapping service tags found matching the tender category or title.'
    });
    if (!serviceMatched) {
        missingCriteria.push('No matching services in your company profile');
    }
    // 2. Certifications Match (30 pts)
    // Check for specific certifications in eligibility criteria (e.g. ISO_9001, MSME)
    const requiredCerts = tenderCriteria
        .filter((c) => c.criterion === 'certification')
        .map((c) => c.value);
    let certPoints = 30;
    let certMatched = true;
    let certDetails = 'No specific certifications required.';
    if (requiredCerts.length > 0) {
        const matchedCerts = requiredCerts.filter((c) => profileCerts.includes(c));
        certMatched = matchedCerts.length === requiredCerts.length;
        certPoints = Math.round((matchedCerts.length / requiredCerts.length) * 30);
        certDetails = `Matched ${matchedCerts.length} of ${requiredCerts.length} required certifications: ${matchedCerts.join(', ')}`;
        requiredCerts.forEach((c) => {
            if (!profileCerts.includes(c)) {
                missingCriteria.push(`Missing required certification: ${c}`);
            }
        });
    }
    breakdown.push({
        criterion: 'Certifications',
        matched: certMatched,
        points: certPoints,
        maxPoints: 30,
        details: certDetails
    });
    // 3. Experience Match (20 pts)
    const expCriterion = tenderCriteria.find((c) => c.criterion === 'incorporation_years');
    let expPoints = 20;
    let expMatched = true;
    let expDetails = 'No experience requirements specified.';
    if (expCriterion) {
        const requiredYears = parseInt(expCriterion.value || '0', 10);
        expMatched = companyAge >= requiredYears;
        expPoints = expMatched ? 20 : 0;
        expDetails = `Company is ${companyAge} years old (Required: ${requiredYears} years).`;
        if (!expMatched) {
            missingCriteria.push(`Tender requires ${requiredYears} years of operational experience (your company is ${companyAge} years old)`);
        }
    }
    breakdown.push({
        criterion: 'Experience Requirements',
        matched: expMatched,
        points: expPoints,
        maxPoints: 20,
        details: expDetails
    });
    // 4. Location Match (10 pts)
    const locationOverlap = profileStates.filter(state => tenderStates.includes(state));
    const locationMatched = locationOverlap.length > 0 || tenderStates.includes('ALL') || tenderStates.length === 0;
    const locationPoints = locationMatched ? 10 : 0;
    breakdown.push({
        criterion: 'Operational State Match',
        matched: locationMatched,
        points: locationPoints,
        maxPoints: 10,
        details: locationMatched
            ? `Operating state is compatible (Matched states: ${locationOverlap.join(', ') || 'ALL'})`
            : `This tender is restricted to: ${tenderStates.join(', ')}.`
    });
    if (!locationMatched) {
        missingCriteria.push(`Tender operates in ${tenderStates.join(', ')}, which is not listed in your operational states`);
    }
    // Calculate final score sum
    const totalScore = breakdown.reduce((sum, item) => sum + item.points, 0);
    return {
        score: totalScore,
        breakdown,
        missingCriteria
    };
}
export async function recalculateUserScores(userId) {
    // Fetch user profile
    const [profile] = await db.select().from(companyProfiles).where(eq(companyProfiles.userId, userId));
    if (!profile)
        return;
    // Fetch all active tenders
    const activeTenders = await db.select().from(tenders).where(eq(tenders.isCancelled, false));
    for (const tender of activeTenders) {
        const { score, breakdown, missingCriteria } = calculateScore(profile, tender);
        // Upsert the score row
        const existingScore = await db
            .select()
            .from(userTenderScores)
            .where(and(eq(userTenderScores.userId, userId), eq(userTenderScores.tenderId, tender.id)));
        if (existingScore.length > 0) {
            await db
                .update(userTenderScores)
                .set({
                score,
                breakdown: JSON.stringify(breakdown),
                missingCriteria: JSON.stringify(missingCriteria),
                scoredAt: new Date(),
                profileVersion: profile.scoringVersion,
            })
                .where(eq(userTenderScores.id, existingScore[0].id));
        }
        else {
            await db.insert(userTenderScores).values({
                userId,
                tenderId: tender.id,
                score,
                breakdown: JSON.stringify(breakdown),
                missingCriteria: JSON.stringify(missingCriteria),
                scoredAt: new Date(),
                profileVersion: profile.scoringVersion,
            });
        }
    }
}
export async function recalculateScoresForNewTender(tenderId, orgId) {
    // Fetch the newly created tender
    const [tender] = await db.select().from(tenders).where(eq(tenders.id, tenderId));
    if (!tender)
        return;
    // Fetch all company profiles in this org
    const profiles = await db.select().from(companyProfiles).where(eq(companyProfiles.orgId, orgId));
    for (const profile of profiles) {
        const { score, breakdown, missingCriteria } = calculateScore(profile, tender);
        // Upsert the score row
        const existingScore = await db
            .select()
            .from(userTenderScores)
            .where(and(eq(userTenderScores.userId, profile.userId), eq(userTenderScores.tenderId, tenderId)));
        if (existingScore.length > 0) {
            await db
                .update(userTenderScores)
                .set({
                score,
                breakdown: JSON.stringify(breakdown),
                missingCriteria: JSON.stringify(missingCriteria),
                scoredAt: new Date(),
                profileVersion: profile.scoringVersion,
            })
                .where(eq(userTenderScores.id, existingScore[0].id));
        }
        else {
            await db.insert(userTenderScores).values({
                userId: profile.userId,
                tenderId,
                score,
                breakdown: JSON.stringify(breakdown),
                missingCriteria: JSON.stringify(missingCriteria),
                scoredAt: new Date(),
                profileVersion: profile.scoringVersion,
            });
        }
    }
}
