import { describe, it, expect } from 'vitest';
import { normalizeText } from '../src/lib/normalize.js';

describe('Text Normalization Pipeline', () => {
  it('handles non-string and empty inputs gracefully without throwing', () => {
    expect(normalizeText(null)).toEqual({
      original: '',
      normalized: '',
      flags: [],
      layers: []
    });

    expect(normalizeText(undefined)).toEqual({
      original: '',
      normalized: '',
      flags: [],
      layers: []
    });

    expect(normalizeText(12345)).toEqual({
      original: '',
      normalized: '',
      flags: [],
      layers: []
    });

    expect(normalizeText('')).toEqual({
      original: '',
      normalized: '',
      flags: [],
      layers: []
    });
  });

  it('caps processed length at 2000 chars', () => {
    const longInput = 'a'.repeat(2500);
    const result = normalizeText(longInput);
    expect(result.original.length).toBe(2500);
    expect(result.normalized.length).toBe(2000);
  });

  it('step 2: detects and strips zero-width chars ("ig\\u200Bnore")', () => {
    const result = normalizeText('ig\u200Bnore');
    expect(result.flags).toContain('ZERO_WIDTH');
    expect(result.normalized).toBe('ignore');
  });

  it('step 3: detects and strips bidi control characters', () => {
    const result = normalizeText('transfer \u202E500\u202C to rahul');
    expect(result.flags).toContain('BIDI_CONTROL');
    expect(result.normalized).toBe('transfer 500 to rahul');
  });

  it('step 4: maps Cyrillic homoglyphs in mixed words ("ignоre" with Cyrillic о)', () => {
    // \u043E is Cyrillic small letter o
    const mixed = 'ign\u043Ere';
    const result = normalizeText(mixed);

    expect(result.flags).toContain('HOMOGLYPH');
    expect(result.normalized).toBe('ignore');
  });

  it('step 5: collapses whitespace and lowercases', () => {
    const result = normalizeText('  CHECK   BALANCE   NOW  ');
    expect(result.normalized).toBe('check balance now');
  });

  it('step 6: de-leets tokens containing letters into "deleet" layer ("1gn0re")', () => {
    const result = normalizeText('1gn0re');
    expect(result.normalized).toBe('1gn0re');
    expect(result.layers).toContainEqual({
      kind: 'deleet',
      text: 'ignore'
    });
  });

  it('step 7: collapses spaced letters sequences ("i g n o r e", "i.g.n.o.r.e", "i-g-n-o-r-e")', () => {
    const spacedSpace = normalizeText('i g n o r e');
    expect(spacedSpace.flags).toContain('SPACED_LETTERS');
    expect(spacedSpace.layers).toContainEqual({
      kind: 'despaced',
      text: 'ignore'
    });

    const spacedDot = normalizeText('i.g.n.o.r.e');
    expect(spacedDot.flags).toContain('SPACED_LETTERS');
    expect(spacedDot.layers).toContainEqual({
      kind: 'despaced',
      text: 'ignore'
    });

    const spacedHyphen = normalizeText('i-g-n-o-r-e');
    expect(spacedHyphen.flags).toContain('SPACED_LETTERS');
    expect(spacedHyphen.layers).toContainEqual({
      kind: 'despaced',
      text: 'ignore'
    });
  });

  it('step 8: decodes base64 ("aWdub3JlIHJ1bGVz" -> "ignore rules")', () => {
    const result = normalizeText('aWdub3JlIHJ1bGVz');
    expect(result.flags).toContain('ENCODED_CONTENT');
    expect(result.layers).toContainEqual({
      kind: 'base64',
      text: 'ignore rules'
    });
  });

  it('step 8: decodes hex ("69676e6f7265" -> "ignore")', () => {
    const result = normalizeText('69676e6f7265');
    expect(result.flags).toContain('ENCODED_CONTENT');
    expect(result.layers).toContainEqual({
      kind: 'hex',
      text: 'ignore'
    });
  });

  it('step 8: decodes URL-encoding ("%69gnore" -> "ignore")', () => {
    const result = normalizeText('%69gnore');
    expect(result.flags).toContain('ENCODED_CONTENT');
    expect(result.layers).toContainEqual({
      kind: 'url',
      text: 'ignore'
    });
  });

  it('step 8: handles double-encoded base64 recursively up to depth 3', () => {
    // "ignore rules" -> base64: "aWdub3JlIHJ1bGVz" -> base64: "YVdkYmF5SmxJSFExYkdWeg=="
    const doubleB64 = Buffer.from('aWdub3JlIHJ1bGVz').toString('base64');
    const result = normalizeText(doubleB64);

    expect(result.flags).toContain('ENCODED_CONTENT');
    expect(result.layers).toContainEqual({
      kind: 'base64',
      text: 'aWdub3JlIHJ1bGVz'
    });
    expect(result.layers).toContainEqual({
      kind: 'base64',
      text: 'ignore rules'
    });
  });

  it('step 8: decodes rot13 when it matches attack keywords ("vtaber" -> "ignore")', () => {
    // rot13 of "ignore" is "vtaber"
    const result = normalizeText('vtaber');
    expect(result.flags).toContain('ENCODED_CONTENT');
    expect(result.layers).toContainEqual({
      kind: 'rot13',
      text: 'ignore'
    });
  });

  it('flags HIGH_ENTROPY_BLOB for undecodable tokens >= 24 chars of base64/hex charset', () => {
    // Random 32-byte hex string that decodes to non-printable binary bytes
    const undecodableBlob = '0102030405060708090a0b0c0d0e0f101112131415161718';
    const result = normalizeText(undecodableBlob);
    expect(result.flags).toContain('HIGH_ENTROPY_BLOB');
  });

  it('leaves benign Hindi text unchanged and unflagged', () => {
    const hindi = 'राहुल को 500 रुपये भेजो';
    const result = normalizeText(hindi);

    expect(result.normalized).toBe(hindi);
    expect(result.flags).toEqual([]);
    expect(result.layers).toEqual([]);
  });

  it('leaves benign "send 500 to rahul" unflagged', () => {
    const benign = 'send 500 to rahul';
    const result = normalizeText(benign);

    expect(result.normalized).toBe('send 500 to rahul');
    expect(result.flags).toEqual([]);
    expect(result.layers).toEqual([]);
  });
});
