import React from 'react';
import { MapPin } from 'lucide-react';

const LocationSelector = ({ candidates, onSelect, onCancel, title }) => {
    return (
        <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in max-h-60 overflow-y-auto custom-scrollbar">
            <div className="p-2 bg-slate-900/90 text-xs font-bold text-slate-400 sticky top-0 border-b border-slate-700">
                {title || "¿Cuál de estos lugares es?"}
            </div>
            {candidates.map((cand, idx) => (
                <button 
                    key={idx} 
                    onClick={() => onSelect(cand)}
                    className="w-full text-left p-3 hover:bg-slate-700 border-b border-slate-700/50 last:border-0 transition-colors flex items-start gap-3 group"
                >
                    <MapPin className="w-4 h-4 text-slate-500 mt-0.5 group-hover:text-blue-400 shrink-0" />
                    <div className="flex-grow">
                        <div className="flex justify-between items-baseline">
                            <div className="text-sm font-bold text-slate-200 group-hover:text-white leading-tight mb-0.5">{cand.displayName}</div>
                            {cand.distanceText && <div className="text-[9px] font-bold text-emerald-400 ml-2 whitespace-nowrap">{cand.distanceText}</div>}
                        </div>
                        <div className="text-[10px] text-slate-400 line-clamp-2">{cand.details}</div>
                    </div>
                </button>
            ))}
            <button onClick={onCancel} className="w-full p-2 bg-slate-900 hover:bg-slate-800 text-xs text-red-400 font-bold border-t border-slate-700 sticky bottom-0">
                Cancelar
            </button>
        </div>
    );
};

export default LocationSelector;