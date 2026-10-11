// Character definitions & maps
const ZERO_WIDTH_REGEX = /[\u200B-\u200F\u2060-\u2064\uFEFF\u00AD]/g;
const BIDI_CONTROL_REGEX = /[\u202A-\u202E\u2066-\u2069]/g;

// Explicit homoglyph map: Cyrillic and Greek lookalikes to Latin
const HOMOGLYPH_MAP = {
  // Cyrillic lowercase
  '\u0430': 'a', // а
  '\u0435': 'e', // е
  '\u043E': 'o', // о
  '\u0440': 'p', // р
  '\u0441': 'c', // с
  '\u0443': 'y', // у
  '\u0445': 'x', // х
  '\u0456': 'i', // і
  '\u0458': 'j', // ј
  '\u0455': 's', // ѕ
  // Cyrillic uppercase
  '\u0410': 'A', // А
  '\u0412': 'B', // В
  '\u0415': 'E', // Е
  '\u041A': 'K', // К
  '\u041C': 'M', // М
  '\u041D': 'H', // Н
  '\u041E': 'O', // О
  '\u0420': 'P', // Р
  '\u0421': 'C', // С
  '\u0422': 'T', // Т
  '\u0425': 'X', // Х
  '\u0423': 'Y', // У
  // Greek uppercase
  '\u0391': 'A', // Α
  '\u0392': 'B', // Β
  '\u0395': 'E', // Ε
  '\u0396': 'Z', // Ζ
  '\u0397': 'H', // Η
  '\u0399': 'I', // Ι
  '\u039A': 'K', // Κ
  '\u039C': 'M', // Μ
  '\u039D': 'N', // Ν
  '\u039F': 'O', // Ο
  '\u03A1': 'P', // Ρ
  '\u03A4': 'T', // Τ
  '\u03A5': 'Y', // Υ
  '\u03A7': 'X', // Χ
  // Greek lowercase
  '\u03B1': 'a', // α
  '\u03B2': 'b', // β
  '\u03B5': 'e', // ε
  '\u03B9': 'i', // ι
  '\u03BA': 'k', // κ
  '\u03BD': 'v', // ν
  '\u03BF': 'o', // ο
  '\u03C1': 'p', // ρ
  '\u03C4': 't', // τ
  '\u03C5': 'y', // υ
  '\u03C7': 'x'  // χ
};

const LEET_MAP = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  '$': 's'
};

const ROT13_KEYWORDS = ['ignore', 'system', 'prompt', 'instruction', 'override', 'transfer'];
const ROT13_KEYWORD_REGEX = new RegExp(`\\b(${ROT13_KEYWORDS.join('|')})\\b`, 'i');

const HTML_NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  nbsp: ' ', copy: '©', reg: '®', deg: '°'
};

function isMostlyPrintable(str) {
  if (!str || typeof str !== 'string' || str.length === 0) return false;
  if (str.includes('\0') || str.includes('\uFFFD')) return false;

  let printable = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    // Unprintable ASCII control characters indicate binary data
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
      return false;
    }
    if (code >= 0x7f && code <= 0x9f) {
      return false;
    }
    if (
      (code >= 32 && code <= 126) ||
      code === 9 ||
      code === 10 ||
      code === 13 ||
      (code >= 160 && code !== 65533)
    ) {
      printable++;
    }
  }
  return (printable / str.length) >= 0.85;
}

function tryUrlDecode(text) {
  if (!/%[0-9a-fA-F]{2}/i.test(text)) return null;
  try {
    const decoded = decodeURIComponent(text);
    if (decoded !== text && isMostlyPrintable(decoded)) {
      return decoded;
    }
  } catch {
    try {
      const decoded = text.replace(/%([0-9a-fA-F]{2})/g, (_, h) => {
        return String.fromCharCode(parseInt(h, 16));
      });
      if (decoded !== text && isMostlyPrintable(decoded)) {
        return decoded;
      }
    } catch {}
  }
  return null;
}

