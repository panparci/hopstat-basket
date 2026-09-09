import React, { useState } from 'react';
import { Mail, Lock, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { InputField } from '../molecules/InputField';
import { authService } from '../../services/authService';
import { useToast } from '../../core/contexts/ToastContext';

export const SignUpForm: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { showToast } = useToast();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName || !trimmedEmail || !password || !confirmPassword) {
      setError('Harap isi semua kolom pendaftaran.');
      return;
    }

    // Validasi email format valid
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError('Format email tidak valid.');
      return;
    }

    // Validasi password minimal 6 karakter
    if (password.length < 6) {
      setError('Password minimal harus 6 karakter.');
      return;
    }

    // Validasi konfirmasi password di signup
    if (password !== confirmPassword) {
      setError('Konfirmasi password tidak cocok.');
      return;
    }

    setLoading(true);
    
    try {
      await authService.register(trimmedName, trimmedEmail, password, 'customer');
      showToast('Registrasi sukses! Selamat datang di HoopStats.', 'success');
      // Use full reload or redirect to home page
      window.location.href = '/';
    } catch (err: any) {
      setError(err?.message || 'Terjadi kesalahan saat pendaftaran.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="w-full flex flex-col gap-4" onSubmit={handleSignUp}>
      <InputField
        label="Full Name"
        icon={<User size={20} />}
        type="text"
        placeholder="John Doe"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
      />
      <InputField
        label="Email"
        icon={<Mail size={20} />}
        type="email"
        placeholder="name@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <InputField
        label="Password"
        icon={<Lock size={20} />}
        type="password"
        placeholder="Create a password (min 6 char)"
        isPassword
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <InputField
        label="Confirm Password"
        icon={<Lock size={20} />}
        type="password"
        placeholder="Confirm your password"
        isPassword
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
      />
      
      {error && <p className="text-red-500 dark:text-red-400 text-xs font-medium bg-red-50 dark:bg-red-950/20 p-3 rounded-xl border border-red-100 dark:border-red-900/30">{error}</p>}
      {message && <p className="text-emerald-600 dark:text-emerald-400 text-xs font-medium">{message}</p>}

      <button 
        type="submit" 
        disabled={loading}
        className="w-full py-4 mt-2 rounded-2xl font-bold tracking-wide text-white dark:text-brand-navy bg-brand-navy dark:bg-brand-orange shadow-sm hover:opacity-90 transition-all disabled:opacity-50 active:scale-95 duration-150 cursor-pointer"
      >
        {loading ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'}
      </button>
    </form>
  );
};

