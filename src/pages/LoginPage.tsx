import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { GradientIcon } from '../components/atoms/GradientIcon';
import { LoginForm } from '../components/organisms/LoginForm';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#F8F9FA] dark:bg-zinc-950 transition-colors font-sans relative">
      {/* Back button at top-left */}
      <button
        onClick={() => navigate('/welcome')}
        className="absolute top-6 left-6 flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider text-zinc-600 hover:text-[#1A1A1A] dark:text-zinc-400 dark:hover:text-white bg-white hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 shadow-sm transition-all cursor-pointer"
        id="btn-back-to-home"
      >
        <ArrowLeft size={14} />
        <span>Kembali</span>
      </button>

      <div className="w-full max-w-sm flex flex-col items-center">
        <GradientIcon />
        
        <div className="text-center mb-8">
          <h1 className="text-4xl font-display font-black italic uppercase text-[#1A1A1A] dark:text-white mb-2 tracking-tight">Welcome Back</h1>
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Sign in to access your workspace.</p>
        </div>

        <LoginForm />

        <div className="mt-8 flex flex-col items-center gap-3">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Don't have an account? <button onClick={() => navigate('/signup')} className="text-brand-navy dark:text-brand-orange font-bold hover:underline uppercase tracking-wider ml-1 cursor-pointer">Sign up</button>
          </p>

          <button
            onClick={() => navigate('/welcome')}
            className="text-xs font-bold text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 uppercase tracking-wider hover:underline cursor-pointer"
            id="btn-cancel-login"
          >
            Batal & Kembali ke Beranda
          </button>
        </div>
      </div>
    </div>
  );
};
