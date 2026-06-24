import { DragEvent, useMemo, useState, type CSSProperties } from 'react';
import './LowcodeModuleComposer.css';

export type LowcodeBlockKind =
  | 'metric-card'
  | 'module-card'
  | 'process-flow'
  | 'api-connector'
  | 'data-table'
  | 'form-section';

export interface LowcodeBlockBlueprint {
  kind: LowcodeBlockKind;
  displayName: string;
  description: string;
  defaultTitle: string;
  accent: string;
  data?: Record<string, unknown>;
}

export interface LowcodeCanvasBlock {
  id: string;
  kind: LowcodeBlockKind;
  title: string;
  description: string;
  accent: string;
  data?: Record<string, unknown>;
}

const DEFAULT_BLUEPRINTS: LowcodeBlockBlueprint[] = [
  {
    kind: 'metric-card',
    displayName: '指标卡',
    description: '关键数值、趋势和状态。',
    defaultTitle: '关键指标',
    accent: '#10b981',
    data: { value: '128', delta: '+12%', label: 'this week' },
  },
  {
    kind: 'module-card',
    displayName: '功能模块卡',
    description: '封装业务能力入口。',
    defaultTitle: '业务模块',
    accent: '#f59e0b',
    data: { status: 'Ready', items: ['配置', '执行', '验收'] },
  },
  {
    kind: 'process-flow',
    displayName: '流程编排',
    description: '业务流程、角色交接或自动化步骤。',
    defaultTitle: '流程设计',
    accent: '#a855f7',
    data: { steps: ['输入', '生成', '校验', '发布'] },
  },
  {
    kind: 'api-connector',
    displayName: '接口连接器',
    description: 'API、MCP、数据库或存储集成。',
    defaultTitle: '接口集成',
    accent: '#fb7185',
    data: { method: 'POST', endpoint: '/api/example', auth: 'scoped' },
  },
  {
    kind: 'data-table',
    displayName: '数据表格',
    description: '实体、资产、任务或运行记录。',
    defaultTitle: '数据模型',
    accent: '#38bdf8',
    data: {
      columns: ['名称', '类型', '状态'],
      rows: [
        ['Role', 'entity', 'active'],
        ['Skill', 'asset', 'enabled'],
      ],
    },
  },
  {
    kind: 'form-section',
    displayName: '表单区块',
    description: '模型字段、API 参数或流程配置。',
    defaultTitle: '配置表单',
    accent: '#84cc16',
    data: { fields: ['名称', '描述', '负责人'] },
  },
];

const STARTER_BATCH: LowcodeCanvasBlock[] = [
  {
    id: 'starter-metric-roles',
    kind: 'metric-card',
    title: '角色在线',
    description: '当前可参与调度的鱼群角色数量。',
    accent: '#10b981',
    data: { value: '7', delta: '+2', label: 'ready roles' },
  },
  {
    id: 'starter-module-factory',
    kind: 'module-card',
    title: '低代码模块工厂',
    description: '把组件蓝图批量生成成可审查、可复制、可版本化的 React 模块。',
    accent: '#f59e0b',
    data: { status: 'MVP', items: ['组件蓝图', '拖拽作坊', '批量生成脚本'] },
  },
  {
    id: 'starter-flow',
    kind: 'process-flow',
    title: '生成流程',
    description: '从业务意图到可运行模块的最小闭环。',
    accent: '#a855f7',
    data: { steps: ['选择蓝图', '拖拽排序', '批量生成', '验收发布'] },
  },
];

