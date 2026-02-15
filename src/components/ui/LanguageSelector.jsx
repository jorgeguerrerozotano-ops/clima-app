import React from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Button from './Button';

const LANGS = [
  { code: 'es', label: 'ES' },
  { code: 'en', label: 'EN' },
];

export default function LanguageSelector({ className = '' }) {
  const { i18n } = useTranslation();
  const current = (i18n.language || i18n.resolvedLanguage || 'es').split('-')[0];

  return (
    <div
      className={twMerge('inline-flex rounded-xl overflow-hidden border border-border-default bg-surface-card p-0.5', className)}
      role="group"
      aria-label="Idioma / Language"
    >
      {LANGS.map(({ code, label }) => {
        const isActive = current === code;
        return (
          <Button
            key={code}
            type="button"
            variant={isActive ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => i18n.changeLanguage(code)}
            className={clsx(
              'min-w-[2.25rem] rounded-lg',
              !isActive && 'text-muted hover:text-white'
            )}
            aria-pressed={isActive}
            aria-label={code === 'es' ? 'Español' : 'English'}
          >
            {label}
          </Button>
        );
      })}
    </div>
  );
}
