// Modal que muestra el análisis completo de una actividad con todos los factores (misma lógica que Rutas)

import React, { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import Button from './ui/Button';
import Card from './ui/Card';
import FactorCard from './ui/FactorCard';
import { getActivityDisplayLabel, getActivityDurationLabel } from '../utils/activitiesConfig';

const ActivityAnalysisModal = forwardRef(({ activity, result, onClose }, ref) => {
    const { t } = useTranslation();
    if (!activity || !result) return null;

    const sortedFactors = result.sortedFactors ?? [];
    const title = `${getActivityDisplayLabel(activity)} ${getActivityDurationLabel(activity)}`;

    const handleBackdropKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClose();
        }
    };

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
            onClick={onClose}
            role="button"
            tabIndex={0}
            aria-label={t('common.close')}
            onKeyDown={handleBackdropKeyDown}
        >
            <Card ref={ref} variant="default" padding="none" className="w-full max-w-md relative max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <Button variant="ghost" size="iconLg" onClick={onClose} className="absolute right-4 top-4 p-2 rounded-full z-10" title={t('common.close')} aria-label={t('common.close')}>
                    <X size={20} />
                </Button>
                <div className="p-5 pb-4 border-b border-white/10">
                    <h3 className="text-lg font-bold text-white pr-10">{title}</h3>
                    <p className="text-sm font-bold uppercase tracking-widest mt-1 opacity-90">{result.message}</p>
                </div>
                <div className="p-5 overflow-y-auto flex-1">
                    <p className="text-xs text-slate-400 uppercase font-bold mb-3">{t('activities.forecast')}</p>
                    <div className="space-y-2">
                        {sortedFactors.length === 0 ? (
                            <p className="text-sm text-slate-500 italic">{t('activities.infoUnavailable')}</p>
                        ) : (
                            sortedFactors.map((f, i) => (
                                <FactorCard key={i} factor={f} size="sm" showLabel={true} showDescription={true} layout="row" />
                            ))
                        )}
                    </div>
                </div>
            </Card>
        </div>
    );
});

ActivityAnalysisModal.displayName = 'ActivityAnalysisModal';

export default ActivityAnalysisModal;
