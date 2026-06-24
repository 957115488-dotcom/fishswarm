import { useState, useEffect, useCallback, useMemo, useRef, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  CheckCircle,
  Package,
  Power,
  PowerOff,
  Trash2,
  Plus,
  Loader2,
  FolderOpen,
  Globe,
  RefreshCw,
  X,
  Layers3,
} from 'lucide-react';
import type { Skill, PluginCatalogItemV2, InstalledPlugin, PluginComponentKind } from '../../types';
import { useAppStore } from '../../store';
import { useAppDialog } from '../AppDialog';
import { LowcodeModuleComposer } from '../lowcode/LowcodeModuleComposer';
import { SettingsContentSection } from './shared';
import type { LocalizedBanner } from './shared';

const isElectron = typeof window !== 'undefined' && window.electronAPI !== undefined;

interface DomainSkillDefinition {
  id: string;
  name: string;
  aliases?: string[];
  descriptionKey: string;
}

interface DomainSkillGroup {
  id: string;
  titleKey: string;
  descriptionKey: string;
  skills: DomainSkillDefinition[];
}

const DOMAIN_SKILL_GROUPS: DomainSkillGroup[] = [
  {
    id: 'dev-quality',
    titleKey: 'skills.domainGroups.devQuality.title',
    descriptionKey: 'skills.domainGroups.devQuality.description',
    skills: [
      {
        id: 'artifacts-builder',
        name: 'artifacts-builder',
        aliases: ['web-artifacts-builder'],
        descriptionKey: 'skills.domainSkillsList.artifactsBuilder.description',
      },
      {
        id: 'd3js-visualization',
        name: 'D3.js Visualization',
        aliases: ['claude-d3js-skill', 'd3-visualization', 'd3-viz'],
        descriptionKey: 'skills.domainSkillsList.d3jsVisualization.description',
      },
      {
        id: 'pypict-claude-skill',
        name: 'pypict-claude-skill',
        aliases: ['pypict', 'pict-test-designer'],
        descriptionKey: 'skills.domainSkillsList.pypict.description',
      },
      {
        id: 'playwright-browser-automation',
        name: 'Playwright Browser Automation',
        aliases: ['playwright-skill', 'webapp-testing'],
        descriptionKey: 'skills.domainSkillsList.playwright.description',
      },
    ],
  },
  {
    id: 'cloud-infra',
    titleKey: 'skills.domainGroups.cloudInfra.title',
    descriptionKey: 'skills.domainGroups.cloudInfra.description',
    skills: [
      {
        id: 'aws-skills',
        name: 'aws-skills',
        aliases: ['aws-agentic-ai'],
        descriptionKey: 'skills.domainSkillsList.awsSkills.description',
      },
      {
        id: 'langsmith-fetch',
        name: 'LangSmith Fetch',
        aliases: ['langsmith-fetch'],
        descriptionKey: 'skills.domainSkillsList.langsmithFetch.description',
      },
      {
        id: 'connect',
        name: 'Connect',
        aliases: ['connect'],
        descriptionKey: 'skills.domainSkillsList.connect.description',
      },
      {
        id: 'jules',
        name: 'jules',
        descriptionKey: 'skills.domainSkillsList.jules.description',
      },
    ],
  },
  {
    id: 'low-code-runtime',
    titleKey: 'skills.domainGroups.lowCodeRuntime.title',
    descriptionKey: 'skills.domainGroups.lowCodeRuntime.description',
    skills: [
      {
        id: 'lowcode-builder',
        name: 'Low-code Builder',
        aliases: ['Lowcode', 'desktop runtime', 'low-code-platform', 'lowcode-builder'],
        descriptionKey: 'skills.domainSkillsList.lowcodeBuilder.description',
      },
    ],
  },
  {
    id: 'data-research',
    titleKey: 'skills.domainGroups.dataResearch.title',
    descriptionKey: 'skills.domainGroups.dataResearch.description',
    skills: [
      {
        id: 'csv-data-summarizer',
        name: 'CSV Data Summarizer',
        aliases: ['csv-data-summarizer-claude-skill'],
        descriptionKey: 'skills.domainSkillsList.csvDataSummarizer.description',
      },
      {
        id: 'postgres',
        name: 'postgres',
        descriptionKey: 'skills.domainSkillsList.postgres.description',
      },
      {
        id: 'deep-research',
        name: 'deep-research',
        descriptionKey: 'skills.domainSkillsList.deepResearch.description',
      },
      {
        id: 'reddit-fetch',
        name: 'reddit-fetch',
        descriptionKey: 'skills.domainSkillsList.redditFetch.description',
      },
    ],
  },
  {
    id: 'security-mobile',
    titleKey: 'skills.domainGroups.securityMobile.title',
    descriptionKey: 'skills.domainGroups.securityMobile.description',
    skills: [
      {
        id: 'ffuf-web-fuzzing',
        name: 'FFUF Web Fuzzing',
        aliases: ['ffuf-claude-skill', 'ffuf_claude_skill'],
        descriptionKey: 'skills.domainSkillsList.ffufWebFuzzing.description',
      },
      {
        id: 'move-code-quality-skill',
        name: 'move-code-quality-skill',
        aliases: ['move-code-quality'],
        descriptionKey: 'skills.domainSkillsList.moveCodeQuality.description',
      },
      {
        id: 'ios-simulator',
        name: 'iOS Simulator',
        aliases: ['ios-simulator-skill'],
        descriptionKey: 'skills.domainSkillsList.iosSimulator.description',
      },
    ],
  },
  {
    id: 'business-marketing',
    titleKey: 'skills.domainGroups.businessMarketing.title',
    descriptionKey: 'skills.domainGroups.businessMarketing.description',
    skills: [
      {
        id: 'brand-guidelines',
        name: 'Brand Guidelines',
        descriptionKey: 'skills.domainSkillsList.brandGuidelines.description',
      },
      {
        id: 'competitive-ads-extractor',
        name: 'Competitive Ads Extractor',
        descriptionKey: 'skills.domainSkillsList.competitiveAdsExtractor.description',
      },
      {
        id: 'domain-name-brainstormer',
        name: 'Domain Name Brainstormer',
        descriptionKey: 'skills.domainSkillsList.domainNameBrainstormer.description',
      },
      {
        id: 'internal-comms',
        name: 'Internal Comms',
        descriptionKey: 'skills.domainSkillsList.internalComms.description',
      },
      {
        id: 'lead-research-assistant',
        name: 'Lead Research Assistant',
        descriptionKey: 'skills.domainSkillsList.leadResearchAssistant.description',
      },
    ],
  },
  {
    id: 'agent-extension',
    titleKey: 'skills.domainGroups.agentExtension.title',
    descriptionKey: 'skills.domainGroups.agentExtension.description',
    skills: [
      {
        id: 'prompt-engineering',
        name: 'prompt-engineering',
        descriptionKey: 'skills.domainSkillsList.promptEngineering.description',
      },
      {
        id: 'skill-seekers',
        name: 'Skill Seekers',
        aliases: ['skill-seekers', 'Skill_Seekers', 'skill-builder'],
        descriptionKey: 'skills.domainSkillsList.skillSeekers.description',
      },
      {
        id: 'claude-code-terminal-title',
        name: 'Claude Code Terminal Title',
        aliases: ['claude-code-terminal-title', 'terminal-title'],
        descriptionKey: 'skills.domainSkillsList.terminalTitle.description',
      },
    ],
  },
];

