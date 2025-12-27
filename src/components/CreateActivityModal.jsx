import React, { useState, useEffect } from 'react';
import { ArrowLeft, Thermometer, Wind, CloudRain, Clock } from 'lucide-react';
import { AVAILABLE_ICONS } from '../utils/activitiesConfig';

// NOTA: AUNQUE SE LLAMA "MODAL" POR EL NOMBRE DEL ARCHIVO, AHORA ES UN FORMULARIO INLINE
const CreateActivityModal = ({ onClose, onSave, initialData }) => {
    // --- ESTADOS ---
    const [name, setName] = useState('');
    const [selectedIcon, setSelectedIcon] = useState('star');
    
    // Configuración Clima
    const [tempMin, setTempMin] = useState(10);
    const [tempMax, setTempMax] = useState(25);
    const [rainOption, setRainOption] = useState(1);
    const [windOption, setWindOption] = useState(1); 
    const [checkWetFloor, setCheckWetFloor] = useState(false);

    const [duration, setDuration] = useState(60);
    const [showIconSelector, setShowIconSelector] = useState(false);

    // --- CARGAR DATOS ---
    useEffect(() => {
        if (initialData) {
            setName(initialData.label);
            setSelectedIcon(initialData.icon);
            setDuration(initialData.duration);
            
            const r = initialData.rules;
            setTempMin(r.tempMin ?? 10);
            setTempMax(r.tempMax ?? 25);
            setCheckWetFloor(!!r.checkWetFloor);
            
            if (r.rainMax <= 0.1) setRainOption(0);
            else if (r.rainMax <= 0.5) setRainOption(1);
            else setRainOption(2);

            if (r.windMax <= 15) setWindOption(0);
            else if (r.windMax <= 30) setWindOption(1);
            else setWindOption(2);
        }
    }, [initialData]);

    const handleSave = () => {
        if (!name.trim()) return;

        // Mapeo Lluvia
        let rainMax = 0.5;
        if (rainOption === 0) rainMax = 0.1; 
        if (rainOption === 2) rainMax = 2.5;

        // Mapeo Viento
        let windMax = 30; 
        if (windOption === 0) windMax = 15; 
        if (windOption === 2) windMax = 50; 

        const rules = {
            mode: 'standard',
            rainMax: rainMax,
            windMax: windMax,
            tempMin: parseInt(tempMin),
            tempMax: parseInt(tempMax),
            checkWetFloor: checkWetFloor
        };

        const hours = duration / 60;
        const durationTxt = Number.isInteger(hours) ? `${hours} h` : `${hours.toFixed(1)} h`;

        const activityData = {
            id: initialData ? initialData.id : Date.now().toString(), 
            label: name,
            durationLabel: `(Duración: ${durationTxt})`,
            icon: selectedIcon,
            duration: parseInt(duration),
            rules: rules
        };

        onSave(activityData);
        // onClose se llama desde el padre después de guardar
    };

    const CurrentIcon = AVAILABLE_ICONS[selectedIcon] || AVAILABLE_ICONS['star'];

    // ESTRUCTURA INLINE: SIN FIXED, SIN BACKDROP
    return (
        <div className="w-full bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl relative flex flex-col transition-all">
            
            {/* --- MODO SELECTOR DE ICONOS --- */}
            {showIconSelector ? (
                <>
                    <div className="px-4 py-3 border-b border-slate-800 bg-slate-900 flex items-center gap-3 shrink-0">
                        <button onClick={() => setShowIconSelector(false)} className="flex items-center gap-1 text-blue-500 font-bold active:opacity-70 hover:bg-slate-800 rounded-lg px-2 py-1 -ml-2 transition-colors">
                            <ArrowLeft size={20}/> Volver
                        </button>
                        <h2 className="text-sm font-bold text-white">Galería</h2>
                    </div>
                    
                    {/* Altura máxima para el selector de iconos para que no sea infinito */}
                    <div className="p-4 bg-slate-900 max-h-[400px] overflow-y-auto custom-scrollbar">
                        <div className="grid grid-cols-4 gap-3">
                            {Object.entries(AVAILABLE_ICONS).map(([key, IconComponent]) => {
                                const isSelected = selectedIcon === key;
                                return (
                                    <button 
                                        key={key}
                                        onClick={() => { setSelectedIcon(key); setShowIconSelector(false); }}
                                        className={`aspect-square flex flex-col items-center justify-center rounded-xl border transition-all ${isSelected ? 'bg-blue-900/30 border-blue-500 text-blue-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}
                                    >
                                        <IconComponent size={24} weight="duotone" className="mb-1" />
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </>
            ) : (
                /* --- MODO FORMULARIO PRINCIPAL --- */
                <>
                    {/* HEADER */}
                    <div className="px-4 py-3 border-b border-slate-800 bg-slate-900 flex justify-between items-center shrink-0">
                        <button onClick={onClose} className="text-slate-400 text-xs font-bold px-2 py-1 hover:bg-slate-800 rounded-lg transition-colors">Cancelar</button>
                        <h2 className="text-sm font-bold text-white">{initialData ? 'Editar Plan' : 'Nuevo Plan'}</h2>
                        <div className="w-12"></div>
                    </div>

                    {/* BODY (SIN SCROLL INTERNO, CRECE NATURALMENTE) */}
                    <div className="p-5 space-y-6 bg-slate-900">
                        
                        {/* Input Nombre */}
                        <div className="flex gap-4 items-center">
                            <button onClick={() => setShowIconSelector(true)} className="w-14 h-14 bg-slate-800 rounded-xl border border-slate-700 flex items-center justify-center text-blue-400 shrink-0 hover:border-blue-500 transition-colors">
                                <CurrentIcon size={28} weight="duotone" />
                            </button>
                            <div className="flex-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Nombre</label>
                                <input 
                                    type="text" placeholder="Ej: Paseo al perro" 
                                    value={name} onChange={(e) => setName(e.target.value)} 
                                    className="w-full bg-transparent border-b border-slate-700 py-1 text-white placeholder-slate-600 focus:border-blue-500 outline-none font-bold text-lg transition-colors" 
                                />
                            </div>
                        </div>

                        {/* Temperatura */}
                        <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
                            <div className="flex items-center gap-2 mb-4 text-slate-300">
                                <Thermometer size={14} className="text-orange-400" />
                                <span className="text-xs font-bold">Zona de Confort (Ideal)</span>
                            </div>
                            <div className="flex justify-between items-center mb-4 px-2">
                                <span className="text-xl font-bold text-blue-400">{tempMin}°</span>
                                <div className="h-1 bg-gradient-to-r from-blue-500/30 to-orange-500/30 flex-1 mx-4 rounded-full"></div>
                                <span className="text-xl font-bold text-orange-400">{tempMax}°</span>
                            </div>
                            <div className="space-y-4">
                                <input type="range" min="-10" max="40" value={tempMin} onChange={e => setTempMin(Math.min(parseInt(e.target.value), tempMax - 1))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full" />
                                <input type="range" min="-10" max="40" value={tempMax} onChange={e => setTempMax(Math.max(parseInt(e.target.value), tempMin + 1))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-orange-500 [&::-webkit-slider-thumb]:rounded-full" />
                            </div>
                        </div>

                        {/* Lluvia */}
                        <div>
                            <div className="flex items-center gap-2 mb-2 text-slate-300">
                                <CloudRain size={14} className="text-blue-400" />
                                <span className="text-xs font-bold">Tolerancia a Lluvia</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { label: 'NADA', val: 0 },
                                    { label: 'LLOVIZNA', val: 1 },
                                    { label: 'LLUVIA', val: 2 }
                                ].map((opt, idx) => (
                                    <button 
                                        key={idx} onClick={() => setRainOption(idx)} 
                                        className={`py-3 rounded-lg border transition-all ${rainOption === idx ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-700'}`}
                                    >
                                        <span className="text-[10px] font-bold">{opt.label}</span>
                                    </button>
                                ))}
                            </div>
                            <button onClick={() => setCheckWetFloor(!checkWetFloor)} className={`w-full mt-2 flex items-center justify-between p-3 rounded-lg border transition-all ${checkWetFloor ? 'bg-blue-900/20 border-blue-500/50' : 'bg-slate-800/30 border-slate-700/50'}`}>
                                <span className={`text-[10px] font-bold ${checkWetFloor ? 'text-blue-300' : 'text-slate-400'}`}>Evitar suelo mojado</span>
                                <div className={`w-8 h-4 rounded-full relative transition-colors ${checkWetFloor ? 'bg-blue-500' : 'bg-slate-700'}`}>
                                    <div className={`w-2 h-2 bg-white rounded-full absolute top-1 transition-all ${checkWetFloor ? 'left-5' : 'left-1'}`}></div>
                                </div>
                            </button>
                        </div>

                        {/* Viento */}
                        <div>
                            <div className="flex items-center gap-2 mb-2 text-slate-300">
                                <Wind size={14} className="text-emerald-400" />
                                <span className="text-xs font-bold">Tolerancia al Viento</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { label: 'CALMA', val: 0 },
                                    { label: 'NORMAL', val: 1 },
                                    { label: 'VENTOSO', val: 2 }
                                ].map((opt, idx) => (
                                    <button 
                                        key={idx} onClick={() => setWindOption(idx)} 
                                        className={`py-3 rounded-lg border transition-all ${windOption === idx ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-700'}`}
                                    >
                                        <span className="text-[10px] font-bold">{opt.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Duración */}
                        <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-700/50">
                            <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-2 text-slate-300">
                                    <Clock size={14} className="text-purple-400" />
                                    <span className="text-xs font-bold">Duración</span>
                                </div>
                                <span className="text-sm font-black text-white">{duration < 60 ? duration + ' min' : (duration/60).toFixed(1) + ' h'}</span>
                            </div>
                            <input type="range" min="30" max="720" step="30" value={duration} onChange={(e) => setDuration(e.target.value)} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:rounded-full" />
                        </div>
                    </div>

                    {/* FOOTER */}
                    <div className="p-4 border-t border-slate-800 bg-slate-900">
                        <button 
                            onClick={handleSave} 
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl shadow-lg active:scale-95 transition-all text-sm"
                        >
                            Guardar Plan
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default CreateActivityModal;