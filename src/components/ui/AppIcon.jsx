/**
 * AppIcon - Componente de icono semántico
 * Usa exclusivamente Lucide a través de iconMap
 */

import React from 'react';
import { getNavIcon, getTransportIcon, getActivityIcon, getFactorIcon, getWeatherIcon, getUIIcon } from '../../utils/iconMap';

const SEMANTIC_GETTERS = {
    nav: getNavIcon,
    transport: getTransportIcon,
    activity: getActivityIcon,
    factor: getFactorIcon,
    weather: getWeatherIcon,
    ui: getUIIcon,
};

/**
 * @param {string} category - nav | transport | activity | factor | weather | ui
 * @param {string} name - Clave del icono (ej. 'home', 'moto', 'run')
 * @param {number} [weatherCode] - Para category='weather', código WMO
 * @param {boolean} [isDay] - Para category='weather', si es de día
 * @param {Object} props - Props de Lucide (size, className, etc.)
 */
const AppIcon = ({ category, name, weatherCode, isDay = true, ...props }) => {
    let Icon = null;
    if (category === 'weather' && typeof weatherCode === 'number') {
        Icon = getWeatherIcon(weatherCode, isDay);
    } else if (SEMANTIC_GETTERS[category]) {
        Icon = SEMANTIC_GETTERS[category](name);
    } else {
        Icon = getUIIcon(name) ?? getActivityIcon('star');
    }
    if (!Icon) return null;
    return <Icon {...props} />;
};

export default AppIcon;
export { getNavIcon, getTransportIcon, getActivityIcon, getFactorIcon, getWeatherIcon, getUIIcon };
