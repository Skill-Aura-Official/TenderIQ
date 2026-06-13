import { describe, it, expect } from 'vitest';
import { calculateScore } from './services/matchEngine.js';

describe('Match Engine Scorer', () => {
  it('should score 100 for a perfect match', () => {
    const profile = {
      incorporationYear: 2010,
      services: JSON.stringify(['road construction', 'highway repair']),
      certifications: JSON.stringify(['ISO_9001', 'MSME']),
      operatingStates: JSON.stringify(['MH', 'DL'])
    };

    const tender = {
      title: 'Major Road Construction Project in Mumbai',
      categoryCodes: JSON.stringify(['civil', 'road construction']),
      stateCodes: JSON.stringify(['MH']),
      eligibilityCriteria: JSON.stringify([
        { criterion: 'certification', value: 'ISO_9001' },
        { criterion: 'certification', value: 'MSME' },
        { criterion: 'incorporation_years', value: '10' }
      ])
    };

    const result = calculateScore(profile, tender);
    expect(result.score).toBe(100);
    expect(result.missingCriteria.length).toBe(0);
  });

  it('should score 0 for a complete mismatch', () => {
    const profile = {
      incorporationYear: 2023, // 1 year old (if year is 2024), or wait, test runs in 2026 so 3 years old
      services: JSON.stringify(['catering', 'food supply']),
      certifications: JSON.stringify([]),
      operatingStates: JSON.stringify(['TN'])
    };

    const tender = {
      title: 'Major Road Construction Project in Mumbai',
      categoryCodes: JSON.stringify(['civil', 'road construction']),
      stateCodes: JSON.stringify(['MH']),
      eligibilityCriteria: JSON.stringify([
        { criterion: 'certification', value: 'ISO_9001' },
        { criterion: 'incorporation_years', value: '10' }
      ])
    };

    const result = calculateScore(profile, tender);
    // Services (40 pts) -> 0
    // Certs (30 pts) -> 0
    // Experience (20 pts) -> 0 (3 < 10)
    // Location (10 pts) -> 0 (TN != MH)
    expect(result.score).toBe(0);
    expect(result.missingCriteria.length).toBeGreaterThan(0);
  });

  it('should give partial score for partial certifications', () => {
    const profile = {
      incorporationYear: 2010,
      services: JSON.stringify(['road construction']),
      certifications: JSON.stringify(['MSME']), // Missing ISO_9001
      operatingStates: JSON.stringify(['MH'])
    };

    const tender = {
      title: 'Road Construction',
      categoryCodes: JSON.stringify([]),
      stateCodes: JSON.stringify(['MH']),
      eligibilityCriteria: JSON.stringify([
        { criterion: 'certification', value: 'ISO_9001' },
        { criterion: 'certification', value: 'MSME' }
      ])
    };

    const result = calculateScore(profile, tender);
    // Services: 40
    // Certs: 15 (1 out of 2)
    // Location: 10
    // Exp: 20 (default, none specified)
    expect(result.score).toBe(40 + 15 + 10 + 20); // 85
    expect(result.missingCriteria).toContain('Missing required certification: ISO_9001');
  });
});
