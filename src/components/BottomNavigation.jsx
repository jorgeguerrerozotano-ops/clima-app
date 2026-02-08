import React from 'react';
import { useTranslation } from 'react-i18next';
import { getNavIcon } from '../utils/iconMap';

const TAB_IDS = ['inicio', 'rutas', 'colada', 'historia', 'mapa'];
const TAB_ICONS = { inicio: 'home', rutas: 'routes', colada: 'activities', historia: 'history', mapa: 'radar' };
const TAB_LABELS = { inicio: 'home', rutas: 'routes', colada: 'activities', historia: 'retro', mapa: 'radar' };

const BottomNavigation = ({ activeTab, onChange }) => {
    const { t } = useTranslation();
    
    const TabButton = ({ id, label }) => {
        const Icon = getNavIcon(TAB_ICONS[id]);
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
                    strokeWidth={isActive ? 2.5 : 1.5}
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
        <div className="shrink-0 px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {/* En flujo del documento, pegada abajo por flex; safe area para iPhone */}
            <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-2 flex justify-between shadow-2xl shadow-black/40">
                {TAB_IDS.map(id => (
                    <TabButton key={id} id={id} label={t(`tabs.${TAB_LABELS[id]}`)} />
                ))}
            </div>
        </div>
    );
};

export default BottomNavigation;