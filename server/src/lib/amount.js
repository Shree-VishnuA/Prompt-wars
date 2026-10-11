const CURRENCY_MAP = {
  '₹': 'INR',
  'rs': 'INR',
  'rs.': 'INR',
  'rupees': 'INR',
  'inr': 'INR',
  '$': 'USD',
  'usd': 'USD',
  'dollars': 'USD',
  'dollar': 'USD',
  'eur': 'EUR',
  '€': 'EUR',
  'euros': 'EUR',
  'euro': 'EUR',
  'gbp': 'GBP',
  '£': 'GBP',
  'pounds': 'GBP',
  'pound': 'GBP'
};

const WORD_VALUES = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90
};

const SCALE_VALUES = {
  hundred: 100,
  thousand: 1000,
  lakh: 100000,
  lakhs: 100000,
  lac: 100000,
  lacs: 100000,
  crore: 10000000,
  crores: 10000000
};

function parseWordsToNumber(phrase) {
  if (!phrase || typeof phrase !== 'string') return null;
  const clean = phrase.toLowerCase().replace(/-/g, ' ').replace(/\band\b/g, ' ').trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;

  let current = 0;
  let total = 0;
  let hasValidWord = false;

  for (const w of words) {
    if (w in WORD_VALUES) {
      current += WORD_VALUES[w];
      hasValidWord = true;
    } else if (w in SCALE_VALUES) {
      hasValidWord = true;
      const scale = SCALE_VALUES[w];
      if (scale === 100) {
        current = (current === 0 ? 1 : current) * 100;
      } else {
        total += (current === 0 ? 1 : current) * scale;
        current = 0;
      }
    } else {
      return null;
    }
  }

  if (!hasValidWord) return null;
  return total + current;
}

export function parseAmountText(input) {
  if (!input || typeof input !== 'string') return null;
  let text = input.trim();
  if (!text) return null;

  // 1. Rejection checks: negative numbers, scientific notation, hex
  if (/^-|^\s*-\s*|\bminus\b/i.test(text)) {
    return null;
  }
  if (/\b\d+e[+-]?\d+\b/i.test(text) || /\be[+-]?\d+\b/i.test(text)) {
    return null;
  }
  if (/0x[0-9a-fA-F]+/i.test(text)) {
    return null;
  }

  // 2. Currency extraction
  let currency = null;

  // Prefix currencies: ₹, $, €, £, Rs., Rs, INR, USD, EUR, GBP
  const prefixMatch = text.match(/^(₹|\$|€|£|Rs\.?|INR|USD|EUR|GBP)\s*/i);
  if (prefixMatch) {
    const rawSymbol = prefixMatch[1].toLowerCase();
    currency = CURRENCY_MAP[rawSymbol] || null;
    text = text.slice(prefixMatch[0].length).trim();
  }

  // Suffix currencies: rupees, rupee, rs., rs, dollars, dollar, usd, euros, euro, eur, pounds, pound, gbp, inr
  const suffixMatch = text.match(/\s*(rupees?|rs\.?|dollars?|euros?|pounds?|inr|usd|eur|gbp)$/i);
  if (suffixMatch) {
    const rawSuffix = suffixMatch[1].toLowerCase();
    if (!currency) {
      currency = CURRENCY_MAP[rawSuffix] || null;
    }
    text = text.slice(0, -suffixMatch[0].length).trim();
  }

  if (!text) return null;

  // 3. Try English words representation up to 99,99,999
  const wordNum = parseWordsToNumber(text);
  if (wordNum !== null) {
    if (wordNum <= 0) return null; // zero rejected
    if (wordNum > 9999999) return null; // cap at 99,99,999
    return {
      paise: wordNum * 100,
      currency
    };
  }

  // 4. Suffix multiplier check: 'k' (x1000), 'lakh'/'lac' (x100000)
  let multiplier = 1n;
  const suffixMultiMatch = text.match(/\s*(k|lakhs?|lacs?)$/i);
  if (suffixMultiMatch) {
    const s = suffixMultiMatch[1].toLowerCase();
    if (s === 'k') {
      multiplier = 1000n;
    } else {
      multiplier = 100000n;
    }
    text = text.slice(0, -suffixMultiMatch[0].length).trim();
  }

  // 5. Numeric validation and comma stripping
  // Validate standard comma separated numbers: 1,000 (Western) or 1,00,000 (Indian)
  if (text.includes(',')) {
    if (!/^\d{1,3}(?:,\d{2,3})*(?:\.\d+)?$/.test(text)) {
      return null;
    }
    text = text.replace(/,/g, '');
  }

  // Check decimals: max 2 places allowed
  let intPart = text;
  let decPart = '';

  if (text.includes('.')) {
    const parts = text.split('.');
    if (parts.length !== 2) return null;
    intPart = parts[0];
    decPart = parts[1];

    if (decPart.length > 2) {
      // decimals max 2 places (more than 2 -> not parsed, mark invalid)
      return null;
    }
  }

  if (!/^\d+$/.test(intPart)) return null;
  if (decPart && !/^\d+$/.test(decPart)) return null;

  // Check integer digits limit: max 12 digits
  if (intPart.length > 12) {
    return null;
  }

  const basePaise = BigInt(intPart) * 100n + BigInt(decPart.padEnd(2, '0') || '0');
  const totalPaise = basePaise * multiplier;

  if (totalPaise <= 0n) {
    return null; // zero amounts rejected
  }

  // Reject amounts exceeding 12 digits worth of currency units
  if (totalPaise > 99999999999900n) {
    return null;
  }

  return {
    paise: Number(totalPaise),
    currency
  };
}

