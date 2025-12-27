import React from 'react';
// Importamos Phosphor Icons
import { Sun, CalendarCheck, Path, ClockCounterClockwise, CloudRain } from '@phosphor-icons/react';

const BottomNavigation = ({ activeTab, onChange }) => {
    
    const TabButton = ({ id, icon: Icon, label }) => {
        const isActive = activeTab === id;

        return (
            <button 
                onClick={() => onChange(id)} 
                // Sin rebotes (fixed height/padding), sin transformaciones de posición
                className="flex-1 relative group flex flex-col items-center justify-center py-2 rounded-xl outline-none"
            >
                {/* 1. LUZ AMBIENTAL (Sutil) */}
                <div className={`
                    absolute top-1 left-1/2 -translate-x-1/2 w-10 h-10 bg-blue-500/20 rounded-full blur-md transition-opacity duration-500
                    ${isActive ? 'opacity-100' : 'opacity-0'}
                `}></div>

                {/* 2. ICONO NEÓN */}
                <Icon 
                    size={26}
                    weight={isActive ? "duotone" : "regular"} 
                    className={`
                        relative z-10 mb-1 transition-all duration-300 ease-out
                        ${isActive 
                            // ESTADO ACTIVO: Azul corporativo, brillo nítido, ligero aumento
                            ? 'text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.8)] scale-110' 
                            // ESTADO INACTIVO: Gris estándar que se ilumina un poco al pasar el ratón
                            : 'text-slate-500 group-hover:text-slate-300 scale-100'
                        }
                    `} 
                />
                
                {/* 3. ETIQUETA */}
                <span className={`
                    relative z-10 text-[9px] font-bold uppercase tracking-widest transition-all duration-300
                    ${isActive ? 'text-blue-300 opacity-100' : 'text-slate-500 opacity-70'}
                `}>
                    {label}
                </span>
            </button>
        );
    };

    return (
        <div className="fixed bottom-4 left-4 right-4 max-w-lg mx-auto z-50">
            {/* CONTENEDOR 'GLASS' INTEGRADO 
               - bg-slate-900/90: Mismo color base que la app, alta opacidad para leerse bien.
               - backdrop-blur-xl: Mantiene el efecto cristal premium.
               - border-slate-700/50: Borde suave que coincide con el resto de paneles.
            */}
            <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-2 flex justify-between shadow-2xl shadow-black/40">
                <TabButton id="inicio" icon={Sun} label="Inicio" />
                <TabButton id="rutas" icon={Path} label="Rutas" />
                <TabButton id="colada" icon={CalendarCheck} label="Planes" />
                <TabButton id="historia" icon={ClockCounterClockwise} label="Retro" />
                <TabButton id="mapa" icon={CloudRain} label="Radar" />
            </div>
        </div>
    );
};

export default BottomNavigation;