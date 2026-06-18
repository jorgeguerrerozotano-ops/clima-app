import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Sun, Moon } from 'lucide-react';
import HomeSummary from '../components/HomeSummary';
import WeeklyForecast from '../components/WeeklyForecast';
import PrecipitationAlert from '../components/PrecipitationAlert';
import { getWeatherInfo, getSafeWeatherData } from '../utils/helpers';
import WeatherIconMain from '../components/ui/WeatherIconMain';
import { useInterpolatedTemperature } from '../hooks/useInterpolatedTemperature';
import { getWeatherIcon } from '../utils/iconMap';

const HomeView = ({ weatherData, favorites, customActivities = [], onSelectActivity, onGoToActivities }) => {
    const { t, i18n } = useTranslation();
    const [localTime, setLocalTime] = useState('');
    const { temp, feelsLike } = useInterpolatedTemperature(weatherData);

    useEffect(() => {
        if (weatherData && weatherData.timezone) {
            const updateTime = () => {
                try {
                    const timeStr = new Date().toLocaleTimeString(i18n.language, {
                        timeZone: weatherData.timezone,
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    setLocalTime(timeStr);
                } catch (e) { setLocalTime(''); }
            };
            updateTime();
            const interval = setInterval(updateTime, 60000);
            return () => clearInterval(interval);
        }
    }, [weatherData]);

    if (!weatherData) return null;
    const safe = getSafeWeatherData(weatherData);
    if (!safe) return null;

    const currentInfo = getWeatherInfo(safe.current.code);

    let { name, country } = safe.location;
    if (country && country.includes('/')) country = null; 
    if (!country && name.includes(',')) {
        const parts = name.split(',');
        country = parts.pop().trim();
        name = parts.join(',').trim();
    }

    const locationLine = country ? `${name}, ${country}` : name;

    return (
        <div className="glass-panel rounded-3xl p-4 max-[400px]:p-3 relative overflow-x-hidden animate-fade-in">
            {/* ENCABEZADO COMPACTO — una línea: Nombre, PAÍS · hora */}
            <div className="relative z-10">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1.5 max-[400px]:mb-1">
                    <h2 className="text-lg max-[400px]:text-base font-bold leading-tight truncate min-w-0">{locationLine}</h2>
                    {localTime && (
                        <span className="text-xs font-mono font-bold text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded shrink-0">
                            {localTime}
                        </span>
                    )}
                </div>

                {/* Temp + Icon alineados */}
                <div className="flex items-center gap-3 max-[400px]:gap-2">
                    <span className="text-5xl font-bold tracking-tighter text-white leading-none">
                        {temp != null ? Math.round(temp) : safe.current.temp}°
                    </span>
                    <div className="shrink-0 pointer-events-none">
                        <WeatherIconMain 
                            code={safe.current.code} 
                            isDay={safe.current.isDay} 
                            temp={temp != null ? Math.round(temp) : safe.current.temp}
                            className="w-14 h-14" 
                        />
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-0 mt-1 max-[400px]:mt-0.5">
                    <span className={`text-base font-bold capitalize ${currentInfo.color}`}>{currentInfo.label}</span>
                    <span className="text-xs font-bold text-slate-500">
                        {t('common.feelsLike')} {feelsLike != null ? Math.round(feelsLike) : safe.current.feelsLike}°
                    </span>
                </div>

                <PrecipitationAlert alert={safe.analysis.precipitationAlert} />

                <div className="flex items-center gap-4 mt-3 max-[400px]:mt-2 max-[400px]:gap-3 text-slate-300">
                    <div className="flex items-center gap-1.5">
                        <Sun size={16} className="text-orange-400" strokeWidth={2} />
                        <span className="text-xs font-bold">{safe.astro.sunrise}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Moon size={16} className="text-purple-400" strokeWidth={2} />
                        <span className="text-xs font-bold">{safe.astro.sunset}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Moon size={14} fill="currentColor" className="opacity-50" strokeWidth={0} />
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate max-w-[60px]">
                            {safe.astro.moonPhase}
                        </span>
                    </div>
                </div>
            </div>

            <div className="h-px bg-white/5 w-full my-4 max-[400px]:my-3"></div>

            {weatherData.rawHourly && (
            <div className="relative z-10">
                <HomeSummary 
                    weatherData={weatherData} 
                    onSelectActivity={onSelectActivity} 
                    favorites={favorites}
                    customActivities={customActivities}
                    onGoToActivities={onGoToActivities}
                />
            </div>
            )}

            <div className="mt-4 max-[400px]:mt-3">
                <div className="flex gap-2 overflow-x-auto pb-3 px-1 no-scrollbar relative z-10 snap-x snap-mandatory">
                    {(safe.analysis.hourlyForecast || []).map((h, i) => {
                        const Icon = getWeatherIcon(h.iconCode, !!h.isDay); 
                        
                        const isSnow = h.snowCM > 0 || (h.iconCode >= 71 && h.iconCode <= 77) || (h.iconCode >= 85 && h.iconCode <= 86);
                        const barColor = isSnow ? 'bg-cyan-300' : 'bg-blue-500';
                        const textColor = isSnow ? 'text-cyan-300' : 'text-blue-400';

                        const barHeight = Math.min((isSnow ? h.snowCM * 4 : h.mm * 4) + 4, 12);

                        return (
                            <div key={i} className="flex flex-col items-center min-w-[3.5rem] gap-1 snap-center">
                                <span className="text-xs text-slate-500 font-bold mb-1">{h.time}</span>
                                <Icon className="w-6 h-6 text-slate-200" strokeWidth={1.5} />
                                <span className="text-sm font-bold text-white mb-1">{h.temp}°</span>
                                
                                <div className="h-6 w-full flex items-end justify-center">
                                    {h.prob > 0 ? (
                                        <div className="flex flex-col items-center gap-0.5 animate-fade-in">
                                            <span className={`text-[9px] font-bold leading-none ${textColor}`}>{h.prob}%</span>
                                            <div className={`w-1 rounded-full ${barColor}`} style={{ height: `${barHeight}px` }}></div>
                                        </div>
                                    ) : (
                                        <div className="w-1 h-1 rounded-full bg-slate-800/50 mb-1"></div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {weatherData.daily && weatherData.rawHourly && (
            <div className="mt-2 max-[400px]:mt-1">
                <WeeklyForecast daily={weatherData.daily} hourly={weatherData.rawHourly} />
            </div>
            )}
        </div>
    );
};

export default HomeView;