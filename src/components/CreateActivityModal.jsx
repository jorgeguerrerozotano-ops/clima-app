import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Thermometer, Wind, CloudRain, Clock } from 'lucide-react';
import { AVAILABLE_ICONS } from '../utils/activitiesConfig';

const CreateActivityModal = ({ onClose, onSave, initialData }) => {
    const { t } = useTranslation();
    const [name, setName] = useState('');
    const [selectedIcon, setSelectedIcon] = useState('star');
    const [tempMin, setTempMin] = useState(10);
    const [tempMax, setTempMax] = useState(25);
    const [rainOption, setRainOption] = useState(1);
    const [windOption, setWindOption] = useState(1);
    const [checkWetFloor, setCheckWetFloor] = useState(false);
    const [duration, setDuration] = useState(60);
    const [showIconSelector, setShowIconSelector] = useState(false);

    useEffect(() => {
        if (initialData) {
            setName(initialData.label);
            setSelectedIcon(initialData.icon);
            setDuration(initialData.duration);
            const r = initialData.rules;
            setTempMin(r.tempMin ?? 10);
            setTempMax(r.tempMax ?? 25);
            setCheckWetFloor(!!r.checkWetFloor);
            if (r.rainPreference === 'strict' || (r.rainMax != null && r.rainMax <= 0.1)) setRainOption(0);
            else if (r.rainPreference === 'flexible' || (r.rainMax != null && r.rainMax <= 0.5)) setRainOption(1);
            else setRainOption(2);
            if (r.windMax <= 15) setWindOption(0);
            else if (r.windMax <= 30) setWindOption(1);
            else setWindOption(2);
        }
    }, [initialData]);

    const handleSave = () => {
        if (!name.trim()) return;
        const rainMax = rainOption === 0 ? 0.1 : rainOption === 2 ? 2.5 : 0.5;
        const rainPreference = rainOption === 0 ? 'strict' : rainOption === 1 ? 'flexible' : 'any';
        const windMax = windOption === 0 ? 15 : windOption === 2 ? 50 : 30;
        const hours = duration / 60;
        const durationTxt = Number.isInteger(hours) ? `${hours} h` : `${hours.toFixed(1)} h`;
        onSave({
            id: initialData?.id ?? Date.now().toString(),
            label: name,
            durationLabel: `(Duración: ${durationTxt})`,
            icon: selectedIcon,
            duration: Number(duration),
            rules: {
                mode: 'standard',
                rainMax,
                rainPreference,
                windMax,
                tempMin: Number(tempMin),
                tempMax: Number(tempMax),
                checkWetFloor,
            },
        });
    };

    const CurrentIcon = AVAILABLE_ICONS[selectedIcon] || AVAILABLE_ICONS['star'];

    // Selector de iconos (vista compacta)
    if (showIconSelector) {
        return (
            <div className="w-full bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
                <div className="px-3 py-2 border-b border-slate-800 flex items-center gap-2 shrink-0">
                    <button onClick={() => setShowIconSelector(false)} className="flex items-center gap-1 text-blue-500 text-xs font-bold py-1.5 px-2 hover:bg-slate-800 rounded-lg">
                        <ArrowLeft size={16} /> {t('common.back')}
                    </button>
                    <span className="text-xs font-bold text-white">{t('common.icon')}</span>
                </div>
                <div className="p-3 max-h-[240px] overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-5 gap-2">
                        {Object.entries(AVAILABLE_ICONS).map(([key, IconComponent]) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => { setSelectedIcon(key); setShowIconSelector(false); }}
                                className={`aspect-square flex items-center justify-center rounded-xl border transition-all ${selectedIcon === key ? 'bg-blue-900/40 border-blue-500 text-blue-400' : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-600'}`}
                            >
                                <IconComponent size={22} strokeWidth={2} />
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            {/* Header fijo */}
            <div className="px-3 py-2.5 border-b border-slate-800 flex justify-between items-center shrink-0">
                <button onClick={onClose} className="text-slate-400 text-xs font-bold py-1.5 px-2 hover:bg-slate-800 rounded-lg">
                    {t('common.cancel')}
                </button>
                <h2 className="text-sm font-bold text-white">{initialData ? t('activities.editActivity') : t('activities.createActivity')}</h2>
                <div className="w-14" />
            </div>

            {/* Contenido único con scroll */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                <div className="flex gap-3 items-center">
                    <button
                        type="button"
                        onClick={() => setShowIconSelector(true)}
                        className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-blue-400 shrink-0 hover:border-blue-500"
                    >
                        <CurrentIcon size={24} strokeWidth={2} />
                    </button>
                    <div className="flex-1 min-w-0">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">{t('common.name')}</label>
                        <input
                            type="text"
                            placeholder={t('activities.exampleName')}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-transparent border-b border-slate-700 py-1.5 text-white placeholder-slate-600 focus:border-blue-500 outline-none font-bold text-base"
                        />
                    </div>
                </div>
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-1.5 text-slate-400">
                            <Clock size={14} className="text-purple-400" />
                            <span className="text-[10px] font-bold uppercase">{t('common.duration')}</span>
                        </div>
                        <span className="text-sm font-bold text-white">{duration < 60 ? `${duration} min` : `${(duration / 60).toFixed(1)} h`}</span>
                    </div>
                    <input
                        type="range"
                        min="30"
                        max="720"
                        step="30"
                        value={duration}
                        onChange={(e) => setDuration(Number(e.target.value))}
                        className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:rounded-full"
                    />
                </div>
                <div>
                    <div className="flex items-center gap-1.5 mb-2 text-slate-400">
                        <Thermometer size={14} className="text-orange-400" />
                        <span className="text-[10px] font-bold uppercase">{t('activities.idealTemp')}</span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-bold text-blue-400 w-8">{tempMin}°</span>
                        <input type="range" min="-10" max="40" value={tempMin} onChange={e => setTempMin(Math.min(Number(e.target.value), tempMax - 1))} className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full" />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-orange-400 w-8">{tempMax}°</span>
                        <input type="range" min="-10" max="40" value={tempMax} onChange={e => setTempMax(Math.max(Number(e.target.value), tempMin + 1))} className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-orange-500 [&::-webkit-slider-thumb]:rounded-full" />
                    </div>
                </div>
                <div>
                    <div className="flex items-center gap-1.5 mb-2 text-slate-400">
                        <CloudRain size={14} className="text-blue-400" />
                        <span className="text-[10px] font-bold uppercase">{t('activities.rain')}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                        {[{ label: t('activities.none'), val: 0 }, { label: t('weather.drizzle'), val: 1 }, { label: t('activities.rain'), val: 2 }].map((opt, idx) => (
                            <button key={idx} type="button" onClick={() => setRainOption(opt.val)} className={`py-2 rounded-lg border text-[10px] font-bold transition-all ${rainOption === opt.val ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                                {opt.label}
                            </button>
                        ))}
                    </div>
                    <button type="button" onClick={() => setCheckWetFloor(!checkWetFloor)} className={`w-full mt-2 flex items-center justify-between py-2.5 px-3 rounded-lg border text-[10px] font-bold transition-all ${checkWetFloor ? 'bg-blue-900/20 border-blue-500/50 text-blue-300' : 'bg-slate-800/40 border-slate-700 text-slate-400'}`}>
                        {t('activities.avoidWetFloor')}
                        <div className={`w-7 h-3.5 rounded-full relative ${checkWetFloor ? 'bg-blue-500' : 'bg-slate-700'}`}>
                            <div className={`absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full transition-all ${checkWetFloor ? 'left-3.5' : 'left-0.5'}`} />
                        </div>
                    </button>
                </div>
                <div>
                    <div className="flex items-center gap-1.5 mb-2 text-slate-400">
                        <Wind size={14} className="text-emerald-400" />
                        <span className="text-[10px] font-bold uppercase">{t('activities.wind')}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                        {[{ label: t('activities.calm'), val: 0 }, { label: t('activities.normal'), val: 1 }, { label: t('activities.windy'), val: 2 }].map((opt, idx) => (
                            <button key={idx} type="button" onClick={() => setWindOption(opt.val)} className={`py-2 rounded-lg border text-[10px] font-bold transition-all ${windOption === opt.val ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Footer fijo */}
            <div className="p-3 border-t border-slate-800 bg-slate-900 shrink-0">
                <button onClick={handleSave} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl text-sm active:scale-[0.98] transition-all">
                    {t('activities.saveActivity')}
                </button>
            </div>
        </div>
    );
};

export default CreateActivityModal;
