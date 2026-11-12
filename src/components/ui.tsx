import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
  Sun, Moon, Calendar, Search, Shield, Check, ChevronRight, 
  Plus, Trash2, Edit2, Settings, X, Download, Clock 
} from 'lucide-react';

export function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

export const Icon = ({ name, className }: { name: string; className?: string }) => {
  const props = { className: cn("icon", className) };
  switch (name) {
    case 'sun': return <Sun {...props} />;
    case 'moon': return <Moon {...props} />;
    case 'calendar': return <Calendar {...props} />;
    case 'search': return <Search {...props} />;
    case 'shield': return <Shield {...props} />;
    case 'check': return <Check {...props} />;
    case 'chevron': return <ChevronRight {...props} />;
    case 'plus': return <Plus {...props} />;
    case 'trash': return <Trash2 {...props} />;
    case 'edit': return <Edit2 {...props} />;
    case 'settings': return <Settings {...props} />;
    case 'close': return <X {...props} />;
    case 'download': return <Download {...props} />;
    case 'clock': return <Clock {...props} />;
    default: return null;
  }
};

export const Button = ({
  variant = 'secondary',
  icon,
  label,
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: string;
  icon?: string;
  label?: string;
}) => {
  return (
    <button
      {...props}
      aria-label={label}
      className={cn(
        'button',
        `button-${variant}`,
        className
      )}
    >
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
};

export const Field = ({
  label,
  leadingIcon,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  leadingIcon?: string;
}) => {
  return (
    <div className={cn('field', className)}>
      {label && <label className="field-label">{label}</label>}
      <div className="field-control">
        {leadingIcon && <Icon name={leadingIcon} />}
        <input {...props} />
      </div>
    </div>
  );
};

export const TextArea = ({
  label,
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
}) => {
  return (
    <div className={cn('field', className)}>
      {label && <label className="field-label">{label}</label>}
      <textarea {...props} />
    </div>
  );
};