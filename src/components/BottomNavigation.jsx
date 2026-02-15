import React from 'react';
import { useTranslation } from 'react-i18next';
import { getNavIcon } from '../utils/iconMap';
import Button from './ui/Button';
import Card from './ui/Card';

const TAB_IDS = ['inicio', 'rutas', 'colada', 'historia', 'mapa'];
const TAB_ICONS = { inicio: 'home', rutas: 'routes', colada: 'activities', historia: 'history', mapa: 'radar' };
const TAB_LABELS = { inicio: 'home', rutas: 'routes', colada: 'activities', historia: 'retro', mapa: 'radar' };

const BottomNavigation = ({ activeTab, onChange }) => {
    const { t } = useTranslation();
    
    const TabButton = ({ id, label }) => {
        const Icon = getNavIcon(TAB_ICONS[id]);
        const isActive = activeTab === id;

        return (
            <Button
                variant="ghost"
                onClick={() => onChange(id)}
                className="flex-1 relative group flex flex-col items-center justify-center py-2 rounded-xl outline-none"
            >
                {/* 1. LUZ AMBIENTAL (Sutil) */}
                <div className={`
                    absolute top-1 left-1/2 -translate-x-1/2 w-10 h-10 bg-primary/20 rounded-full blur-md transition-opacity duration-500
                    ${isActive ? 'opacity-100' : 'opacity-0'}
                `}></div>

                {/* 2. ICONO NEÓN */}
                <Icon
                    size={26}
                    strokeWidth={isActive ? 2.5 : 1.5}
                    className={`
                        relative z-10 mb-1 transition-all duration-300 ease-out
                        ${isActive
                            ? 'text-primary-light drop-shadow-[0_0_8px_rgba(96,165,250,0.8)] scale-110'
                            : 'text-slate-500 group-hover:text-slate-300 scale-100'
                        }
                    `}
                />

                {/* 3. ETIQUETA */}
                <span className={`
                    relative z-10 text-xxxs font-bold uppercase tracking-widest transition-all duration-300
                    ${isActive ? 'text-primary-light opacity-100' : 'text-slate-500 opacity-70'}
                `}>
                    {label}
                </span>
            </Button>
        );
    };

    return (
        <div className="shrink-0 px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {/* En flujo del documento, pegada abajo por flex; safe area para iPhone */}
            <Card variant="default" padding="sm" className="rounded-2xl border-slate-700/50 flex justify-between shadow-2xl shadow-black/40 px-4 py-2">
                {TAB_IDS.map(id => (
                    <TabButton key={id} id={id} label={t(`tabs.${TAB_LABELS[id]}`)} />
                ))}
            </Card>
        </div>
    );
};

export default BottomNavigation;