import React, { useState } from 'react';
import { Mail, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { InputField } from '../molecules/InputField';
import { authService } from '../../services/authService';
import { GoogleButton } from '../molecules/GoogleButton';

export const LoginForm: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(() => {
    const code = new URLSearchParams(window.location.search).get('error');
    if (code === 'suspended') return 'Akun Anda ditangguhkan (suspended). Silakan hubungi admin.';
    if (code === 'google_cancel') return 'Login Google dibatalkan.';
    if (code === 'google_email') return 'Email Google belum terverifikasi.';
    if (code?.startsWith('google')) return 'Login Google gagal. Silakan coba lagi.';
    return null;
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
      const next = new URLSearchParams(window.location.search).get('next');
      // Only allow same-origin relative paths (Drive auth, etc.)
      if (next && next.startsWith('/') && !next.startsWith('//')) {
        window.location.href = next;
      } else {
        window.location.href = '/';
      }
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

        <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
          <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" /> atau <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
        </div>
        <GoogleButton />
      </form>
    </div>
  );
};
