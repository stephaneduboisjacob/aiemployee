import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'default' | 'secondary' | 'ghost' | 'outline';
const styles: Record<Variant, string> = {
  default: 'bg-violet-700 text-white hover:bg-violet-800 shadow-sm',
  secondary: 'bg-violet-50 text-violet-800 hover:bg-violet-100',
  ghost: 'bg-transparent text-slate-600 hover:bg-slate-100',
  outline: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
};

export function Button({ variant = 'default', className = '', children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; children: ReactNode }) {
  return <button className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 ${styles[variant]} ${className}`} {...props}>{children}</button>;
}
