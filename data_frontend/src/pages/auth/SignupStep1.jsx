import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSignup } from '../../context/SignupContext';

export default function SignupStep1() {
  const { formData, updateFields } = useSignup();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
                placeholder="you@datalens.io"
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
            By continuing, you agree to Data Lens' <br/>
            <a className="hover:text-on-surface transition-colors" href="#">Terms of Service</a> &amp; <a className="hover:text-on-surface transition-colors" href="#">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  );
}
