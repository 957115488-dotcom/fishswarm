import { Package } from 'lucide-react';

export function SettingsSkills({ isActive }: { isActive: boolean }) {
  if (!isActive) return null;

  return (
    <div className="space-y-4">
      <section className="space-y-3 py-5 border-b border-border-muted">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-md border border-border-muted bg-bg-secondary p-2 text-text-secondary">
            <Package className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-text-primary">技能设置暂时不可用</h4>
            <p className="text-xs leading-5 text-text-muted">
              原始 SettingsSkills.tsx 组件当前缺失，应用已加载兼容页以保持设置面板可打开。
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
