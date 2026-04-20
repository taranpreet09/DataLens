import { useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { useGoogleLogin } from '@react-oauth/google';

export default function SignupStep1() {
  const { signupData, updateSignupData } = useOutletContext();
  const navigate = useNavigate();

  const [email, setEmail] = useState(signupData.email);
  const [password, setPassword] = useState(signupData.password);
  const [confirmPassword, setConfirmPassword] = useState(signupData.password);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { loginWithGoogle } = useAuth();

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setIsLoading(true);
      setError('');
      try {
        await loginWithGoogle(tokenResponse.access_token);
        // Navigate straight to dashboard since they're signed up AND logged in
        navigate('/dashboard', { replace: true });
      } catch (err) {
        setError(err.message || 'Google Signup failed.');
      } finally {
        setIsLoading(false);
      }
    },
    onError: () => {
      setError('Google Signup failed.');
    }
  });

  const handleContinue = (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) { setError('Email is required.'); return; }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError('Please enter a valid email address.'); return; }
    if (!password) { setError('Password is required.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }

    updateSignupData({ email: email.trim(), password });
    navigate('/signup/step2');
  };

  return (
    <div className="w-full flex flex-col items-center justify-start px-6 py-2">
      <div className="w-full max-w-md space-y-5">
        {/* Social Auth */}
        <button 
          onClick={() => googleLogin()}
          disabled={isLoading}
          type="button"
          className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-surface-container-high hover:bg-surface-bright border border-outline-variant/20 rounded-xl transition-all duration-300 group disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <img alt="Google logo" className="w-5 h-5" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDKbROCb7QXBmo-inShvXIm6JyemlP0l7Jl-PKEm3H6afIMDzWJipFUrOCdwqA_Ji2zhjdQDKs-vZMNwFrSb8JkhmcEVEKJ9H7s8FwzAp1B-irf4eO6caYBqu45P24avRWN8sd-VIhh6VXca3AKT2h09RflgN5QaUlz6vgEg-xbzjQewNz-hnsFfvO6TyMK9WMmNE0epV5jeVx8JIY4-KRdrSW-9XwnBZl4mSJAfsWTslWCF2kKo4hPf0_srAxirDZC2ftuwouFXrw" />
          <span className="font-label font-semibold text-on-surface">Sign up with Google</span>
        </button>

        <div className="relative flex items-center py-1">
          <div className="flex-grow border-t border-outline-variant/10"></div>
          <span className="flex-shrink mx-4 font-label text-xs font-medium text-on-surface-variant uppercase tracking-tighter">or use email</span>
          <div className="flex-grow border-t border-outline-variant/10"></div>
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -10, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, y: -10, height: 0 }} className="p-3 rounded-xl bg-error/10 border border-error/20 flex items-center gap-3">
              <span className="material-symbols-outlined text-error text-lg">error</span>
              <span className="text-error text-sm font-medium">{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Form */}
        <form className="space-y-4" onSubmit={handleContinue}>
          <div className="space-y-1.5">
            <label className="block font-label text-xs font-semibold text-on-surface-variant ml-1" htmlFor="email">Email Address</label>
            <div className="relative group">
              <input className="w-full bg-surface-container-lowest border-outline-variant/30 border text-on-surface px-4 py-3 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none placeholder:text-outline font-body text-sm" id="email" placeholder="you@datalens.com" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }} />
              <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors text-[20px]">alternate_email</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block font-label text-xs font-semibold text-on-surface-variant ml-1" htmlFor="password">Password</label>
            <div className="relative group">
              <input className="w-full bg-surface-container-lowest border-outline-variant/30 border text-on-surface px-4 py-3 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none placeholder:text-outline font-body text-sm" id="password" placeholder="••••••••••••" type="password" value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} />
              <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors text-[20px]">lock</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block font-label text-xs font-semibold text-on-surface-variant ml-1" htmlFor="confirm-password">Confirm Password</label>
            <div className="relative group">
              <input className="w-full bg-surface-container-lowest border-outline-variant/30 border text-on-surface px-4 py-3 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none placeholder:text-outline font-body text-sm" id="confirm-password" placeholder="••••••••••••" type="password" value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }} />
              <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors text-[20px]">verified_user</span>
            </div>
          </div>

          <div className="pt-2">
            <button type="submit" className="block w-full text-center obsidian-gradient py-3.5 rounded-xl font-headline font-bold text-on-primary-container shadow-[0_20px_50px_rgba(148,170,255,0.1)] hover:shadow-[0_20px_50px_rgba(148,170,255,0.2)] hover:scale-[1.01] active:scale-[0.99] transition-all duration-300">
              Continue
            </button>
          </div>
        </form>

        <div className="mt-3 text-center">
          <p className="font-body text-sm text-on-surface-variant">
            Already have an architect account? 
            <Link className="text-primary font-bold hover:underline underline-offset-4 decoration-primary/30 ml-1" to="/login">Sign In</Link>
          </p>
        </div>

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
