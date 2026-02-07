/**
 * iconMap.js - Capa de abstracción semántica para iconografía
 * Única fuente de verdad: todos los iconos provienen de Lucide React
 */

import RunIcon from '../components/ui/extra-icons/RunIcon';
import WalkIcon from '../components/ui/extra-icons/WalkIcon';
import BikeIcon from '../components/ui/extra-icons/BikeIcon';
import {
    Sun, Moon, Cloud, CloudSun, CloudMoon, Cloudy, CloudFog,
    CloudRain, CloudDrizzle, CloudSnow, CloudLightning, CloudHail,
    Thermometer, Wind, Droplets, Snowflake, Footprints, Gauge, Mountain,
    Bike, Car, Bus, Train, Plane, Ship,
    Home, Briefcase, MapPin, Route, CalendarCheck, History,
    Dumbbell, Waves, CircleDot, Flower2, Flame, Gift, Heart, Star, PartyPopper,
    GraduationCap, ShoppingCart, Shirt, PawPrint, Baby, Coffee, Pizza, Beer, Wine,
    Popcorn, Music, Gamepad2, BookOpen, Camera, Paintbrush, Wrench, Monitor, HeartPulse,
    Search, Crosshair, Map, Navigation, Loader2, X, Check, AlertTriangle, RefreshCw,
    Plus, ChevronDown, ChevronUp, Clock, Play, Pause, ZoomIn, ZoomOut,
    ExternalLink, Info, Trash2, Save, Pencil, ArrowLeft, ArrowUpDown, Calendar,
    Umbrella
} from 'lucide-react';

// ============================================
// NAVEGACIÓN
// ============================================
export const NAV_ICONS = {
    home: Sun,
    routes: Route,
    activities: CalendarCheck,
    history: History,
    radar: CloudRain,
};

// ============================================
// TRANSPORTE
// ============================================
export const TRANSPORT_ICONS = {
    moto: Bike,       // Lucide no tiene Motorcycle; Bike como equivalente de dos ruedas
    car: Car,
    bicycle: BikeIcon,
    walk: WalkIcon,
    bus: Bus,
    train: Train,
    fly: Plane,
    boat: Ship,
};

// ============================================
// ACTIVIDADES (mapeo id → Lucide)
// ============================================
export const ACTIVITY_ICONS = {
    run: RunIcon,
    walk: WalkIcon,
    bike: BikeIcon,
    moto: Bike,
    car: Car,
    gym: Dumbbell,
    swim: Waves,
    tennis: CircleDot,
    soccer: CircleDot,
    basket: CircleDot,
    yoga: Flower2,
    hike: Footprints,
    bus: Bus,
    train: Train,
    fly: Plane,
    boat: Ship,
    work: Briefcase,
    study: GraduationCap,
    home: Home,
    shop: ShoppingCart,
    laundry: Shirt,
    dog: PawPrint,
    baby: Baby,
    coffee: Coffee,
    eat: Pizza,
    drink: Beer,
    wine: Wine,
    cinema: Popcorn,
    music: Music,
    game: Gamepad2,
    read: BookOpen,
    photo: Camera,
    art: Paintbrush,
    garden: Flower2,
    beach: Sun,
    camp: Flame,
    party: PartyPopper,
    gift: Gift,
    love: Heart,
    star: Star,
    health: HeartPulse,
    fix: Wrench,
    pc: Monitor,
};

