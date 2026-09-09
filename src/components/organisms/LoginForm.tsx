import React, { useState } from 'react';
import { Mail, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { InputField } from '../molecules/InputField';
import { authService } from '../../services/authService';

export const LoginForm: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('error') === 'suspended'
      ? 'Akun Anda ditangguhkan (suspended). Silakan hubungi admin.'
      : null;
  });
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email) {
      setError('Email wajib diisi');
      return;
    }
    if (!password) {
      setError('Password wajib diisi');
      return;
    }

    setLoading(true);
    
    try {
      await authService.login(email, password);
      // Force reload or go to home to update global auth state
      window.location.href = '/';
    } catch (err: any) {
      setError(err.message || 'Login gagal. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <form className="w-full flex flex-col gap-4" onSubmit={handleSignIn}>
        <InputField
          label="Email"
          icon={<Mail size={20} />}
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <InputField
          label="Password"
          icon={<Lock size={20} />}
          type="password"
          placeholder="Enter your password"
          isPassword
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        
        {error && (
          <p className="text-red-500 dark:text-red-400 text-xs font-bold uppercase tracking-tight p-3 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-100 dark:border-red-900/30">
            {error}
          </p>
        )}

        <div className="flex justify-between items-center text-xs font-bold pt-2">
          <label className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 cursor-pointer">
            <input type="checkbox" className="rounded border-zinc-300 dark:border-zinc-700 text-brand-navy dark:text-brand-orange focus:ring-[#10B981] bg-zinc-50 dark:bg-zinc-900" />
            REMEMBER ME
          </label>
          <button type="button" onClick={() => navigate('/forgot-password')} className="text-brand-navy dark:text-brand-orange hover:underline uppercase tracking-wider">FORGOT PASSWORD?</button>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full py-4 mt-2 rounded-2xl font-black tracking-widest text-white dark:text-brand-navy bg-zinc-900 dark:bg-white shadow-lg shadow-zinc-500/20 hover:opacity-90 transition-all disabled:opacity-50 uppercase cursor-pointer"
        >
          {loading ? 'SIGNING IN...' : 'SIGN IN'}
        </button>
      </form>
    </div>
  );
};
