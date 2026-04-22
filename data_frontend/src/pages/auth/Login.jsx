import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useGoogleLogin } from '@react-oauth/google';
import { useAuth } from '../../context/AuthContext';
import ParticleBackground from '../../components/ParticleBackground';

export default function Login() {
  const { login, loginWithGoogle } = useAuth();
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

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      setError('');
      try {
        await loginWithGoogle(tokenResponse.access_token);
        navigate('/dashboard');
      } catch (err) {
        setError(err.message || 'Google login failed.');
      } finally {
        setLoading(false);
      }
    },
    onError: () => setError('Google login was cancelled or failed.'),
  });

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
          <h1 className="font-headline text-4xl font-extrabold tracking-tighter text-primary mb-1">DataLens</h1>
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
                    placeholder="you@datalens.io"
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

            <div className="relative py-4 flex items-center">
              <div className="flex-grow border-t border-white/5" />
              <span className="flex-shrink mx-4 font-headline text-[9px] font-bold uppercase tracking-[0.2em] text-outline/50">or</span>
              <div className="flex-grow border-t border-white/5" />
            </div>

            <button
              onClick={() => googleLogin()}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 border border-white/5 text-on-surface font-headline font-semibold text-xs py-3.5 rounded-xl transition-all disabled:opacity-50"
              type="button"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </button>

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