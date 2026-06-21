import { scanUntrustedText } from '../security/content-security';
import { runGStackBrowseCommand } from '../mcp/gstack-browse-runner';
import type { RoleCandidateSource, RoleCapabilityGap } from './role-types';

export interface RoleResearchProvider {
  researchRoleCapability(gap: RoleCapabilityGap): Promise<{
    sourceSummary: string;
    sources: RoleCandidateSource[];
  }>;
}

export interface RoleResearchQuery {
  capabilityPhrases: string[];
  maxSources: number;
  provider: 'gstack_browse' | 'browser_skill' | 'mcp_search';
}

export interface RoleResearchConnector {
  searchRoleCapability(query: RoleResearchQuery): Promise<RoleCandidateSource[]>;
}

export function createDefaultControlledRoleResearchProvider(cwd?: string): RoleResearchProvider {
  return new ControlledRoleResearchProvider(new GStackBrowseRoleResearchConnector(cwd));
}

export class LocalRoleResearchProvider implements RoleResearchProvider {
  async researchRoleCapability(gap: RoleCapabilityGap): Promise<{
    sourceSummary: string;
    sources: RoleCandidateSource[];
  }> {
    return {
      sourceSummary: buildLocalCapabilitySummary(gap),
      sources: [
        {
          kind: 'local_synthesis',
          title: 'FishSwarm local capability synthesis',
          verdict: 'allow',
          reasons: [],
          sanitizedExcerpt: buildLocalCapabilitySummary(gap),
        },
      ],
    };
  }
}

export class ControlledRoleResearchProvider implements RoleResearchProvider {
  constructor(private readonly connector: RoleResearchConnector) {}

  async researchRoleCapability(gap: RoleCapabilityGap): Promise<{
    sourceSummary: string;
    sources: RoleCandidateSource[];
  }> {
    const local = new LocalRoleResearchProvider();
    try {
      const sources = await this.connector.searchRoleCapability(buildSanitizedResearchQuery(gap));
      const sanitizedSources = sources
        .slice(0, 3)
        .map((source) => sanitizeSource(source));
      const blockedSources = sanitizedSources.filter((source) => source.verdict === 'block');
      if (blockedSources.length > 0) {
        return {
          sourceSummary: 'Controlled research returned blocked content and was not used.',
          sources: blockedSources,
        };
      }
      const safeSources = sanitizedSources.filter((source) => source.verdict !== 'block');
      if (safeSources.length === 0) {
        const fallback = await local.researchRoleCapability(gap);
        return {
          sourceSummary: `${fallback.sourceSummary} Controlled research returned no safe sources.`,
          sources: fallback.sources,
        };
      }
      return {
        sourceSummary: safeSources
          .map((source) => source.sanitizedExcerpt || source.title)
          .filter(Boolean)
          .join('\n')
          .slice(0, 2000),
        sources: safeSources,
      };
    } catch (error) {
      const fallback = await local.researchRoleCapability(gap);
      const message = error instanceof Error ? error.message : String(error);
      return {
        sourceSummary: `${fallback.sourceSummary} Controlled research failed and local synthesis was used.`,
        sources: [
          ...fallback.sources,
          {
            kind: 'local_synthesis',
            title: 'Controlled research fallback',
            verdict: 'warn',
            reasons: [`provider_failed:${message.slice(0, 120)}`],
          },
        ],
      };
    }
  }
}

export class GStackBrowseRoleResearchConnector implements RoleResearchConnector {
  constructor(private readonly cwd?: string) {}

  async searchRoleCapability(query: RoleResearchQuery): Promise<RoleCandidateSource[]> {
    const searchText = [
      ...query.capabilityPhrases,
      'role responsibilities boundaries output criteria',
    ]
      .join(' ')
      .slice(0, 240);
    const url = `https://www.bing.com/search?q=${encodeURIComponent(searchText)}`;
    await runGStackBrowseCommand('goto', [url], {
      cwd: this.cwd,
      timeoutMs: 30_000,
      maxOutputChars: 4000,
      source: 'role-research-provider',
      toolName: 'role_research_gstack_browse_open',
      eventPrefix: 'role_research_gstack_browse',
    });
    const text = await runGStackBrowseCommand('text', [], {
      cwd: this.cwd,
      timeoutMs: 30_000,
      maxOutputChars: 4000,
      source: 'role-research-provider',
      toolName: 'role_research_gstack_browse_text',
      eventPrefix: 'role_research_gstack_browse',
    });
    if (!text.trim()) return [];
    return [
      {
        kind: 'web_research',
        title: 'GStack Browse role capability research',
        url,
        sanitizedExcerpt: text.slice(0, 3000),
        verdict: 'allow',
        reasons: [],
      },
    ];
  }
}

export function buildSanitizedResearchQuery(gap: RoleCapabilityGap): RoleResearchQuery {
  const capabilityPhrases = gap.missingCapabilities
    .map((phrase) =>
      phrase
        .toLowerCase()
        .replace(/https?:\/\/\S+/g, ' ')
        .replace(/\b[\w.%+-]+@[\w.-]+\.[a-z]{2,}\b/g, ' ')
        .replace(/\b(api[_-]?key|token|secret|password|bearer)\b[:=]?\S*/gi, ' ')
        .replace(/[`"'|;&<>$]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 80)
    )
    .filter(Boolean);
  return {
    capabilityPhrases: capabilityPhrases.length > 0 ? capabilityPhrases : ['specialist role responsibilities'],
    maxSources: 3,
    provider: 'gstack_browse',
  };
}

export function buildLocalCapabilitySummary(gap: RoleCapabilityGap): string {
  return `Candidate role should cover: ${gap.missingCapabilities.join(', ')}. It should define identity, boundaries, input requirements, output format, completion criteria, validation criteria, safety rules, and decision authority before being used.`;
}

function sanitizeSource(source: RoleCandidateSource): RoleCandidateSource {
  const text = [source.title, source.sanitizedExcerpt || ''].filter(Boolean).join('\n');
  const scan = scanUntrustedText(text);
  return {
    ...source,
    sanitizedExcerpt: scan.sanitizedText.slice(0, 1000),
    verdict: scan.verdict,
    reasons: [...(source.reasons || []), ...scan.reasons],
  };
}