function createBlock(blueprint: LowcodeBlockBlueprint): LowcodeCanvasBlock {
  return {
    id: `${blueprint.kind}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    kind: blueprint.kind,
    title: blueprint.defaultTitle,
    description: blueprint.description,
    accent: blueprint.accent,
    data: blueprint.data,
  };
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function renderBlock(block: LowcodeCanvasBlock) {
  const data = block.data || {};

  if (block.kind === 'metric-card') {
    return (
      <article
        className="cwlc-block cwlc-metric"
        style={{ '--cwlc-accent': block.accent } as CSSProperties}
      >
        <span className="cwlc-block-kicker">{block.title}</span>
        <strong>{String(data.value || '-')}</strong>
        <small>
          {String(data.delta || '0')} / {String(data.label || 'metric')}
        </small>
        <p>{block.description}</p>
      </article>
    );
  }

  if (block.kind === 'process-flow') {
    const steps = asStringArray(data.steps);
    return (
      <article
        className="cwlc-block cwlc-flow"
        style={{ '--cwlc-accent': block.accent } as CSSProperties}
      >
        <span className="cwlc-block-kicker">{block.title}</span>
        <p>{block.description}</p>
        <div className="cwlc-flow-line">
          {steps.map((step, index) => (
            <span key={`${block.id}-${step}-${index}`}>{step}</span>
          ))}
        </div>
      </article>
    );
  }

  if (block.kind === 'api-connector') {
    return (
      <article
        className="cwlc-block cwlc-api"
        style={{ '--cwlc-accent': block.accent } as CSSProperties}
      >
        <span className="cwlc-block-kicker">{block.title}</span>
        <p>{block.description}</p>
        <code>
          {String(data.method || 'GET')} {String(data.endpoint || '/api')}
        </code>
        <small>auth: {String(data.auth || 'none')}</small>
      </article>
    );
  }

  if (block.kind === 'data-table') {
    const columns = asStringArray(data.columns);
    const rows = Array.isArray(data.rows) ? (data.rows as unknown[][]) : [];
    return (
      <article
        className="cwlc-block cwlc-table"
        style={{ '--cwlc-accent': block.accent } as CSSProperties}
      >
        <span className="cwlc-block-kicker">{block.title}</span>
        <p>{block.description}</p>
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={`${block.id}-${rowIndex}`}>
                {row.map((cell, cellIndex) => (
                  <td key={`${block.id}-${rowIndex}-${cellIndex}`}>{String(cell)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    );
  }

  if (block.kind === 'form-section') {
    const fields = asStringArray(data.fields);
    return (
      <article
        className="cwlc-block cwlc-form"
        style={{ '--cwlc-accent': block.accent } as CSSProperties}
      >
        <span className="cwlc-block-kicker">{block.title}</span>
        <p>{block.description}</p>
        <div className="cwlc-form-fields">
          {fields.map((field) => (
            <label key={field}>
              {field}
              <input placeholder={`输入${field}`} />
            </label>
          ))}
        </div>
      </article>
    );
  }

  const items = asStringArray(data.items);
  return (
    <article
      className="cwlc-block cwlc-module"
      style={{ '--cwlc-accent': block.accent } as CSSProperties}
    >
      <span className="cwlc-block-kicker">{block.title}</span>
      <p>{block.description}</p>
      <strong>{String(data.status || 'Ready')}</strong>
      <div className="cwlc-chip-row">
        {items.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
    </article>
  );
}

export function LowcodeModuleComposer({
  blueprints = DEFAULT_BLUEPRINTS,
  initialBlocks = STARTER_BATCH,
}: {
  blueprints?: LowcodeBlockBlueprint[];
  initialBlocks?: LowcodeCanvasBlock[];
}) {
  const [blocks, setBlocks] = useState<LowcodeCanvasBlock[]>(initialBlocks);
  const [activeKind, setActiveKind] = useState<LowcodeBlockKind | null>(null);
  const exportJson = useMemo(() => JSON.stringify({ blocks }, null, 2), [blocks]);

  function handleDragStart(event: DragEvent<HTMLButtonElement>, blueprint: LowcodeBlockBlueprint) {
    event.dataTransfer.setData('application/x-lowcode-block', blueprint.kind);
    event.dataTransfer.effectAllowed = 'copy';
    setActiveKind(blueprint.kind);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const kind = event.dataTransfer.getData('application/x-lowcode-block') as LowcodeBlockKind;
    const blueprint = blueprints.find((item) => item.kind === kind);
    if (!blueprint) return;
    setBlocks((current) => [...current, createBlock(blueprint)]);
    setActiveKind(null);
  }

  return (
    <section className="cwlc-shell">
      <header className="cwlc-hero">
        <div>
          <span className="cwlc-eyebrow">Low-code Builder x FishSwarm</span>
          <h2>低代码模块作坊</h2>
          <p>把成熟组件拖到画布，或批量套用 manifest，生成可审查、可版本化的功能模块。</p>
        </div>
        <div className="cwlc-actions">
          <button type="button" onClick={() => setBlocks(STARTER_BATCH)}>
            批量套用示例
          </button>
          <button type="button" onClick={() => setBlocks([])}>
            清空画布
          </button>
        </div>
      </header>

      <div className="cwlc-layout">
        <aside className="cwlc-palette" aria-label="组件蓝图">
          <h3>组件蓝图</h3>
          <p>拖拽到右侧画布。</p>
          {blueprints.map((blueprint) => (
            <button
              key={blueprint.kind}
              type="button"
              draggable
              onDragStart={(event) => handleDragStart(event, blueprint)}
              onDragEnd={() => setActiveKind(null)}
              onClick={() => setBlocks((current) => [...current, createBlock(blueprint)])}
              className={activeKind === blueprint.kind ? 'is-active' : ''}
            >
              <span style={{ background: blueprint.accent }} />
              <strong>{blueprint.displayName}</strong>
              <small>{blueprint.description}</small>
            </button>
          ))}
        </aside>

        <main
          className="cwlc-canvas"
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
          aria-label="模块画布"
        >
          {blocks.length === 0 ? (
            <div className="cwlc-empty">把左侧组件拖进来，或点击“批量套用示例”。</div>
          ) : (
            blocks.map((block) => (
              <div key={block.id} className="cwlc-canvas-item">
                {renderBlock(block)}
              </div>
            ))
          )}
        </main>

        <aside className="cwlc-export" aria-label="导出 JSON">
          <h3>Manifest</h3>
          <p>拖拽结果可作为批量生成输入。</p>
          <pre>{exportJson}</pre>
        </aside>
      </div>
    </section>
  );
}

export default LowcodeModuleComposer;
