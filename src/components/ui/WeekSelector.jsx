import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Button from './Button';
import Card from './Card';
import { getWeekNumber, getWeekRange, getWeekStartDate } from '../../utils/weekUtils';

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

/**
 * Genera la rejilla de un mes: array de filas, cada fila 7 fechas (Date).
 * Primera columna = lunes. Incluye días del mes anterior/siguiente para rellenar.
 */
function getMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0).getDate();
  // Lunes = 1 en getDay() → offset 0; domingo = 0 → offset 6
  const startOffset = (first.getDay() - 1 + 7) % 7;
  const days = [];

  for (let i = 0; i < startOffset; i++) {
    days.push(new Date(year, month, 1 - (startOffset - i)));
  }
  for (let d = 1; d <= lastDay; d++) {
    days.push(new Date(year, month, d));
  }
  const remainder = days.length % 7;
  if (remainder) {
    const pad = 7 - remainder;
    const last = days[days.length - 1];
    for (let i = 1; i <= pad; i++) {
      days.push(new Date(last.getFullYear(), last.getMonth(), last.getDate() + i));
    }
  }

  const rows = [];
  for (let i = 0; i < days.length; i += 7) {
    rows.push(days.slice(i, i + 7));
  }
  return rows;
}

export default function WeekSelector({
  currentWeek,
  onWeekChange,
  language = 'es',
  className = '',
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [hoveredWeek, setHoveredWeek] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const year = new Date().getFullYear();
    const start = getWeekStartDate(currentWeek, year);
    return { year: start.getFullYear(), month: start.getMonth() };
  });
  const popoverRef = useRef(null);
  const triggerRef = useRef(null);

  const rangeLabel = getWeekRange(currentWeek, language);

  // Sincronizar mes del calendario al abrir con la semana seleccionada
  useEffect(() => {
    if (open) {
      const year = new Date().getFullYear();
      const start = getWeekStartDate(currentWeek, year);
      setCalendarMonth({ year: start.getFullYear(), month: start.getMonth() });
    }
  }, [open, currentWeek]);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const goPrevWeek = () => {
    const next = currentWeek <= 1 ? 52 : currentWeek - 1;
    onWeekChange(next);
  };

  const goNextWeek = () => {
    const next = currentWeek >= 52 ? 1 : currentWeek + 1;
    onWeekChange(next);
  };

  const goPrevMonth = () => {
    setCalendarMonth((prev) => {
      if (prev.month === 0) return { year: prev.year - 1, month: 11 };
      return { year: prev.year, month: prev.month - 1 };
    });
  };

  const goNextMonth = () => {
    setCalendarMonth((prev) => {
      if (prev.month === 11) return { year: prev.year + 1, month: 0 };
      return { year: prev.year, month: prev.month + 1 };
    });
  };

  const handleDayClick = (date) => {
    const week = getWeekNumber(date);
    onWeekChange(week);
    setOpen(false);
  };

  const handleDayMouseEnter = (date) => {
    setHoveredWeek(getWeekNumber(date));
  };

  const handleDayMouseLeave = () => {
    setHoveredWeek(null);
  };

  const grid = getMonthGrid(calendarMonth.year, calendarMonth.month);
  const monthLabel = new Date(calendarMonth.year, calendarMonth.month, 1).toLocaleString(language, {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className={twMerge('relative flex flex-col gap-1', className)}>
      <div className="flex items-center gap-1 w-full">
        <Button
          type="button"
          variant="secondary"
          size="icon"
          onClick={goPrevWeek}
          className="shrink-0"
          aria-label={t('history.weekPrev')}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={twMerge(
            'flex-1 min-w-0 flex items-center justify-center gap-2',
            'bg-surface-card border border-border-default rounded-xl',
            'text-xs font-bold text-white hover:bg-surface-elevated hover:border-primary/50',
            'transition-colors outline-none focus:border-primary/50 py-2.5 px-3'
          )}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={`${t('history.week')} ${currentWeek}, ${rangeLabel}. ${t('history.weekOpenCalendar')}`}
        >
          <Calendar className="h-3.5 w-3.5 shrink-0 text-muted" />
          <span className="truncate">
            {t('history.week')} {currentWeek} ({rangeLabel})
          </span>
        </button>

        <Button
          type="button"
          variant="secondary"
          size="icon"
          onClick={goNextWeek}
          className="shrink-0"
          aria-label={t('history.weekNext')}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {open && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label={t('history.weekSelectCalendar')}
          className="z-[100] mt-1 animate-fade-in"
        >
          <Card variant="default" padding="sm" className="shadow-2xl border-border-default">
            <div className="flex items-center justify-between mb-3">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={goPrevMonth}
                aria-label={t('history.monthPrev')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs font-bold text-white capitalize">{monthLabel}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={goNextMonth}
                aria-label={t('history.monthNext')}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-7 gap-0.5 mb-2">
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  className="text-center text-xxs font-bold text-muted py-1"
                >
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5">
              {grid.map((row, rowIdx) =>
                row.map((date) => {
                  const weekNo = getWeekNumber(date);
                  const isCurrentMonth = date.getMonth() === calendarMonth.month;
                  const isSelectedWeek = weekNo === currentWeek;
                  const isHoveredRow = weekNo === hoveredWeek;

                  return (
                    <button
                      key={date.toISOString()}
                      type="button"
                      onClick={() => handleDayClick(date)}
                      onMouseEnter={() => handleDayMouseEnter(date)}
                      onMouseLeave={handleDayMouseLeave}
                      className={clsx(
                        'aspect-square flex items-center justify-center rounded-lg text-xs font-bold transition-colors',
                        !isCurrentMonth && 'text-slate-500',
                        isCurrentMonth && 'text-white',
                        isHoveredRow && 'bg-primary/20 text-primary-light',
                        isSelectedWeek && !isHoveredRow && 'bg-primary/30 text-white',
                        !isSelectedWeek && !isHoveredRow && 'hover:bg-surface-elevated'
                      )}
                      aria-label={`${date.getDate()} ${date.toLocaleDateString(language, { month: 'short' })}, ${t('history.week')} ${weekNo}`}
                    >
                      {date.getDate()}
                    </button>
                  );
                })
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
