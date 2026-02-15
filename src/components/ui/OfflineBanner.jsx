import React from 'react';
import { useTranslation } from 'react-i18next';
import { WifiOff } from 'lucide-react';

/**
 * Banner fijo que se muestra cuando el usuario está offline.
 * Estilo "warning", posicionado en la parte superior para no tapar la navegación inferior.
 */
export default function OfflineBanner() {
  const { t } = useTranslation();

  return (
    <div
      role="status"
      aria-live="polite"
      className="shrink-0 flex items-center justify-center gap-2 py-2 px-4 bg-amber-500/90 text-slate-900 font-bold text-sm border-b border-amber-600/50"
    >
      <WifiOff size={18} className="shrink-0" aria-hidden />
      <span>{t('errors.offline')}</span>
    </div>
  );
}
