import { PATTERN_GROUPS } from './patterns.js';

const SEVERITY_LEVELS = {
  medium: 1,
  high: 2,
  critical: 3
};

function ensureNormalized(data) {
  if (!data) return { original: '', normalized: '', flags: [], layers: [] };
  if (typeof data === 'string') {
    return { original: data, normalized: data.toLowerCase(), flags: [], layers: [] };
  }
  return {
    original: data.original || '',
    normalized: data.normalized || '',
    flags: Array.isArray(data.flags) ? data.flags : [],
    layers: Array.isArray(data.layers) ? data.layers : []
  };
}

export function runDetectors({ instruction, memo } = {}) {
  const fields = [
    { name: 'instruction', data: ensureNormalized(instruction) },
    { name: 'memo', data: ensureNormalized(memo) }
  ];

  const findings = [];
  const seenFindings = new Set();

  function addFinding(finding) {
    const key = `${finding.id}:${finding.field}:${finding.category}:${finding.evidence}`;
    if (!seenFindings.has(key)) {
      seenFindings.add(key);
      findings.push(finding);
    }
  }

  for (const { name: fieldName, data } of fields) {
    const origLower = data.original.toLowerCase();
    const norm = data.normalized;
    const layers = data.layers || [];
    const flags = data.flags || [];

    let layerMatchedGroup = null;

    // Scan pattern groups
    for (const [groupId, group] of Object.entries(PATTERN_GROUPS)) {
      // MEMO_AI_ADDRESS is strictly for the memo field
      if (groupId === 'MEMO_AI_ADDRESS' && fieldName !== 'memo') {
        continue;
      }

      for (const pattern of group.patterns) {
        // 1. Check primary text (original lowercased and normalized)
        const origMatch = origLower.match(pattern);
        const normMatch = norm.match(pattern);
        const primaryMatch = normMatch || origMatch;

        if (primaryMatch) {
          addFinding({
            id: groupId,
            field: fieldName,
            severity: group.severity,
            category: group.category,
            evidence: primaryMatch[0]
          });
        } else {
          // 2. Check every layer text
          for (const layer of layers) {
            const layerText = (layer.text || '').toLowerCase();
            const layerMatch = layerText.match(pattern);

            if (layerMatch) {
              layerMatchedGroup = group;
              // If match only appears in a decoded layer, assign TOKEN_OBFUSCATION with the group's severity
              addFinding({
                id: `${groupId}_OBFUSCATED`,
                field: fieldName,
                severity: group.severity,
                category: 'TOKEN_OBFUSCATION',
                evidence: `${layerMatch[0]} (in ${layer.kind} layer)`
              });
            }
          }
        }
      }
    }

    // 3. Structural flags from normalization
    for (const flag of flags) {
      if (layerMatchedGroup) {
        // Upgrade structural finding when an obfuscated layer matches a threat pattern
        addFinding({
          id: `STRUCTURAL_${flag}`,
          field: fieldName,
          severity: layerMatchedGroup.severity,
          category: layerMatchedGroup.category,
          evidence: `${flag} (de-obfuscated payload matches ${layerMatchedGroup.id})`
        });
      } else {
        addFinding({
          id: `STRUCTURAL_${flag}`,
          field: fieldName,
          severity: 'medium',
          category: 'TOKEN_OBFUSCATION',
          evidence: flag
        });
      }
    }
  }

  // Calculate maxSeverity
  let maxSeverity = null;
  let maxRank = 0;

  for (const f of findings) {
    const rank = SEVERITY_LEVELS[f.severity] || 0;
    if (rank > maxRank) {
      maxRank = rank;
      maxSeverity = f.severity;
    }
  }

  return {
    findings,
    maxSeverity
  };
}
