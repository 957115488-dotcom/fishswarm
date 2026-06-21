const LONE_SURROGATE_HIGH = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g;
const LONE_SURROGATE_LOW = /(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
const DEFAULT_MAX_TEXT_CHARS = 180_000;

export interface SanitizedTextResult {
  text: string;
  changed: boolean;
  warnings: string[];
  originalLength: number;
}

export function sanitizeModelTextOutput(
  value: string,
  options: { maxChars?: number; label?: string } = {}
): SanitizedTextResult {
  const warnings: string[] = [];
  let text = value
    .replace(LONE_SURROGATE_HIGH, () => {
      warnings.push('lone_high_surrogate');
      return '\uFFFD';
    })
    .replace(LONE_SURROGATE_LOW, () => {
      warnings.push('lone_low_surrogate');
      return '\uFFFD';
    });

  const maxChars = options.maxChars ?? DEFAULT_MAX_TEXT_CHARS;
  if (text.length > maxChars) {
    const omitted = text.length - maxChars;
    text = `${text.slice(0, maxChars)}\n\n[${options.label || 'output'} truncated: ${omitted} chars omitted]`;
    warnings.push('truncated');
  }

  return {
    text,
    changed: text !== value || warnings.length > 0,
    warnings: [...new Set(warnings)],
    originalLength: value.length,
  };
}

export function sanitizeUnknownModelOutput(value: unknown, maxChars = DEFAULT_MAX_TEXT_CHARS): unknown {
  if (typeof value === 'string') {
    return sanitizeModelTextOutput(value, { maxChars }).text;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeUnknownModelOutput(item, maxChars));
  }
  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      output[key] = sanitizeUnknownModelOutput(item, maxChars);
    }
    return output;
  }
  return value;
}
