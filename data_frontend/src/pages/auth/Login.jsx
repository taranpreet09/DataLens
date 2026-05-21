import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import ParticleBackground from '../../components/ParticleBackground';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Please fill in both fields.'); return; }
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, filter: 'blur(8px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, filter: 'blur(8px)' }}
      transition={{ duration: 0.45 }}
      className="bg-surface text-on-surface font-body h-screen w-screen flex flex-col relative overflow-hidden"
    >
      <ParticleBackground />

      <div className="h-full flex flex-col items-center justify-center relative z-10 px-6 w-full">
        {/* Branding */}
        <div className="mb-8 text-center">
          <h1 className="font-headline text-4xl font-extrabold tracking-tighter text-primary mb-1">Obsidian Analytics</h1>
          <p className="font-headline font-semibold text-on-surface-variant/60 text-xs tracking-[0.3em] uppercase">
            Enterprise Intelligence Architect
          </p>
        </div>

        <div className="w-full max-w-md relative">
          <div className="bg-[#121212]/60 backdrop-blur-[40px] border border-white/5 rounded-2xl p-8 shadow-[0_40px_80px_rgba(0,0,0,0.7)] relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            <header className="mb-7 text-center">
              <h2 className="font-headline text-2xl font-bold text-on-surface mb-1">Welcome Back</h2>
              <p className="text-on-surface-variant text-sm opacity-80">Sign in to your analytics portal.</p>
            </header>

            {error && (
              <div className="mb-5 px-4 py-3 rounded-xl bg-error/10 border border-error/20 text-error text-xs font-medium flex items-center gap-2">
                <span className="material-symbols-outlined text-sm shrink-0">error</span>
                {error}
              </div>
            )}

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <label className="block font-headline text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/70" htmlFor="email">
                  Email
                </label>
                <div className="relative">
                  <input
                    className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-on-surface placeholder:text-outline/40 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/40 transition-all text-sm"
                    id="email"
                    placeholder="you@obsidiananalytics.io"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="block font-headline text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/70" htmlFor="password">
                    Password
                  </label>
                  <button type="button" className="font-headline text-[10px] font-bold text-primary/80 hover:text-primary transition-colors tracking-widest uppercase">
                    Forgot?
                  </button>
                </div>
                <div className="relative">
                  <input
                    className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 pr-11 text-on-surface placeholder:text-outline/40 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/40 transition-all text-sm"
                    id="password"
                    placeholder="••••••••••••"
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {showPass ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-primary-container text-on-primary font-headline font-extrabold text-sm uppercase tracking-widest py-3.5 rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-primary/10 disabled:opacity-60 disabled:cursor-wait flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                    Signing in…
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            <footer className="mt-7 text-center">
              <p className="text-on-surface-variant text-sm">
                No account?{' '}
                <Link className="text-primary font-bold hover:underline underline-offset-4 ml-1" to="/signup">
                  Create one
                </Link>
              </p>
            </footer>
          </div>

          {/* Status indicator */}
          <div className="mt-8 flex justify-center">
            <div className="flex items-center gap-2 bg-black/20 border border-white/5 px-4 py-2 rounded-full backdrop-blur-md">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary" />
              </span>
              <span className="font-headline text-[9px] font-bold uppercase tracking-[0.15em] text-on-surface/60">
                System: Nominal
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
