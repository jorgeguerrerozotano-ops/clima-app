// src/components/RouteSegmentAnalysisModal.jsx
// Modal que muestra el análisis completo de un segmento de ruta con todos los factores

import React from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import Button from './ui/Button';
import Card from './ui/Card';
import FactorCard from './ui/FactorCard';

const RouteSegmentAnalysisModal = ({ segment, onClose }) => {
    const { t } = useTranslation();
    if (!segment) return null;

    const sortedFactors = segment.sortedFactors ?? [];

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
            <Card variant="default" padding="none" className="w-full max-w-md relative max-h-[85dvh] flex flex-col" onClick={e => e.stopPropagation()}>
                <Button variant="ghost" size="iconLg" onClick={onClose} className="absolute right-4 top-4 p-2 rounded-full z-10" title={t('common.close')} aria-label={t('common.close')}>
                    <X size={20} />
                </Button>
                <div className="p-5 pb-4 border-b border-white/10">
                    <h3 className="text-lg font-bold text-white pr-10">
                        {segment.name} • {segment.time}
                    </h3>
                    <p className="text-sm font-bold uppercase tracking-widest mt-1 opacity-90">{segment.message}</p>
                </div>
                <div className="px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] overflow-y-auto flex-1">
                    <p className="text-xs text-slate-400 uppercase font-bold mb-3">{t('routes.report')}</p>
                    <div className="space-y-2">
                        {sortedFactors.length === 0 ? (
                            <p className="text-sm text-slate-500 italic">{t('routes.noDataShort')}</p>
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
};

export default RouteSegmentAnalysisModal;
