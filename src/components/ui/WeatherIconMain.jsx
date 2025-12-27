import React from 'react';
// Importamos el set "Wi" (Weather Icons) de react-icons
import { 
    WiDaySunny, WiNightClear, WiDayCloudy, WiNightAltCloudy, WiCloud, WiCloudy,
    WiFog, WiDaySprinkle, WiNightAltSprinkle, WiRain, WiRainWind,
    WiDaySnow, WiNightAltSnow, WiSnowWind, WiThunderstorm, WiDayThunderstorm,
    WiNightAltThunderstorm, WiSleet
} from 'react-icons/wi';

const WeatherIconMain = ({ code, isDay = 1, temp = 20, className = "w-32 h-32" }) => {

    const getIcon = () => {
        switch (code) {
            case 0: // DESPEJADO
                if (isDay) {
                    // --- LÓGICA DE SOL DE HIELO ---
                    if (temp <= 0) {
                        // Sol Blanco/Cian (Hielo)
                        return { icon: WiDaySunny, color: "text-cyan-50 drop-shadow-[0_0_20px_rgba(34,211,238,0.9)]" }; 
                    } else if (temp < 10) {
                        // Sol Pálido (Fresco)
                        return { icon: WiDaySunny, color: "text-yellow-100 drop-shadow-[0_0_15px_rgba(253,224,71,0.6)]" }; 
                    }
                    // Sol Ámbar (Cálido/Estándar)
                    return { icon: WiDaySunny, color: "text-amber-400 drop-shadow-[0_0_15px_rgba(251,191,36,0.6)]" };
                } else {
                    // Luna Helada vs Luna Normal
                    if (temp <= 0) {
                        return { icon: WiNightClear, color: "text-cyan-100 drop-shadow-[0_0_15px_rgba(103,232,249,0.6)]" };
                    }
                    return { icon: WiNightClear, color: "text-slate-300 drop-shadow-[0_0_10px_rgba(148,163,184,0.4)]" };
                }

            case 1: 
            case 2: // NUBES DISPERSAS
                if (isDay) {
                    if (temp <= 0) return { icon: WiDayCloudy, color: "text-cyan-100" }; // Nube fría
                    return { icon: WiDayCloudy, color: "text-amber-200" };
                }
                return { icon: WiNightAltCloudy, color: "text-slate-400" };

            case 3: return { icon: WiCloudy, color: "text-slate-300" };
            case 45:
            case 48: return { icon: WiFog, color: "text-slate-400 opacity-80" };
            
            case 51:
            case 53:
            case 55: return isDay ? 
                { icon: WiDaySprinkle, color: "text-blue-300" } : 
                { icon: WiNightAltSprinkle, color: "text-blue-300" };
            
            case 56:
            case 57: return { icon: WiSleet, color: "text-cyan-200" };
            
            case 61: 
            case 63: return { icon: WiRain, color: "text-blue-400" };
            case 65: return { icon: WiRainWind, color: "text-blue-500 drop-shadow-[0_0_10px_rgba(59,130,246,0.4)]" };
            
            case 66:
            case 67: return { icon: WiSleet, color: "text-cyan-200" };
            
            case 71:
            case 73:
            case 75: 
            case 77: return isDay ? 
                { icon: WiDaySnow, color: "text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.6)]" } : 
                { icon: WiNightAltSnow, color: "text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]" };
            
            case 80:
            case 81:
            case 82: return { icon: WiRainWind, color: "text-blue-500" };
            
            case 85:
            case 86: return { icon: WiSnowWind, color: "text-white" };
            
            case 95: return { icon: WiThunderstorm, color: "text-purple-400 drop-shadow-[0_0_15px_rgba(192,132,252,0.5)]" };
            case 96:
            case 99: return isDay ? 
                { icon: WiDayThunderstorm, color: "text-purple-500" } : 
                { icon: WiNightAltThunderstorm, color: "text-purple-500" };
            
            default: return isDay ? { icon: WiDaySunny, color: "text-amber-400" } : { icon: WiNightClear, color: "text-slate-300" };
        }
    };

    const { icon: Icon, color } = getIcon();

    return (
        <div className={`${className} flex items-center justify-center animate-fade-in transform scale-125 origin-center`}>
            <div className="animate-[float_6s_ease-in-out_infinite] w-full h-full flex items-center justify-center">
                <Icon size="100%" className={`${color} transition-colors duration-1000`} />
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