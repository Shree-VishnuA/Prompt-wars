import { describe, it, expect } from 'vitest';
import { formatPaise, getThreatCategoryLabel, THREAT_CATEGORY_LABELS } from '../lib/format.js';

describe('format.formatPaise cases', () => {
  it('formats zero paise correctly', () => {
    expect(formatPaise(0)).toBe('₹0.00');
  });

  it('formats large amount with Indian number system grouping (e.g. ₹1,23,456.78)', () => {
    expect(formatPaise(12345678)).toBe('₹1,23,456.78');
  });

  it('formats 500 paise as ₹5.00', () => {
    expect(formatPaise(500)).toBe('₹5.00');
  });

  it('formats 75000 paise as ₹750.00', () => {
    expect(formatPaise(75000)).toBe('₹750.00');
  });

  it('formats small single-digit and double-digit paise amounts', () => {
    expect(formatPaise(1)).toBe('₹0.01');
    expect(formatPaise(99)).toBe('₹0.99');
    expect(formatPaise(100)).toBe('₹1.00');
  });

  it('formats string numbers correctly', () => {
    expect(formatPaise('5000')).toBe('₹50.00');
    expect(formatPaise('12345678')).toBe('₹1,23,456.78');
  });

  it('handles null, undefined, empty string, and NaN gracefully with ₹0.00 fallback', () => {
    expect(formatPaise(null)).toBe('₹0.00');
    expect(formatPaise(undefined)).toBe('₹0.00');
    expect(formatPaise(NaN)).toBe('₹0.00');
    expect(formatPaise('')).toBe('₹0.00');
    expect(formatPaise('not-a-number')).toBe('₹0.00');
  });
});

describe('getThreatCategoryLabel cases', () => {
  it('returns human-readable threat category names for standard categories', () => {
    expect(getThreatCategoryLabel('BENIGN')).toBe('Benign Request');
    expect(getThreatCategoryLabel('DIRECT_PROMPT_INJECTION')).toBe('Direct Prompt Injection');
    expect(getThreatCategoryLabel('ROLEPLAY_JAILBREAK')).toBe('Roleplay Jailbreak');
    expect(getThreatCategoryLabel('MEMO_INJECTION')).toBe('Memo Injection');
    expect(getThreatCategoryLabel('SERVICE_DEGRADED')).toBe('Service Degraded');
    expect(getThreatCategoryLabel('AMOUNT_MISMATCH')).toBe('Amount Mismatch');
  });

  it('handles unknown or empty threat categories gracefully', () => {
    expect(getThreatCategoryLabel('')).toBe('Unknown Category');
    expect(getThreatCategoryLabel(null)).toBe('Unknown Category');
    expect(getThreatCategoryLabel('CUSTOM_ATTACK_TYPE')).toBe('CUSTOM ATTACK TYPE');
  });
});