// ============================================
// CLIMA (WMO code → { icon, isDayVariant })
// Monocromático: texto slate-200/white
// ============================================
const WEATHER_ICON_MAP = {
    0: { day: Sun, night: Moon },
    1: { day: CloudSun, night: CloudMoon },
    2: { day: CloudSun, night: CloudMoon },
    3: { day: Cloudy, night: Cloudy },
    45: { day: CloudFog, night: CloudFog },
    48: { day: CloudFog, night: CloudFog },
    51: { day: CloudDrizzle, night: CloudDrizzle },
    53: { day: CloudDrizzle, night: CloudDrizzle },
    55: { day: CloudDrizzle, night: CloudDrizzle },
    56: { day: CloudHail, night: CloudHail },
    57: { day: CloudHail, night: CloudHail },
    61: { day: CloudRain, night: CloudRain },
    63: { day: CloudRain, night: CloudRain },
    65: { day: CloudRain, night: CloudRain },
    66: { day: CloudHail, night: CloudHail },
    67: { day: CloudHail, night: CloudHail },
    71: { day: CloudSnow, night: CloudSnow },
    73: { day: CloudSnow, night: CloudSnow },
    75: { day: CloudSnow, night: CloudSnow },
    77: { day: CloudSnow, night: CloudSnow },
    80: { day: CloudRain, night: CloudRain },
    81: { day: CloudRain, night: CloudRain },
    82: { day: CloudRain, night: CloudRain },
    85: { day: CloudSnow, night: CloudSnow },
    86: { day: CloudSnow, night: CloudSnow },
    95: { day: CloudLightning, night: CloudLightning },
    96: { day: CloudLightning, night: CloudLightning },
    99: { day: CloudLightning, night: CloudLightning },
};

// ============================================
// FACTORES DE RIESGO (usado por riskUtils)
// ============================================
export const FACTOR_ICONS = {
    TEMP: Thermometer,
    WIND: Wind,
    PRECIP: CloudRain,
    GROUND: Footprints,
    ROAD: CloudRain,
    VISIBILITY: CloudFog,
    HUMIDITY: Droplets,
    UV: Sun,
    AQI: Gauge,
    SNOW: Snowflake,
    MOUNTAIN: Mountain,
    DEFAULT: Thermometer,
};

// ============================================
// UI GENÉRICOS
// ============================================
export const UI_ICONS = {
    search: Search,
    mapPin: MapPin,
    map: Map,
    crosshair: Crosshair,
    navigation: Navigation,
    loader: Loader2,
    close: X,
    check: Check,
    plus: Plus,
    alert: AlertTriangle,
    refresh: RefreshCw,
    chevronDown: ChevronDown,
    chevronUp: ChevronUp,
    clock: Clock,
    play: Play,
    pause: Pause,
    zoomIn: ZoomIn,
    zoomOut: ZoomOut,
    externalLink: ExternalLink,
    info: Info,
    trash: Trash2,
    save: Save,
    pencil: Pencil,
    arrowLeft: ArrowLeft,
    arrowUpDown: ArrowUpDown,
    calendar: Calendar,
    umbrella: Umbrella,
};

// ============================================
// API PÚBLICA
// ============================================

/**
 * Obtiene el icono Lucide para un concepto de navegación
 */
export const getNavIcon = (key) => NAV_ICONS[key] ?? Sun;

/**
 * Obtiene el icono Lucide para un medio de transporte
 */
export const getTransportIcon = (key) => TRANSPORT_ICONS[key] ?? Car;

/**
 * Obtiene el icono Lucide para una actividad
 */
export const getActivityIcon = (key) => ACTIVITY_ICONS[key] ?? Star;

/**
 * Obtiene el icono Lucide para un factor de riesgo
 */
export const getFactorIcon = (type) => FACTOR_ICONS[type] ?? FACTOR_ICONS.DEFAULT;

/**
 * Obtiene el icono Lucide para un código WMO (clima)
 * @param {number} code - Código WMO
 * @param {boolean} isDay - Si es de día
 * @returns {import('lucide-react').LucideIcon}
 */
export const getWeatherIcon = (code, isDay = true) => {
    const entry = WEATHER_ICON_MAP[code] ?? WEATHER_ICON_MAP[0];
    return isDay ? entry.day : entry.night;
};

/**
 * Obtiene un icono UI genérico
 */
export const getUIIcon = (key) => UI_ICONS[key] ?? null;