function tryHtmlDecode(text) {
  if (!/&(#(?:x[0-9a-fA-F]+|[0-9]+)|[a-zA-Z]+);/i.test(text)) return null;
  const decoded = text.replace(/&(#(?:x[0-9a-fA-F]+|[0-9]+)|[a-zA-Z]+);/gi, (match, entity) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const code = parseInt(entity.slice(2), 16);
      return !isNaN(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    if (entity.startsWith('#')) {
      const code = parseInt(entity.slice(1), 10);
      return !isNaN(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    const lower = entity.toLowerCase();
    return HTML_NAMED_ENTITIES[lower] || match;
  });

  if (decoded !== text && isMostlyPrintable(decoded)) {
    return decoded;
  }
  return null;
}

function tryDecodeBase64Token(token) {
  if (token.length < 16) return null;
  let padded = token;
  while (padded.length % 4 !== 0) {
    padded += '=';
  }
  try {
    const buf = Buffer.from(padded, 'base64');
    const decoded = buf.toString('utf-8');
    if (isMostlyPrintable(decoded) && decoded.length > 0) {
      return decoded;
    }
  } catch {}
  return null;
}

function tryBase64Decode(text) {
  let changed = false;
  const decodedText = text.replace(/[A-Za-z0-9+/_-]{16,}={0,2}/g, (token) => {
    const decoded = tryDecodeBase64Token(token);
    if (decoded !== null) {
      changed = true;
      return decoded;
    }
    return token;
  });
  return changed ? decodedText : null;
}

function tryDecodeHexToken(token) {
  if (token.length < 8 || token.length % 2 !== 0) return null;
  try {
    const buf = Buffer.from(token, 'hex');
    const decoded = buf.toString('utf8');
    if (isMostlyPrintable(decoded) && decoded.length > 0) {
      return decoded;
    }
  } catch {}
  return null;
}

function tryHexDecode(text) {
  let changed = false;

  // Escaped hex like \x69\x67...
  if (/(\\x[0-9a-fA-F]{2})+/.test(text)) {
    const decodedEscapes = text.replace(/(\\x[0-9a-fA-F]{2})+/g, (match) => {
      const hexStr = match.replace(/\\x/g, '');
      const buf = Buffer.from(hexStr, 'hex');
      const utf8 = buf.toString('utf8');
      if (isMostlyPrintable(utf8)) {
        changed = true;
        return utf8;
      }
      return match;
    });
    if (changed) return decodedEscapes;
  }

  // Raw hex tokens >= 8 chars with even length
  const decodedText = text.replace(/\b[0-9a-fA-F]{8,}\b/g, (token) => {
    const decoded = tryDecodeHexToken(token);
    if (decoded !== null) {
      changed = true;
      return decoded;
    }
    return token;
  });

  return changed ? decodedText : null;
}

function tryRot13(text) {
  const rotated = text.replace(/[a-zA-Z]/g, (c) => {
    const code = c.charCodeAt(0);
    const base = code >= 97 ? 97 : 65;
    return String.fromCharCode(((code - base + 13) % 26) + base);
  });

  if (ROT13_KEYWORD_REGEX.test(rotated)) {
    return rotated;
  }
  return null;
}

export function normalizeText(input) {
  if (typeof input !== 'string') {
    return {
      original: '',
      normalized: '',
      flags: [],
      layers: []
    };
  }

  const original = input;
  let text = input.slice(0, 2000);
  const flags = [];
  const layers = [];

  // Step 1: Unicode NFKC
  text = text.normalize('NFKC');

  // Step 2: Remove zero-width & invisible chars
  if (ZERO_WIDTH_REGEX.test(text)) {
    flags.push('ZERO_WIDTH');
    text = text.replace(ZERO_WIDTH_REGEX, '');
  }

  // Step 3: Remove bidi controls
  if (BIDI_CONTROL_REGEX.test(text)) {
    flags.push('BIDI_CONTROL');
    text = text.replace(BIDI_CONTROL_REGEX, '');
  }

  // Step 4: Map common Cyrillic/Greek homoglyphs to Latin
  // Flag "HOMOGLYPH" ONLY when a single word mixes Latin with Cyrillic/Greek
  let mixedHomoglyphFound = false;
  text = text.replace(/\p{L}+/gu, (word) => {
    const hasLatin = /[a-zA-Z]/.test(word);
    const hasCyrillicOrGreek = /[\u0400-\u04FF\u0370-\u03FF]/.test(word);

    if (hasLatin && hasCyrillicOrGreek) {
      mixedHomoglyphFound = true;
      return word.replace(/[\u0400-\u04FF\u0370-\u03FF]/g, (ch) => HOMOGLYPH_MAP[ch] || ch);
    }
    return word;
  });

  if (mixedHomoglyphFound) {
    flags.push('HOMOGLYPH');
  }

  // Preserve casing before step 5 for case-sensitive decoders (base64, etc.)
  const casePreservedText = text.replace(/\s+/g, ' ').trim();

  // Step 5: Lowercase and collapse whitespace into normalized string
  const normalized = casePreservedText.toLowerCase();

  // Step 6: De-leet (ONLY inside tokens that also contain letters)
  const tokens = normalized.split(' ');
  let leetFound = false;
  const deleetTokens = tokens.map((token) => {
    if (/[a-z]/i.test(token) && /[013457@$]/.test(token)) {
      leetFound = true;
      return token.replace(/[013457@$]/g, (ch) => LEET_MAP[ch] || ch);
    }
    return token;
  });

  if (leetFound) {
    const deleetText = deleetTokens.join(' ');
    if (deleetText !== normalized) {
      layers.push({ kind: 'deleet', text: deleetText });
    }
  }

  // Step 7: Collapse spaced-out or dotted/hyphenated letter sequences (4+ single letters)
  const despacedRegex = /(?<=^|[\s\p{P}])([a-zA-Z](?:[\s.\-_]+[a-zA-Z]){3,})(?=$|[\s\p{P}])/gu;
  if (despacedRegex.test(normalized)) {
    const despacedText = normalized.replace(despacedRegex, (match) => {
      return match.replace(/[\s.\-_]+/g, '');
    });
    if (despacedText !== normalized) {
      flags.push('SPACED_LETTERS');
      layers.push({ kind: 'despaced', text: despacedText });
    }
  }

  // Step 8: Decode attempts, recursion depth max 3
  // Uses casePreservedText to correctly process case-sensitive payloads like base64
  let currentDecode = casePreservedText;
  let depth = 0;
  const maxDepth = 3;

  while (depth < maxDepth) {
    depth++;
    let roundChanged = false;

    // URL-encoding
    const urlResult = tryUrlDecode(currentDecode);
    if (urlResult && urlResult !== currentDecode) {
      if (!flags.includes('ENCODED_CONTENT')) flags.push('ENCODED_CONTENT');
      layers.push({ kind: 'url', text: urlResult });
      currentDecode = urlResult;
      roundChanged = true;
    }

    // HTML entities
    const htmlResult = tryHtmlDecode(currentDecode);
    if (htmlResult && htmlResult !== currentDecode) {
      if (!flags.includes('ENCODED_CONTENT')) flags.push('ENCODED_CONTENT');
      layers.push({ kind: 'html', text: htmlResult });
      currentDecode = htmlResult;
      roundChanged = true;
    }

    // Base64
    const b64Result = tryBase64Decode(currentDecode);
    if (b64Result && b64Result !== currentDecode) {
      if (!flags.includes('ENCODED_CONTENT')) flags.push('ENCODED_CONTENT');
      layers.push({ kind: 'base64', text: b64Result });
      currentDecode = b64Result;
      roundChanged = true;
    }

    // Hex
    const hexResult = tryHexDecode(currentDecode);
    if (hexResult && hexResult !== currentDecode) {
      if (!flags.includes('ENCODED_CONTENT')) flags.push('ENCODED_CONTENT');
      layers.push({ kind: 'hex', text: hexResult });
      currentDecode = hexResult;
      roundChanged = true;
    }

    // Rot13
    const rot13Result = tryRot13(currentDecode);
    if (rot13Result && rot13Result !== currentDecode) {
      if (!flags.includes('ENCODED_CONTENT')) flags.push('ENCODED_CONTENT');
      layers.push({ kind: 'rot13', text: rot13Result });
      currentDecode = rot13Result;
      roundChanged = true;
    }

    if (!roundChanged) {
      break;
    }
  }

  // Flag "HIGH_ENTROPY_BLOB" for any undecodable token >=24 chars of base64/hex charset
  const candidateTokens = casePreservedText.split(/\s+/).filter(Boolean);
  for (const token of candidateTokens) {
    const clean = token.replace(/^[^\w+/_=-]+|[^\w+/_=-]+$/g, '');
    if (clean.length >= 24 && /^[A-Za-z0-9+/=_-]{24,}$/.test(clean)) {
      const isB64Decodable = tryDecodeBase64Token(clean) !== null;
      const isHexDecodable = clean.length % 2 === 0 && tryDecodeHexToken(clean) !== null;
      if (!isB64Decodable && !isHexDecodable) {
        if (!flags.includes('HIGH_ENTROPY_BLOB')) {
          flags.push('HIGH_ENTROPY_BLOB');
        }
      }
    }
  }

  return {
    original,
    normalized,
    flags: Array.from(new Set(flags)),
    layers
  };
}
