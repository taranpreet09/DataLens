import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { useSignup } from '../../context/SignupContext';
import { useAuth } from '../../context/AuthContext';

export default function SignupStep1() {
  const { formData, updateFields } = useSignup();
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      setError('');
      try {
        await loginWithGoogle(tokenResponse.access_token);
        navigate('/dashboard');
      } catch (err) {
        setError(err.message || 'Google signup failed.');
      } finally {
        setLoading(false);
      }
    },
    onError: () => setError('Google signup was cancelled or failed.'),
  });

  const handleContinue = (e) => {
    e.preventDefault();
    setError('');

    if (!formData.email || !formData.password) {
      setError('Email and password are required.');
      return;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    navigate('/signup/step2');
  };

  return (
    <div className="w-full flex flex-col items-center justify-start px-6 py-2">
      <div className="w-full max-w-md space-y-5">
        {/* Social Auth */}
        <button 
          onClick={() => googleLogin()}
          disabled={loading}
          type="button"
          className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-surface-container-high hover:bg-surface-bright border border-outline-variant/20 rounded-xl transition-all duration-300 group disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          <span className="font-label font-semibold text-on-surface">Sign up with Google</span>
        </button>

        <div className="relative flex items-center py-1">
          <div className="flex-grow border-t border-outline-variant/10"></div>
          <span className="flex-shrink mx-4 font-label text-xs font-medium text-on-surface-variant uppercase tracking-tighter">or use email</span>
          <div className="flex-grow border-t border-outline-variant/10"></div>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-xl bg-error/10 border border-error/20 text-error text-xs font-medium flex items-center gap-2">
            <span className="material-symbols-outlined text-sm shrink-0">error</span>
            {error}
          </div>
        )}

        {/* Main Form */}
        <form className="space-y-4" onSubmit={handleContinue}>
          <div className="space-y-1.5">
            <label className="block font-label text-xs font-semibold text-on-surface-variant ml-1" htmlFor="email">Email Address</label>
            <div className="relative group">
              <input
                className="w-full bg-surface-container-lowest border-outline-variant/30 border text-on-surface px-4 py-3 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none placeholder:text-outline font-body text-sm"
                id="email"
                placeholder="you@datalens.com"
                type="email"
                value={formData.email}
                onChange={(e) => updateFields({ email: e.target.value })}
                autoComplete="email"
              />
              <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors text-[20px]">alternate_email</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block font-label text-xs font-semibold text-on-surface-variant ml-1" htmlFor="password">Password</label>
            <div className="relative group">
              <input
                className="w-full bg-surface-container-lowest border-outline-variant/30 border text-on-surface px-4 py-3 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none placeholder:text-outline font-body text-sm"
                id="password"
                placeholder="••••••••••••"
                type="password"
                value={formData.password}
                onChange={(e) => updateFields({ password: e.target.value })}
                autoComplete="new-password"
              />
              <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors text-[20px]">lock</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block font-label text-xs font-semibold text-on-surface-variant ml-1" htmlFor="confirm-password">Confirm Password</label>
            <div className="relative group">
              <input
                className="w-full bg-surface-container-lowest border-outline-variant/30 border text-on-surface px-4 py-3 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none placeholder:text-outline font-body text-sm"
                id="confirm-password"
                placeholder="••••••••••••"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => updateFields({ confirmPassword: e.target.value })}
                autoComplete="new-password"
              />
              <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors text-[20px]">verified_user</span>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="block text-center w-full obsidian-gradient py-3.5 rounded-xl font-headline font-bold text-on-primary-container shadow-[0_20px_50px_rgba(148,170,255,0.1)] hover:shadow-[0_20px_50px_rgba(148,170,255,0.2)] hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </div>
        </form>

        {/* Footer Meta */}
        <div className="mt-3 text-center">
          <p className="font-body text-sm text-on-surface-variant">
            Already have an architect account?
            <Link className="text-primary font-bold hover:underline underline-offset-4 decoration-primary/30 ml-1" to="/login">Sign In</Link>
          </p>
        </div>

        {/* TOS Text */}
        <div className="mt-2 px-8 text-center">
          <p className="font-label text-[10px] leading-relaxed text-outline uppercase tracking-widest opacity-60">
            By continuing, you agree to DataLens' <br/>
            <a className="hover:text-on-surface transition-colors" href="#">Terms of Service</a> &amp; <a className="hover:text-on-surface transition-colors" href="#">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  );
}