function normalizeSkillLookupValue(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getDomainSkillLookupKeys(skill: DomainSkillDefinition): string[] {
  return [skill.id, skill.name, ...(skill.aliases || [])]
    .map(normalizeSkillLookupValue)
    .filter(Boolean);
}

function getInstalledSkillLookupKeys(skill: Skill): string[] {
  const sourceFreeId = skill.id.replace(/^(builtin|global|project)-/, '');
  return [skill.name, sourceFreeId].map(normalizeSkillLookupValue).filter(Boolean);
}

export function SettingsSkills({ isActive }: { isActive: boolean }) {
  const { t } = useTranslation();
  const dialog = useAppDialog();
  const tRef = useRef(t);
  const builtinSkillsListRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    tRef.current = t;
  }, [t]);
  const skillsStorageChangedAt = useAppStore((state) => state.skillsStorageChangedAt);
  const skillsStorageChangeEvent = useAppStore((state) => state.skillsStorageChangeEvent);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [storagePath, setStoragePath] = useState('');
  const [plugins, setPlugins] = useState<PluginCatalogItemV2[]>([]);
  const [installedPluginsByKey, setInstalledPluginsByKey] = useState<
    Record<string, InstalledPlugin>
  >({});
  const [isLoading, setIsLoading] = useState(false);
  const [isPluginLoading, setIsPluginLoading] = useState(false);
  const [isPluginModalOpen, setIsPluginModalOpen] = useState(false);
  const [pluginActionKey, setPluginActionKey] = useState<string | null>(null);
  const [pluginToastMessage, setPluginToastMessage] = useState('');
  const [error, setError] = useState<LocalizedBanner | null>(null);
  const [success, setSuccess] = useState<LocalizedBanner | null>(null);
  const [builtinSkillsMaxHeight, setBuiltinSkillsMaxHeight] = useState<number | undefined>();
  const [activeDomainId, setActiveDomainId] = useState(DOMAIN_SKILL_GROUPS[0]?.id || '');
  const pluginToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const componentOrder: PluginComponentKind[] = ['skills', 'commands', 'agents', 'hooks', 'mcp'];

  function normalizePluginLookupKey(value: string | undefined): string {
    if (!value) {
      return '';
    }
    return value
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function getCatalogLookupKeys(plugin: PluginCatalogItemV2): string[] {
    const keys = new Set<string>();
    const addKey = (value: string | undefined) => {
      if (!value) {
        return;
      }
      const trimmed = value.trim();
      if (!trimmed) {
        return;
      }
      keys.add(trimmed);
      keys.add(trimmed.toLowerCase());
      const normalized = normalizePluginLookupKey(trimmed);
      if (normalized) {
        keys.add(normalized);
      }
    };

    addKey(plugin.name);
    addKey(plugin.pluginId);

    const marketplaceId = plugin.pluginId?.split('@')[0];
    addKey(marketplaceId);

    return [...keys];
  }

  useEffect(() => {
    if (!skillsStorageChangeEvent) {
      return;
    }
    if (skillsStorageChangeEvent.reason === 'fallback') {
      setError({ text: t('skills.storagePathFallback') });
      return;
    }
    if (skillsStorageChangeEvent.reason === 'watcher_error') {
      setError({
        text: t('skills.storageWatcherError', {
          message: skillsStorageChangeEvent.message || '',
        }),
      });
    }
  }, [skillsStorageChangeEvent, t]);

  function showPluginInstallToast(message: string) {
    setPluginToastMessage(message);
    if (pluginToastTimerRef.current) {
      clearTimeout(pluginToastTimerRef.current);
    }
    pluginToastTimerRef.current = setTimeout(() => {
      setPluginToastMessage('');
      pluginToastTimerRef.current = null;
    }, 5000);
  }

  const loadSkills = useCallback(async (silent = false) => {
    try {
      const [skillsResult, storagePathResult] = await Promise.allSettled([
        window.electronAPI.skills.getAll(),
        window.electronAPI.skills.getStoragePath(),
      ]);
      const errors: string[] = [];

      if (skillsResult.status === 'fulfilled') {
        setSkills(skillsResult.value || []);
      } else {
        errors.push(
          skillsResult.reason instanceof Error
            ? skillsResult.reason.message
            : tRef.current('skills.failedToLoad')
        );
      }
      if (storagePathResult.status === 'fulfilled') {
        setStoragePath(storagePathResult.value || '');
      } else {
        errors.push(
          storagePathResult.reason instanceof Error
            ? storagePathResult.reason.message
            : tRef.current('skills.storagePathUnavailable')
        );
      }

      if (errors.length > 0) {
        throw new Error(errors.join(' | '));
      }

      if (!silent) {
        setError(null);
      }
    } catch (err) {
      console.error('Failed to load skills:', err);
      if (!silent) {
        setError({
          text:
            err instanceof Error && err.message
              ? `${tRef.current('skills.failedToLoad')}: ${err.message}`
              : tRef.current('skills.failedToLoad'),
        });
      }
    }
  }, []);

  useEffect(() => {
    if (!isElectron || !isActive) {
      return () => {
        if (pluginToastTimerRef.current) {
          clearTimeout(pluginToastTimerRef.current);
        }
      };
    }

    void loadSkills();

    return () => {
      if (pluginToastTimerRef.current) {
        clearTimeout(pluginToastTimerRef.current);
      }
    };
  }, [isActive, loadSkills]);

  useEffect(() => {
    if (isElectron && isActive && skillsStorageChangedAt > 0) {
      void loadSkills(true);
    }
  }, [isActive, loadSkills, skillsStorageChangedAt]);

  async function loadPlugins() {
    try {
      setIsPluginLoading(true);
      const [catalog, installed] = await Promise.all([
        window.electronAPI.plugins.listCatalog({ installableOnly: false }),
        window.electronAPI.plugins.listInstalled(),
      ]);
      setPlugins(catalog || []);
      const nextInstalledByKey: Record<string, InstalledPlugin> = {};
      const addLookupKey = (key: string, plugin: InstalledPlugin) => {
        if (!key || nextInstalledByKey[key]) {
          return;
        }
        nextInstalledByKey[key] = plugin;
      };
      for (const plugin of installed || []) {
        const candidates = [
          plugin.name,
          plugin.name?.toLowerCase(),
          normalizePluginLookupKey(plugin.name),
          plugin.pluginId,
          plugin.pluginId?.toLowerCase(),
          normalizePluginLookupKey(plugin.pluginId),
        ].filter((value): value is string => Boolean(value));
        for (const key of candidates) {
          addLookupKey(key, plugin);
        }
      }
      setInstalledPluginsByKey(nextInstalledByKey);
      setError(null);
    } catch (err) {
      setError({ text: err instanceof Error ? err.message : t('skills.pluginInstallFailed') });
    } finally {
      setIsPluginLoading(false);
    }
  }

  async function handleBrowsePlugins() {
    setIsPluginModalOpen(true);
    await loadPlugins();
  }

  async function handleInstall() {
    try {
      const folderPath = await window.electronAPI.invoke<string | null>({
        type: 'folder.select',
        payload: {},
      });
      if (!folderPath) return;

      setIsLoading(true);
      const validation = await window.electronAPI.skills.validate(folderPath);

      if (!validation.valid) {
        setError({ text: `Invalid skill folder: ${validation.errors.join(', ')}` });
        return;
      }

      const result = await window.electronAPI.skills.install(folderPath);
      if (result.success) {
        await loadSkills();
        setError(null);
        setSuccess(null);
      }
    } catch (err) {
      setError({ text: err instanceof Error ? err.message : t('skills.failedToInstall') });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSelectStoragePath() {
    try {
      const folderPath = await window.electronAPI.invoke<string | null>({
        type: 'folder.select',
        payload: {},
      });
      if (!folderPath) return;

      setIsLoading(true);
      const result = await window.electronAPI.skills.setStoragePath(folderPath, true);
      if (result.success) {
        setStoragePath(result.path);
        await loadSkills(true);
        setError(null);
        setSuccess({
          text: t('skills.storagePathUpdated', {
            migrated: result.migratedCount,
            skipped: result.skippedCount,
          }),
        });
        setTimeout(() => setSuccess(null), 5000);
      }
    } catch (err) {
      setError({
        text: err instanceof Error ? err.message : t('skills.storagePathUpdateFailed'),
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleOpenStoragePath() {
    setIsLoading(true);
    try {
      const result = await window.electronAPI.skills.openStoragePath();
      if (!result.success) {
        setError({ text: result.error || t('skills.storagePathOpenFailed') });
        return;
      }
      setStoragePath(result.path);
      setError(null);
    } catch (err) {
      setError({ text: err instanceof Error ? err.message : t('skills.storagePathOpenFailed') });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRefreshSkills() {
    setIsLoading(true);
    try {
      await loadSkills();
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(skillId: string, skillName: string) {
    const confirmed = await dialog.confirm({
      message: t('skills.deleteSkill', { name: skillName }),
      intent: 'danger',
      confirmLabel: t('common.delete'),
    });
    if (!confirmed) return;

    setIsLoading(true);
    try {
      await window.electronAPI.skills.delete(skillId);
      await loadSkills();
    } catch (err) {
      setError({ text: err instanceof Error ? err.message : t('skills.failedToDelete') });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleToggleEnabled(skill: Skill) {
    setIsLoading(true);
    try {
      await window.electronAPI.skills.setEnabled(skill.id, !skill.enabled);
      await loadSkills();
    } catch (err) {
      setError({ text: err instanceof Error ? err.message : t('skills.failedToToggle') });
    } finally {
      setIsLoading(false);
    }
  }

  function getInstalledSkillForDomainSkill(
    domainSkill: DomainSkillDefinition,
    installedSkillsByKey: Map<string, Skill>
  ): Skill | undefined {
    return getDomainSkillLookupKeys(domainSkill)
      .map((key) => installedSkillsByKey.get(key))
      .find((skill): skill is Skill => Boolean(skill));
  }

  async function handleInstallAndEnableDomainSkill(
    domainSkill: DomainSkillDefinition,
    installedSkill?: Skill
  ) {
    setIsLoading(true);
    try {
      if (installedSkill) {
        await window.electronAPI.skills.setEnabled(installedSkill.id, !installedSkill.enabled);
      } else {
        await window.electronAPI.skills.installBundledDomainSkill(domainSkill.id);
      }
      await loadSkills();
      setError(null);
    } catch (err) {
      setError({ text: err instanceof Error ? err.message : t('skills.failedToInstall') });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSetDomainEnabled(group: DomainSkillGroup, enabled: boolean) {
    setIsLoading(true);
    try {
      if (enabled) {
        for (const domainSkill of group.skills) {
          const installedSkill = getInstalledSkillForDomainSkill(
            domainSkill,
            installedDomainSkillsByKey
          );
          if (installedSkill) {
            if (!installedSkill.enabled) {
              await window.electronAPI.skills.setEnabled(installedSkill.id, true);
            }
          } else {
            await window.electronAPI.skills.installBundledDomainSkill(domainSkill.id);
          }
        }
      } else {
        const installedSkills = group.skills
          .map((domainSkill) =>
            getInstalledSkillForDomainSkill(domainSkill, installedDomainSkillsByKey)
          )
          .filter((skill): skill is Skill => Boolean(skill));

        await Promise.all(
          installedSkills
            .filter((skill) => skill.enabled)
            .map((skill) => window.electronAPI.skills.setEnabled(skill.id, false))
        );
      }

      await loadSkills();
      setError(null);
    } catch (err) {
      setError({ text: err instanceof Error ? err.message : t('skills.failedToInstall') });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleInstallPlugin(plugin: PluginCatalogItemV2) {
    const installTarget = plugin.pluginId ?? plugin.name;
    setPluginActionKey(`install:${installTarget}`);
    setError(null);
    setSuccess(null);
    try {
      const result = await window.electronAPI.plugins.install(installTarget);
      await loadSkills();
      await loadPlugins();
      const message = t('skills.pluginInstallSuccess', { name: result.plugin.name });
      setSuccess({ text: message });
      showPluginInstallToast(message);
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError({ text: err instanceof Error ? err.message : t('skills.pluginInstallFailed') });
    } finally {
      setPluginActionKey(null);
    }
  }

  async function handleSetPluginEnabled(plugin: InstalledPlugin, enabled: boolean) {
    setPluginActionKey(`enabled:${plugin.pluginId}`);
    setError(null);
    try {
      await window.electronAPI.plugins.setEnabled(plugin.pluginId, enabled);
      await loadPlugins();
    } catch (err) {
      setError({ text: err instanceof Error ? err.message : t('skills.pluginInstallFailed') });
    } finally {
      setPluginActionKey(null);
    }
  }

  async function handleSetComponentEnabled(
    plugin: InstalledPlugin,
    component: PluginComponentKind,
    enabled: boolean
  ) {
    setPluginActionKey(`component:${plugin.pluginId}:${component}`);
    setError(null);
    try {
      await window.electronAPI.plugins.setComponentEnabled(plugin.pluginId, component, enabled);
      await loadPlugins();
    } catch (err) {
      setError({ text: err instanceof Error ? err.message : t('skills.pluginInstallFailed') });
    } finally {
      setPluginActionKey(null);
    }
  }

  async function handleUninstallPlugin(plugin: InstalledPlugin) {
    const confirmed = await dialog.confirm({
      message: t('skills.pluginUninstall', { name: plugin.name }),
      intent: 'danger',
      confirmLabel: t('common.delete'),
    });
    if (!confirmed) {
      return;
    }

    setPluginActionKey(`uninstall:${plugin.pluginId}`);
    setError(null);
    try {
      await window.electronAPI.plugins.uninstall(plugin.pluginId);
      await loadPlugins();
      showPluginInstallToast(t('skills.pluginUninstalled', { name: plugin.name }));
    } catch (err) {
      setError({ text: err instanceof Error ? err.message : t('skills.pluginInstallFailed') });
    } finally {
      setPluginActionKey(null);
    }
  }

  const builtinSkills = skills
    .filter((s) => s.type === 'builtin')
    .sort((a, b) => a.createdAt - b.createdAt || a.name.localeCompare(b.name));
  const domainSkillLookupKeys = useMemo(() => {
    const keys = new Set<string>();
    DOMAIN_SKILL_GROUPS.forEach((group) =>
      group.skills.forEach((domainSkill) => {
        getDomainSkillLookupKeys(domainSkill).forEach((key) => keys.add(key));
      })
    );
    return keys;
  }, []);
  const installedDomainSkillsByKey = useMemo(() => {
    const next = new Map<string, Skill>();
    skills
      .filter((skill) => skill.type !== 'builtin')
      .forEach((skill) => {
        getInstalledSkillLookupKeys(skill).forEach((key) => {
          if (domainSkillLookupKeys.has(key) && !next.has(key)) {
            next.set(key, skill);
          }
        });
      });
    return next;
  }, [domainSkillLookupKeys, skills]);
  const domainManagedSkillIds = useMemo(() => {
    const ids = new Set<string>();
    skills
      .filter((skill) => skill.type !== 'builtin')
      .forEach((skill) => {
        const isDomainSkill = getInstalledSkillLookupKeys(skill).some((key) =>
          domainSkillLookupKeys.has(key)
        );
        if (isDomainSkill) {
          ids.add(skill.id);
        }
      });
    return ids;
  }, [domainSkillLookupKeys, skills]);
  const customSkills = skills.filter(
    (s) => s.type !== 'builtin' && !domainManagedSkillIds.has(s.id)
  );

  useEffect(() => {
    const list = builtinSkillsListRef.current;
    if (!list || builtinSkills.length <= 3) {
      setBuiltinSkillsMaxHeight(undefined);
      return;
    }

    const updateMaxHeight = () => {
      const visibleCards = Array.from(list.children).slice(0, 3) as HTMLElement[];
      if (visibleCards.length < 3) {
        setBuiltinSkillsMaxHeight(undefined);
        return;
      }

      const listTop = list.getBoundingClientRect().top;
      const thirdCardBottom = visibleCards[2].getBoundingClientRect().bottom;
      setBuiltinSkillsMaxHeight(Math.ceil(thirdCardBottom - listTop));
    };

    updateMaxHeight();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(updateMaxHeight);
    observer.observe(list);
    Array.from(list.children)
      .slice(0, 3)
      .forEach((child) => observer.observe(child));

    return () => observer.disconnect();
  }, [builtinSkills.length, t]);

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-error/10 text-error text-sm">
          <AlertCircle className="w-4 h-4" />
          {error.key ? t(error.key) : error.text}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-success/10 text-success text-sm">
          <CheckCircle className="w-4 h-4" />
          {success.key ? t(success.key) : success.text}
        </div>
      )}

      <SettingsContentSection
        title={t('skills.storagePathTitle')}
        description={t('skills.storagePathHint')}
      >
        <div className="text-xs text-text-muted break-all">
          {storagePath || t('skills.storagePathUnavailable')}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <button
            onClick={handleSelectStoragePath}
            disabled={isLoading}
            className="w-full py-2.5 px-3 rounded-lg border border-border hover:border-accent hover:bg-accent/5 transition-all flex items-center justify-center gap-2 text-text-secondary hover:text-accent disabled:opacity-50"
          >
            <FolderOpen className="w-4 h-4" />
            {t('skills.selectStoragePath')}
          </button>
          <button
            onClick={handleOpenStoragePath}
            disabled={isLoading}
            className="w-full py-2.5 px-3 rounded-lg border border-border hover:border-accent hover:bg-accent/5 transition-all flex items-center justify-center gap-2 text-text-secondary hover:text-accent disabled:opacity-50"
          >
            <Globe className="w-4 h-4" />
            {t('skills.openStoragePath')}
          </button>
          <button
            onClick={handleRefreshSkills}
            disabled={isLoading}
            className="w-full py-2.5 px-3 rounded-lg border border-border hover:border-accent hover:bg-accent/5 transition-all flex items-center justify-center gap-2 text-text-secondary hover:text-accent disabled:opacity-50"
          >
            <RefreshCw className="w-4 h-4" />
            {t('skills.refreshSkills')}
          </button>
        </div>
      </SettingsContentSection>

      {/* Built-in Skills */}
      <SettingsContentSection
        title={t('skills.builtinSkills')}
        description={t('skills.builtinSkillsDesc')}
      >
        <div
          ref={builtinSkillsListRef}
          className={builtinSkills.length > 3 ? 'space-y-3 overflow-y-auto pr-2' : 'space-y-3'}
          style={
            builtinSkills.length > 3 && builtinSkillsMaxHeight
              ? { maxHeight: builtinSkillsMaxHeight }
              : undefined
          }
        >
          {builtinSkills.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              onToggleEnabled={() => handleToggleEnabled(skill)}
              onDelete={null}
              isLoading={isLoading}
            />
          ))}
        </div>
      </SettingsContentSection>

      <SettingsContentSection
        title={t('skills.domainSkills')}
        description={t('skills.domainSkillsDesc')}
      >
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <DomainSkillSelectorPanel
            groups={DOMAIN_SKILL_GROUPS}
            activeDomainId={activeDomainId}
            installedSkillsByKey={installedDomainSkillsByKey}
            isLoading={isLoading}
            onSelectDomain={setActiveDomainId}
            onSetDomainEnabled={handleSetDomainEnabled}
          />
          <DomainSkillDetailPanel
            group={
              DOMAIN_SKILL_GROUPS.find((group) => group.id === activeDomainId) ||
              DOMAIN_SKILL_GROUPS[0]
            }
            installedSkillsByKey={installedDomainSkillsByKey}
            isLoading={isLoading}
            onToggleSkill={handleInstallAndEnableDomainSkill}
          />
        </div>
      </SettingsContentSection>

      {/* Custom Skills */}
      <SettingsContentSection
        title={t('skills.customSkills')}
        description={t('skills.installSkillsDesc')}
      >
        {customSkills.length === 0 ? (
          <div className="text-center py-8 text-text-muted">
            <Package className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p>{t('skills.noCustomSkills')}</p>
            <p className="text-sm mt-1">{t('skills.installSkillsDesc')}</p>
          </div>
        ) : (
          customSkills.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              onToggleEnabled={() => handleToggleEnabled(skill)}
              onDelete={() => handleDelete(skill.id, skill.name)}
              isLoading={isLoading}
            />
          ))
        )}
      </SettingsContentSection>

      <SettingsContentSection
        title={t('skills.pluginsTitle')}
        description={t('skills.pluginsDesc')}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <button
            onClick={handleBrowsePlugins}
            disabled={isLoading || isPluginLoading}
            className="w-full py-3 px-4 rounded-lg border border-border-subtle hover:border-accent hover:bg-accent/5 transition-all flex items-center justify-center gap-2 text-text-secondary hover:text-accent disabled:opacity-50"
          >
            {isPluginLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Package className="w-5 h-5" />
            )}
            {t('skills.browsePlugins')}
          </button>
          <button
            onClick={handleInstall}
            disabled={isLoading}
            className="w-full py-3 px-4 rounded-lg border-2 border-dashed border-border-subtle hover:border-accent hover:bg-accent/5 transition-all flex items-center justify-center gap-2 text-text-secondary hover:text-accent disabled:opacity-50"
          >
            <Plus className="w-5 h-5" />
            {t('skills.installSkillFromFolder')}
          </button>
        </div>
      </SettingsContentSection>

      {isPluginModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl max-h-[80vh] overflow-hidden rounded-lg border border-border bg-surface shadow-elevated">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="text-lg font-semibold text-text-primary">
                {t('skills.pluginListTitle')}
              </h3>
              <button
                onClick={() => setIsPluginModalOpen(false)}
                className="p-2 rounded-lg hover:bg-surface-hover transition-colors"
              >
                <X className="w-5 h-5 text-text-secondary" />
              </button>
            </div>
            <div className="p-5 space-y-3 overflow-y-auto max-h-[65vh]">
              {isPluginLoading ? (
                <div className="py-8 flex items-center justify-center gap-2 text-text-secondary">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{t('common.loading')}</span>
                </div>
              ) : plugins.length === 0 ? (
                <div className="py-8 text-center text-text-muted">{t('skills.noPluginsFound')}</div>
              ) : (
                plugins.map((plugin) => (
                  <div
                    key={plugin.pluginId || plugin.name}
                    className="rounded-lg border border-border bg-surface-hover p-4"
                  >
                    {(() => {
                      const installedPlugin = getCatalogLookupKeys(plugin)
                        .map((key) => installedPluginsByKey[key])
                        .find((item): item is InstalledPlugin => Boolean(item));
                      const installTarget = plugin.pluginId ?? plugin.name;
                      const isInstalling = pluginActionKey === `install:${installTarget}`;
                      const componentEntries = componentOrder.filter(
                        (component) => plugin.componentCounts[component] > 0
                      );
                      const isMarketplaceCatalog = plugin.catalogSource === 'claude-marketplace';
                      const hasKnownComponents = componentEntries.length > 0;
                      const isInstallable = plugin.installable;
                      return (
                        <>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium text-text-primary truncate">
                                  {plugin.name}
                                </h4>
                                {plugin.version && (
                                  <span className="text-xs px-2 py-0.5 rounded bg-surface text-text-muted">
                                    v{plugin.version}
                                  </span>
                                )}
                              </div>
                              {plugin.description && (
                                <p className="text-sm text-text-muted line-clamp-2">
                                  {plugin.description}
                                </p>
                              )}
                              {hasKnownComponents ? (
                                <p className="text-xs text-text-muted mt-2">
                                  {t('skills.pluginComponents', {
                                    skills: plugin.componentCounts.skills,
                                    commands: plugin.componentCounts.commands,
                                    agents: plugin.componentCounts.agents,
                                    hooks: plugin.componentCounts.hooks,
                                    mcp: plugin.componentCounts.mcp,
                                  })}
                                </p>
                              ) : (
                                isMarketplaceCatalog &&
                                !installedPlugin && (
                                  <p className="text-xs text-text-muted mt-2">
                                    {t('skills.pluginComponentsAvailableAfterInstall')}
                                  </p>
                                )
                              )}
                              {hasKnownComponents &&
                                plugin.componentCounts.hooks > 0 &&
                                !installedPlugin && (
                                  <p className="text-xs text-warning mt-1">
                                    {t('skills.pluginComponentHooksDisabledByDefault')}
                                  </p>
                                )}
                              {hasKnownComponents &&
                                plugin.componentCounts.mcp > 0 &&
                                !installedPlugin && (
                                  <p className="text-xs text-warning mt-1">
                                    {t('skills.pluginComponentMcpDisabledByDefault')}
                                  </p>
                                )}
                              {!isInstallable && !isMarketplaceCatalog && (
                                <p className="text-xs text-error mt-1">
                                  {t('skills.pluginNoComponents')}
                                </p>
                              )}
                            </div>
                            {installedPlugin ? (
                              <span className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-success/10 text-success text-sm">
                                <CheckCircle className="w-4 h-4" />
                                {t('skills.pluginInstalled')}
                              </span>
                            ) : (
                              <button
                                onClick={() => handleInstallPlugin(plugin)}
                                disabled={!isInstallable || pluginActionKey !== null}
                                className="px-3 py-2 rounded-lg bg-accent text-white hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                              >
                                {isInstalling ? (
                                  <span className="inline-flex items-center gap-1">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    {t('common.install')}
                                  </span>
                                ) : (
                                  t('skills.pluginInstall')
                                )}
                              </button>
                            )}
                          </div>
                          {installedPlugin && (
                            <div className="mt-3 pt-3 border-t border-border space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-xs text-text-muted">
                                  {installedPlugin.enabled
                                    ? t('skills.pluginAppliedInRuntime')
                                    : t('skills.pluginDisabled')}
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() =>
                                      handleSetPluginEnabled(
                                        installedPlugin,
                                        !installedPlugin.enabled
                                      )
                                    }
                                    disabled={pluginActionKey !== null}
                                    className={`px-3 py-1.5 rounded-md text-xs ${
                                      installedPlugin.enabled
                                        ? 'bg-warning/10 text-warning hover:bg-warning/20'
                                        : 'bg-success/10 text-success hover:bg-success/20'
                                    } disabled:opacity-50`}
                                  >
                                    {installedPlugin.enabled
                                      ? t('skills.pluginDisable')
                                      : t('skills.pluginEnable')}
                                  </button>
                                  <button
                                    onClick={() => handleUninstallPlugin(installedPlugin)}
                                    disabled={pluginActionKey !== null}
                                    className="px-3 py-1.5 rounded-md text-xs bg-error/10 text-error hover:bg-error/20 disabled:opacity-50"
                                  >
                                    {t('skills.pluginManageUninstall')}
                                  </button>
                                </div>
                              </div>
                              <div className="space-y-1">
                                {componentEntries.map((component) => {
                                  const enabled = installedPlugin.componentsEnabled[component];
                                  return (
                                    <div
                                      key={`${installedPlugin.pluginId}:${component}`}
                                      className="flex items-center justify-between gap-2"
                                    >
                                      <div className="text-xs text-text-secondary">
                                        <span className="font-medium">{component}</span>
                                        <span className="text-text-muted">
                                          {' '}
                                          ({plugin.componentCounts[component]})
                                        </span>
                                      </div>
                                      <button
                                        onClick={() =>
                                          handleSetComponentEnabled(
                                            installedPlugin,
                                            component,
                                            !enabled
                                          )
                                        }
                                        disabled={pluginActionKey !== null}
                                        className={`px-2 py-1 rounded text-xs ${
                                          enabled
                                            ? 'bg-success/10 text-success hover:bg-success/20'
                                            : 'bg-surface text-text-muted hover:bg-surface-active'
                                        } disabled:opacity-50`}
                                      >
                                        {enabled
                                          ? t('skills.pluginDisable')
                                          : t('skills.pluginEnable')}
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {pluginToastMessage && (
        <div className="fixed right-6 bottom-6 z-[80] max-w-md rounded-lg border border-success/30 bg-surface px-4 py-3 shadow-elevated">
          <div className="flex items-start gap-2 text-success text-sm">
            <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{pluginToastMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function DomainSkillSelectorPanel({
  groups,
  activeDomainId,
  installedSkillsByKey,
  isLoading,
  onSelectDomain,
  onSetDomainEnabled,
}: {
  groups: DomainSkillGroup[];
  activeDomainId: string;
  installedSkillsByKey: Map<string, Skill>;
  isLoading: boolean;
  onSelectDomain: (domainId: string) => void;
  onSetDomainEnabled: (group: DomainSkillGroup, enabled: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="border-b border-border bg-surface-muted/30 px-3 py-3">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-text-muted">
        <span className="inline-flex items-center gap-1 rounded-md bg-surface px-2.5 py-1">
          <Layers3 className="h-3.5 w-3.5" />
          {t('skills.domainGroupsCount', { count: groups.length })}
        </span>
        <span>{t('skills.domainSelectHint')}</span>
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((group) => {
          const installedSkills = group.skills
            .map((domainSkill) =>
              getDomainSkillLookupKeys(domainSkill)
                .map((key) => installedSkillsByKey.get(key))
                .find((skill): skill is Skill => Boolean(skill))
            )
            .filter((skill): skill is Skill => Boolean(skill));
          const enabledCount = installedSkills.filter((skill) => skill.enabled).length;
          const isChecked = installedSkills.length > 0 && enabledCount === installedSkills.length;
          const isIndeterminate = enabledCount > 0 && enabledCount < installedSkills.length;
          const isActive = activeDomainId === group.id;

          return (
            <div
              key={group.id}
              className={
                'flex min-h-[54px] items-center gap-3 rounded-md border px-3 py-2 transition-colors ' +
                (isActive
                  ? 'border-accent bg-accent/5'
                  : 'border-border-subtle bg-surface hover:border-accent/60')
              }
            >
              <input
                type="checkbox"
                checked={isChecked}
                disabled={isLoading}
                ref={(element) => {
                  if (element) element.indeterminate = isIndeterminate;
                }}
                onClick={(event) => event.stopPropagation()}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  event.stopPropagation();
                  onSetDomainEnabled(group, !isChecked);
                }}
                className="h-4 w-4 shrink-0 cursor-pointer rounded border-border accent-accent focus:ring-accent disabled:cursor-wait disabled:opacity-60"
                title={t('skills.domainEnableAll')}
              />
              <button
                type="button"
                onClick={() => onSelectDomain(group.id)}
                className="min-w-0 flex-1 text-left"
              >
                <div className="truncate text-sm font-medium text-text-primary">
                  {t(group.titleKey)}
                </div>
                <div className="mt-0.5 text-xs text-text-muted">
                  {t('skills.domainEnabledRatio', {
                    enabled: enabledCount,
                    installed: installedSkills.length,
                    total: group.skills.length,
                  })}
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DomainSkillDetailPanel({
  group,
  installedSkillsByKey,
  isLoading,
  onToggleSkill,
}: {
  group: DomainSkillGroup | undefined;
  installedSkillsByKey: Map<string, Skill>;
  isLoading: boolean;
  onToggleSkill: (domainSkill: DomainSkillDefinition, installedSkill?: Skill) => void;
}) {
  const { t } = useTranslation();

  if (!group) return null;

  return (
    <div className="px-3 py-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-text-primary">{t(group.titleKey)}</h3>
          <p className="mt-1 text-xs leading-5 text-text-muted">{t(group.descriptionKey)}</p>
        </div>
        <span className="shrink-0 rounded-md bg-surface-muted px-2 py-1 text-xs text-text-muted">
          {group.skills.length}
        </span>
      </div>
      <div className="max-h-[294px] space-y-2 overflow-y-auto pr-2">
        {group.skills.map((domainSkill) => {
          const installedSkill = getDomainSkillLookupKeys(domainSkill)
            .map((key) => installedSkillsByKey.get(key))
            .find((skill): skill is Skill => Boolean(skill));
          const isInstalled = Boolean(installedSkill);
          const rowClassName = isInstalled
            ? 'border-border-subtle bg-surface hover:border-accent hover:bg-accent/5'
            : 'border-border-muted bg-surface-muted/30';
          const badgeClassName = installedSkill?.enabled
            ? 'bg-success/10 text-success'
            : isInstalled
              ? 'bg-surface-active text-text-secondary'
              : 'bg-warning/10 text-warning';
          const actionTitle = isInstalled
            ? installedSkill?.enabled
              ? t('common.disable')
              : t('common.enable')
            : t('skills.domainInstallAndEnable');

          return (
            <div
              key={domainSkill.id}
              className={
                'min-h-[88px] rounded-md border px-3 py-3 transition-colors ' + rowClassName
              }
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={installedSkill?.enabled || false}
                  disabled={isLoading}
                  onChange={() => onToggleSkill(domainSkill, installedSkill)}
                  className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border-border accent-accent focus:ring-accent disabled:cursor-wait disabled:opacity-60"
                  title={actionTitle}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-text-primary">
                      {domainSkill.name}
                    </span>
                    <span className={'rounded px-2 py-0.5 text-xs ' + badgeClassName}>
                      {installedSkill?.enabled
                        ? t('skills.skillEnabled')
                        : isInstalled
                          ? t('skills.skillDisabled')
                          : t('skills.notInstalled')}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-text-muted">
                    {t(domainSkill.descriptionKey)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleSkill(domainSkill, installedSkill)}
                  disabled={isLoading}
                  className={
                    'shrink-0 rounded-lg p-2 transition-colors ' +
                    (installedSkill?.enabled
                      ? 'bg-success/10 text-success hover:bg-success/20'
                      : isInstalled
                        ? 'bg-surface-muted text-text-muted hover:bg-surface-active'
                        : 'bg-accent/10 text-accent hover:bg-accent/20')
                  }
                  title={actionTitle}
                >
                  {installedSkill?.enabled ? (
                    <Power className="h-4 w-4" />
                  ) : (
                    <PowerOff className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {group.id === 'low-code-runtime' && (
        <div className="mt-4">
          <LowcodeModuleComposer />
        </div>
      )}
    </div>
  );
}

function SkillCard({
  skill,
  onToggleEnabled,
  onDelete,
  isLoading,
}: {
  skill: Skill;
  onToggleEnabled: () => void;
  onDelete: (() => void) | null;
  isLoading: boolean;
}) {
  const { t } = useTranslation();
  const isBuiltin = skill.type === 'builtin';

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <div
              className={`w-3 h-3 rounded-full ${skill.enabled ? 'bg-success' : 'bg-text-muted'}`}
            />
            <h3 className="font-medium text-text-primary">{skill.name}</h3>
            <span
              className={`px-2 py-0.5 text-xs rounded ${
                isBuiltin
                  ? 'bg-accent/10 text-accent'
                  : skill.type === 'mcp'
                    ? 'bg-mcp/10 text-mcp'
                    : 'bg-success/10 text-success'
              }`}
            >
              {skill.type.toUpperCase()}
            </span>
          </div>
          {skill.description && (
            <p className="text-sm text-text-muted ml-6 line-clamp-2">{skill.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleEnabled}
            disabled={isLoading}
            className={`p-2 rounded-lg transition-colors ${
              skill.enabled
                ? 'bg-success/10 text-success hover:bg-success/20'
                : 'bg-surface-muted text-text-muted hover:bg-surface-active'
            }`}
            title={skill.enabled ? t('common.disable') : t('common.enable')}
          >
            {skill.enabled ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
          </button>
          {onDelete && (
            <button
              onClick={onDelete}
              disabled={isLoading}
              className="p-2 rounded-lg bg-error/10 text-error hover:bg-error/20 transition-colors"
              title={t('common.delete')}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
