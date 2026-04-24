import type { ProviderConfig } from '@shared/types';
import { PROVIDER_ICONS } from '@/lib/providerIcons';

interface ProviderIconProps {
  provider: Pick<ProviderConfig, 'id' | 'name' | 'icon' | 'iconBg'>;
  size?: number;
}

export function ProviderIcon({ provider, size = 28 }: ProviderIconProps) {
  const { id, icon, iconBg, name } = provider;
  const bg = iconBg || '#6b7280';
  const letter = (name || '?').trim().charAt(0).toUpperCase();
  const resolvedIcon = icon || PROVIDER_ICONS[id] || null;

  if (resolvedIcon) {
    return (
      <img
        src={resolvedIcon}
        alt={name}
        style={{ width: size, height: size }}
        className="shrink-0 rounded-full object-cover"
      />
    );
  }

  return (
    <div
      style={{ width: size, height: size, background: bg }}
      className="flex shrink-0 items-center justify-center rounded-full text-[13px] font-medium text-white"
    >
      {letter}
    </div>
  );
}
