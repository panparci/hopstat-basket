import React from 'react';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon: React.ReactNode;
  isPassword?: boolean;
}

export const InputField: React.FC<InputFieldProps> = ({ label, icon, isPassword, ...props }) => {
  const [showPassword, setShowPassword] = React.useState(false);

  return (
    <div className="w-full">
      <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">{label}</label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-400">
          {icon}
        </div>
        <input
          {...props}
          type={isPassword ? (showPassword ? 'text' : 'password') : props.type}
          className="w-full pl-12 pr-12 py-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:ring-2 focus:ring-brand-navy dark:focus:ring-brand-orange outline-none font-medium text-[#1A1A1A] dark:text-white transition-all"
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-4 flex items-center text-zinc-400 hover:text-brand-navy dark:hover:text-brand-orange transition-colors"
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        )}
      </div>
    </div>
  );
};
