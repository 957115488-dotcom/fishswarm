#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(__dirname, '..');
const blueprintPath = path.join(skillRoot, 'assets', 'component-blueprints.json');

function parseArgs(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith('--')) continue;
    args.set(key.slice(2), argv[index + 1]);
    index += 1;
  }
  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sanitizeComponentName(value) {
  const compact = String(value || '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

  const componentName = compact || 'GeneratedLowcodeModule';
  return /^[A-Z]/.test(componentName) ? componentName : `Generated${componentName}`;
}

function cssSafeName(value) {
  return String(value || 'generated-lowcode-module')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function asStringArray(value) {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function validateManifest(manifest, blueprints) {
  const errors = [];
  const allowedKinds = new Set(blueprints.blocks.map((block) => block.kind));

  if (!manifest || typeof manifest !== 'object') {
    errors.push('manifest must be an object');
  }
  if (!Array.isArray(manifest.blocks) || manifest.blocks.length === 0) {
    errors.push('manifest.blocks must be a non-empty array');
  }

  (manifest.blocks || []).forEach((block, index) => {
    if (!allowedKinds.has(block.kind)) {
      errors.push(`blocks[${index}].kind is unsupported: ${block.kind}`);
    }
    if (!block.title) {
      errors.push(`blocks[${index}].title is required`);
    }
  });

  if (errors.length > 0) {
    const message = errors.map((error) => `- ${error}`).join('\n');
    throw new Error(`Invalid low-code module manifest:\n${message}`);
  }
}

function literal(value) {
  return JSON.stringify(value, null, 2);
}

function buildTsx(manifest, componentName, cssFileName) {
  return `import type { CSSProperties } from 'react';
import './${cssFileName}';

type GeneratedBlockKind =
  | 'metric-card'
  | 'module-card'
  | 'process-flow'
  | 'api-connector'
  | 'data-table'
  | 'form-section';

interface GeneratedBlock {
  kind: GeneratedBlockKind;
  title: string;
  description: string;
  accent?: string;
  data?: Record<string, unknown>;
}

const blocks: GeneratedBlock[] = ${literal(manifest.blocks)};

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function renderBlock(block: GeneratedBlock, index: number) {
  const data = block.data || {};
  const accentStyle = { '--cwgen-accent': block.accent || '#10b981' } as CSSProperties;

  if (block.kind === 'metric-card') {
    return (
      <article className="cwgen-block cwgen-metric" style={accentStyle}>
        <span>{block.title}</span>
        <strong>{String(data.value || '-')}</strong>
        <small>{String(data.delta || '0')} / {String(data.label || 'metric')}</small>
        <p>{block.description}</p>
      </article>
    );
  }

  if (block.kind === 'process-flow') {
    return (
      <article className="cwgen-block cwgen-flow" style={accentStyle}>
        <span>{block.title}</span>
        <p>{block.description}</p>
        <div>
          {asStringArray(data.steps).map((step) => <em key={step}>{step}</em>)}
        </div>
      </article>
    );
  }

  if (block.kind === 'api-connector') {
    return (
      <article className="cwgen-block cwgen-api" style={accentStyle}>
        <span>{block.title}</span>
        <p>{block.description}</p>
        <code>{String(data.method || 'GET')} {String(data.endpoint || '/api')}</code>
        <small>auth: {String(data.auth || 'none')}</small>
      </article>
    );
  }

  if (block.kind === 'data-table') {
    const columns = asStringArray(data.columns);
    const rows = Array.isArray(data.rows) ? data.rows as unknown[][] : [];
    return (
      <article className="cwgen-block cwgen-table" style={accentStyle}>
        <span>{block.title}</span>
        <p>{block.description}</p>
        <table>
          <thead>
            <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={\`\${index}-\${rowIndex}\`}>
                {row.map((cell, cellIndex) => <td key={\`\${index}-\${rowIndex}-\${cellIndex}\`}>{String(cell)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    );
  }

  if (block.kind === 'form-section') {
    return (
      <article className="cwgen-block cwgen-form" style={accentStyle}>
        <span>{block.title}</span>
        <p>{block.description}</p>
        {asStringArray(data.fields).map((field) => (
          <label key={field}>
            {field}
            <input placeholder={\`输入\${field}\`} />
          </label>
        ))}
      </article>
    );
  }

  return (
    <article className="cwgen-block cwgen-module" style={accentStyle}>
      <span>{block.title}</span>
      <p>{block.description}</p>
      <strong>{String(data.status || 'Ready')}</strong>
      <div>{asStringArray(data.items).map((item) => <em key={item}>{item}</em>)}</div>
    </article>
  );
}

export function ${componentName}() {
  return (
    <section className="cwgen-shell">
      <header className="cwgen-header">
        <span>${escapeText(manifest.theme || 'low-code')}</span>
        <h2>${escapeText(manifest.name || componentName)}</h2>
        <p>${escapeText(manifest.description || 'Generated from a low-code manifest.')}</p>
      </header>
      <div className="cwgen-grid">
        {blocks.map((block, index) => <div key={\`\${block.kind}-\${index}\`}>{renderBlock(block, index)}</div>)}
      </div>
    </section>
  );
}

export default ${componentName};
`;
}

function escapeText(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}

function buildCss() {
  return `.cwgen-shell {
  color: #101614;
  border: 1px solid rgba(16, 22, 20, 0.12);
  border-radius: 24px;
  background:
    radial-gradient(circle at 8% 0%, rgba(16, 185, 129, 0.22), transparent 32%),
    linear-gradient(135deg, #faf7ed, #eef8f1 54%, #eff7ff);
  box-shadow: 0 24px 70px rgba(13, 30, 24, 0.14);
  overflow: hidden;
}

.cwgen-header {
  padding: 28px;
  border-bottom: 1px solid rgba(16, 22, 20, 0.12);
}

.cwgen-header span,
.cwgen-block > span {
  color: #0f766e;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.cwgen-header h2 {
  margin: 8px 0;
  font-size: clamp(28px, 4vw, 46px);
  line-height: 0.96;
  letter-spacing: -0.055em;
}

.cwgen-header p,
.cwgen-block p,
.cwgen-block small {
  color: #64706b;
  line-height: 1.6;
}

.cwgen-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  padding: 18px;
}

.cwgen-block {
  --cwgen-accent: #10b981;
  position: relative;
  min-height: 166px;
  padding: 16px;
  border: 1px solid rgba(16, 22, 20, 0.1);
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.84), rgba(255, 255, 255, 0.58)),
    radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--cwgen-accent) 22%, transparent), transparent 52%);
  box-shadow: 0 12px 30px rgba(16, 22, 20, 0.08);
  overflow: hidden;
}

.cwgen-block::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 5px;
  background: var(--cwgen-accent);
}

.cwgen-metric strong {
  display: block;
  margin-top: 16px;
  font-size: 42px;
  letter-spacing: -0.06em;
}

.cwgen-flow div,
.cwgen-module div {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

.cwgen-flow em,
.cwgen-module em {
  border-radius: 999px;
  background: color-mix(in srgb, var(--cwgen-accent) 16%, white);
  padding: 7px 10px;
  font-size: 12px;
  font-style: normal;
  font-weight: 800;
}

.cwgen-api code {
  display: block;
  margin: 14px 0 8px;
  padding: 11px;
  border-radius: 12px;
  background: #101614;
  color: #d6fbe7;
  white-space: pre-wrap;
}

.cwgen-table table {
  width: 100%;
  margin-top: 12px;
  border-collapse: collapse;
  font-size: 12px;
}

.cwgen-table th,
.cwgen-table td {
  border-bottom: 1px solid rgba(16, 22, 20, 0.12);
  padding: 7px;
  text-align: left;
}

.cwgen-form label {
  display: grid;
  gap: 5px;
  margin-top: 10px;
  color: #64706b;
  font-size: 12px;
  font-weight: 800;
}

.cwgen-form input {
  border: 1px solid rgba(16, 22, 20, 0.12);
  border-radius: 10px;
  padding: 9px 10px;
  background: rgba(255, 255, 255, 0.74);
}

@media (max-width: 980px) {
  .cwgen-grid {
    grid-template-columns: 1fr;
  }
}
`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifestArg = args.get('manifest');
  const outArg = args.get('out');

  if (!manifestArg || !outArg) {
    console.error('Usage: node generate-lowcode-module.mjs --manifest <module.json> --out <directory>');
    process.exit(1);
  }

  const manifestPath = path.resolve(process.cwd(), manifestArg);
  const outDir = path.resolve(process.cwd(), outArg);
  const blueprints = readJson(blueprintPath);
  const manifest = readJson(manifestPath);
  validateManifest(manifest, blueprints);

  const componentName = sanitizeComponentName(manifest.componentName || manifest.name);
  const baseName = cssSafeName(componentName);
  const tsxFileName = `${componentName}.tsx`;
  const cssFileName = `${baseName}.css`;

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, tsxFileName), buildTsx(manifest, componentName, cssFileName));
  fs.writeFileSync(path.join(outDir, cssFileName), buildCss());

  console.log(JSON.stringify({
    componentName,
    files: [
      path.join(outDir, tsxFileName),
      path.join(outDir, cssFileName),
    ],
  }, null, 2));
}

main();
