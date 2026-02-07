import React from 'react';
import { getWeatherIcon } from '../../utils/iconMap';

/**
 * Icono meteorológico principal.
 * Estilo monocromático (Apple Weather): blanco/slate-200 sobre fondo oscuro.
 * Sin variación de color por temperatura.
 */
const WeatherIconMain = ({ code, isDay = 1, className = "w-32 h-32" }) => {
    const Icon = getWeatherIcon(code, !!isDay);

    return (
        <div className={`${className} flex items-center justify-center animate-fade-in origin-center`}>
            <div className="animate-[float_6s_ease-in-out_infinite] w-full h-full flex items-center justify-center">
                <Icon 
                    size="100%" 
                    className="text-slate-200 transition-colors duration-300" 
                    strokeWidth={1.5}
                />
            </div>
            <style>{`
                @keyframes float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-6px); }
                }
            `}</style>
        </div>
    );
};

export default WeatherIconMain;
