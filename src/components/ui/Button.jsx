import React from 'react';
import { Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const variantStyles = {
  primary:
    'bg-primary hover:bg-primary/90 text-white shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
  secondary:
    'border border-border-default text-muted hover:border-primary/50 hover:text-primary font-bold rounded-xl bg-surface-card hover:bg-surface-elevated transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed',
  danger:
    'bg-danger hover:bg-danger/90 text-white font-bold rounded-xl shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed',
  ghost:
    'bg-transparent hover:bg-surface-card text-muted hover:text-white rounded-lg transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed',
};

const sizeStyles = {
  sm: 'py-1.5 px-2 text-xs font-bold gap-1',
  md: 'py-2.5 px-4 text-xs font-bold gap-2',
  lg: 'py-3 px-5 text-sm font-bold gap-2',
  icon: 'p-1.5 rounded-lg',
  iconLg: 'p-2 rounded-xl',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  isLoading = false,
  disabled,
  type = 'button',
  ...props
}) {
  const base =
    'inline-flex items-center justify-center font-bold outline-none cursor-pointer';
  const variantClass = variantStyles[variant] ?? variantStyles.primary;
  const sizeClass = sizeStyles[size] ?? sizeStyles.md;

  return (
    <button
      type={type}
      disabled={disabled ?? isLoading}
      className={twMerge(clsx(base, variantClass, sizeClass), className)}
      {...props}
    >
      {isLoading && <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />}
      {children}
    </button>
  );
}
