import React from 'react';
import { MapPin } from 'lucide-react';
import Button from './ui/Button';
import Card from './ui/Card';

const LocationSelector = ({ candidates, onSelect, onCancel, title }) => {
    return (
        <Card variant="default" padding="none" className="absolute top-full left-0 right-0 mt-2 rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in max-h-60 overflow-y-auto custom-scrollbar">
            <div className="p-2 bg-slate-900/90 text-xs font-bold text-slate-400 sticky top-0 border-b border-slate-700">
                {title || "¿Cuál de estos lugares es?"}
            </div>
            {candidates.map((cand, idx) => (
                <Button
                    key={idx}
                    variant="ghost"
                    onClick={() => onSelect(cand)}
                    className="w-full text-left p-3 rounded-none border-b border-slate-700/50 last:border-0 flex items-start gap-3 group"
                >
                    <MapPin className="w-4 h-4 text-slate-500 mt-0.5 group-hover:text-blue-400 shrink-0" />
                    <div className="flex-grow">
                        <div className="flex justify-between items-baseline">
                            <div className="text-sm font-bold text-slate-200 group-hover:text-white leading-tight mb-0.5">{cand.displayName}</div>
                            {cand.distanceText && <div className="text-[9px] font-bold text-emerald-400 ml-2 whitespace-nowrap">{cand.distanceText}</div>}
                        </div>
                        <div className="text-xs text-slate-400 line-clamp-2">{cand.details}</div>
                    </div>
                </Button>
            ))}
            <Button variant="ghost" size="md" onClick={onCancel} className="w-full p-2 bg-slate-900 hover:bg-slate-800 text-xs text-danger font-bold border-t border-slate-700 sticky bottom-0 rounded-none">
                Cancelar
            </Button>
        </Card>
    );
};

export default LocationSelector;