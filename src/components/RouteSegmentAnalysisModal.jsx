// src/components/RouteSegmentAnalysisModal.jsx
// Modal que muestra el análisis completo de un segmento de ruta con todos los factores

import React from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import FactorCard from './ui/FactorCard';

const RouteSegmentAnalysisModal = ({ segment, onClose }) => {
    const { t } = useTranslation();
    if (!segment) return null;

    const sortedFactors = segment.sortedFactors ?? [];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl relative max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute right-4 top-4 p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white z-10">
                    <X size={20} />
                </button>
                <div className="p-5 pb-4 border-b border-white/10">
                    <h3 className="text-lg font-bold text-white pr-10">
                        {segment.name} • {segment.time}
                    </h3>
                    <p className="text-sm font-bold uppercase tracking-widest mt-1 opacity-90">{segment.message}</p>
                </div>
                <div className="p-5 overflow-y-auto flex-1">
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
            </div>
        </div>
    );
};

export default RouteSegmentAnalysisModal;
