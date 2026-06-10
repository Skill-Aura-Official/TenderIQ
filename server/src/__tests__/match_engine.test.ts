import { describe, it, expect } from 'vitest';
import { calculateScore } from '../services/matchEngine.js';

describe('Match Scoring Engine Tests', () => {
  const mockProfile = {
    companyName: 'Skillaura Tech Solutions',
    gstNumber: '27AADCS1234F1Z5',
    panNumber: 'AADCS1234F',
    msmeRegistered: true,
    incorporationYear: 2021, // 5 years old in 2026
    annualTurnoverBand: '1-10Cr',
    services: JSON.stringify(['software development', 'cloud', 'it services']),
    certifications: JSON.stringify(['ISO_9001']),
    operatingStates: JSON.stringify(['MH', 'KA']),
    minTenderValue: 500000,
    preferredCategories: JSON.stringify(['it_services']),
    scoringVersion: 1
  };

  it('calculates full points for perfect matching profiles', () => {
    const perfectTender = {
      title: 'IT Services Cloud Migration Software Development NHAI',
      categoryCodes: JSON.stringify(['it_services']),
      stateCodes: JSON.stringify(['MH']),
      eligibilityCriteria: JSON.stringify([
        { criterion: 'incorporation_years', value: '4', required: true },
        { criterion: 'certification', value: 'ISO_9001', required: true }
      ])
    };

    const result = calculateScore(mockProfile, perfectTender);
    
    // Services matched: +40 pts
    // Certs matched: +30 pts (ISO_9001)
    // Experience matched: +20 pts (5 years age >= 4 years required)
    // Location matched: +10 pts (MH in operating states)
    // Total = 100
    expect(result.score).toBe(100);
    expect(result.missingCriteria.length).toBe(0);
  });

  it('flags missing certifications and reduces score appropriately', () => {
    const strictCertsTender = {
      title: 'High Security IT Operations',
      categoryCodes: JSON.stringify(['it_services']),
      stateCodes: JSON.stringify(['MH']),
      eligibilityCriteria: JSON.stringify([
        { criterion: 'incorporation_years', value: '3', required: true },
        { criterion: 'certification', value: 'ISO_9001', required: true },
        { criterion: 'certification', value: 'ISO_27001', required: true } // Missing!
      ])
    };

    const result = calculateScore(mockProfile, strictCertsTender);

    // Certs: Matches 1/2 -> 15 pts instead of 30.
    // Services: Matches -> 40 pts.
    // Exp: Matches -> 20 pts.
    // Loc: Matches -> 10 pts.
    // Total = 85
    expect(result.score).toBe(85);
    expect(result.missingCriteria).toContain('Missing required certification: ISO_27001');
  });

  it('handles location mismatch and sets score to 0 on location segment', () => {
    const remoteTender = {
      title: 'Civil Construction Punjab',
      categoryCodes: JSON.stringify(['civil_works']), // Mismatch
      stateCodes: JSON.stringify(['PB']), // Mismatch
      eligibilityCriteria: JSON.stringify([
        { criterion: 'incorporation_years', value: '2', required: true }
      ])
    };

    const result = calculateScore(mockProfile, remoteTender);
    
    // Services mismatch: 0/40
    // Certs: 30/30 (no requirements)
    // Experience: 20/20 (5 >= 2)
    // Location: 0/10 (Punjab is not in MH, KA)
    // Total = 50
    expect(result.score).toBe(50);
    expect(result.missingCriteria).toContain('No matching services in your company profile');
    expect(result.missingCriteria).toContain('Tender operates in PB, which is not listed in your operational states');
  });
});
