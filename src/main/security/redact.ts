const SECRET_PATTERNS: Array<{ id: string; regex: RegExp; replacement: string }> = [
  { id: 'openai.api_key', regex: /\bsk-[A-Za-z0-9_-]{20,}\b/g, replacement: '<REDACTED-OPENAI-KEY>' },
  { id: 'anthropic.api_key', regex: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g, replacement: '<REDACTED-ANTHROPIC-KEY>' },
  { id: 'github.token', regex: /\bgh[pousr]_[A-Za-z0-9_]{30,}\b/g, replacement: '<REDACTED-GITHUB-TOKEN>' },
  { id: 'slack.token', regex: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g, replacement: '<REDACTED-SLACK-TOKEN>' },
  { id: 'jwt', regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, replacement: '<REDACTED-JWT>' },
  {
    id: 'env.secret',
    regex: /\b([A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|API_KEY|AUTH)[A-Z0-9_]*=)([^\s'"`]{8,})/g,
    replacement: '$1<REDACTED-SECRET>',
  },
];

export interface RedactionResult {
  value: string;
  redacted: boolean;
  findings: string[];
}

export function redactText(input: string): RedactionResult {
  let value = input;
  const findings: string[] = [];

  for (const pattern of SECRET_PATTERNS) {
    pattern.regex.lastIndex = 0;
    if (pattern.regex.test(value)) {
      findings.push(pattern.id);
      pattern.regex.lastIndex = 0;
      value = value.replace(pattern.regex, pattern.replacement);
    }
  }

  return { value, redacted: findings.length > 0, findings };
}

export function redactUnknown<T>(input: T): { value: T; redacted: boolean; findings: string[] } {
  const findings = new Set<string>();
  let redacted = false;

  function visit(value: unknown, depth: number): unknown {
    if (depth > 20) return value;
    if (typeof value === 'string') {
      const result = redactText(value);
      if (result.redacted) {
        redacted = true;
        result.findings.forEach((item) => findings.add(item));
      }
      return result.value;
    }
    if (Array.isArray(value)) {
      return value.map((item) => visit(item, depth + 1));
    }
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [key, nested] of Object.entries(value)) {
        const keyLooksSensitive = /token|secret|password|api[_-]?key|auth/i.test(key);
        if (keyLooksSensitive && typeof nested === 'string' && nested.length > 0) {
          redacted = true;
          findings.add(`field.${key}`);
          out[key] = '<REDACTED-SECRET>';
        } else {
          out[key] = visit(nested, depth + 1);
        }
      }
      return out;
    }
    return value;
  }

  return { value: visit(input, 0) as T, redacted, findings: Array.from(findings) };
}