export function findAllNumbers(text) {
  if (!text || typeof text !== 'string') return [];
  const results = [];

  // Match numbers (including negatives, hex, decimals, exponents, suffixes)
  const numRegex = /(?:0x[0-9a-fA-F]+|-?\b\d+(?:,\d+)*(?:\.\d+)?(?:e[+-]?\d+)?(?:\s*(?:k|lakhs?|lacs?))?\b)/gi;
  let match;

  while ((match = numRegex.exec(text)) !== null) {
    results.push({
      text: match[0],
      start: match.index,
      end: match.index + match[0].length
    });
  }

  // Match written English number sequences
  const wordRegex = /\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[\s-]+(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|lakhs?|lacs?|crores?|and))*\b/gi;

  while ((match = wordRegex.exec(text)) !== null) {
    // Avoid duplicate spans
    const start = match.index;
    const end = match.index + match[0].length;
    const overlaps = results.some((r) => Math.max(r.start, start) < Math.min(r.end, end));
    if (!overlaps) {
      results.push({
        text: match[0],
        start,
        end
      });
    }
  }

  return results.sort((a, b) => a.start - b.start);
}

export function findAmounts(text) {
  if (!text || typeof text !== 'string') return [];
  const amounts = [];

  // Candidate patterns for amounts in context
  const candidateRegex = /(?:[₹$€£]|Rs\.?|INR|USD|EUR|GBP)?\s*(?:-?\d+(?:,\d+)*(?:\.\d+)?(?:e[+-]?\d+)?|0x[0-9a-fA-F]+|(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[\s-]+(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|lakhs?|lacs?|crores?|and))*)\s*(?:k|lakhs?|lacs?)?\s*(?:rupees?|rs\.?|dollars?|euros?|pounds?|INR|USD|EUR|GBP)?/gi;

  let match;
  while ((match = candidateRegex.exec(text)) !== null) {
    const matchedText = match[0].trim();
    if (!matchedText) continue;

    // Check if directly preceded by a negative sign in the source text
    const prevChar = text[match.index - 1];
    if (prevChar === '-') {
      continue;
    }

    const parsed = parseAmountText(matchedText);
    if (parsed !== null) {
      const start = match.index + match[0].indexOf(matchedText);
      const end = start + matchedText.length;

      // Overlap resolution: keep longer span
      const existingIdx = amounts.findIndex((a) => Math.max(a.start, start) < Math.min(a.end, end));
      if (existingIdx !== -1) {
        if (matchedText.length > amounts[existingIdx].text.length) {
          amounts[existingIdx] = {
            text: matchedText,
            paise: parsed.paise,
            currency: parsed.currency,
            start,
            end
          };
        }
      } else {
        amounts.push({
          text: matchedText,
          paise: parsed.paise,
          currency: parsed.currency,
          start,
          end
        });
      }
    }
  }

  return amounts.sort((a, b) => a.start - b.start);
}
