import React, { useState } from 'react';
import { Mail } from 'lucide-react';
import { InputField } from '../molecules/InputField';

export const ForgotPasswordForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setMessage('Hubungi admin HoopStat untuk reset password. Tautan email belum aktif.');
    }, 400);
  };

  return (
    <form className="w-full flex flex-col gap-4" onSubmit={handleForgotPassword}>
      <InputField
        label="Email"
        icon={<Mail size={20} />}
        type="email"
        placeholder="name@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      
      {error && <p className="text-red-500 dark:text-red-400 text-xs font-medium">{error}</p>}
      {message && <p className="text-emerald-600 dark:text-emerald-400 text-xs font-medium">{message}</p>}

      <button 
        type="submit" 
        disabled={loading}
        className="w-full py-4 mt-4 rounded-2xl font-bold tracking-wide text-white dark:text-brand-navy bg-brand-navy dark:bg-brand-orange shadow-sm hover:opacity-90 transition-all disabled:opacity-50"
      >
        {loading ? 'SENDING...' : 'SEND RESET LINK'}
      </button>
    </form>
  );
};
