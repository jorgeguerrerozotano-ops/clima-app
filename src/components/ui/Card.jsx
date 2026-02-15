import React, { forwardRef } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const variantStyles = {
  default:
    'bg-surface-card border border-border-default rounded-2xl shadow-xl overflow-hidden',
  glass:
    'rounded-2xl overflow-hidden backdrop-blur-md border border-[var(--glass-border)] bg-[var(--glass-bg)]',
  outlined:
    'bg-transparent border border-border-default rounded-2xl overflow-hidden',
  elevated:
    'bg-surface-elevated border border-border-default rounded-2xl shadow-2xl overflow-hidden',
};

const paddingStyles = {
  default: 'p-6',
  none: 'p-0',
  sm: 'p-4',
  md: 'p-5',
};

const Card = forwardRef(function Card(
  {
    children,
    variant = 'default',
    padding = 'default',
    className = '',
    as: Component = 'div',
    ...props
  },
  ref
) {
  const variantClass = variantStyles[variant] ?? variantStyles.default;
  const paddingClass = paddingStyles[padding] ?? paddingStyles.default;

  return (
    <Component
      ref={ref}
      className={twMerge(clsx(variantClass, paddingClass), className)}
      {...props}
    >
      {children}
    </Component>
  );
});

export default Card;
