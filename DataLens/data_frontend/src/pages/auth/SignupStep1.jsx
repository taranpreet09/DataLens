import { Link } from 'react-router-dom';

export default function SignupStep1() {
  return (
    <div className="w-full flex flex-col items-center justify-start px-6 py-2">
      <div className="w-full max-w-md space-y-5">
        {/* Social Auth */}
        <button className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-surface-container-high hover:bg-surface-bright border border-outline-variant/20 rounded-xl transition-all duration-300 group">
          <img 
            alt="Google logo" 
            className="w-5 h-5" 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDKbROCb7QXBmo-inShvXIm6JyemlP0l7Jl-PKEm3H6afIMDzWJipFUrOCdwqA_Ji2zhjdQDKs-vZMNwFrSb8JkhmcEVEKJ9H7s8FwzAp1B-irf4eO6caYBqu45P24avRWN8sd-VIhh6VXca3AKT2h09RflgN5QaUlz6vgEg-xbzjQewNz-hnsFfvO6TyMK9WMmNE0epV5jeVx8JIY4-KRdrSW-9XwnBZl4mSJAfsWTslWCF2kKo4hPf0_srAxirDZC2ftuwouFXrw" 
          />
          <span className="font-label font-semibold text-on-surface">Sign up with Google</span>
        </button>

        <div className="relative flex items-center py-1">
          <div className="flex-grow border-t border-outline-variant/10"></div>
          <span className="flex-shrink mx-4 font-label text-xs font-medium text-on-surface-variant uppercase tracking-tighter">or use email</span>
          <div className="flex-grow border-t border-outline-variant/10"></div>
        </div>

        {/* Main Form */}
        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <div className="space-y-1.5">
            <label className="block font-label text-xs font-semibold text-on-surface-variant ml-1" htmlFor="email">Email Address</label>
            <div className="relative group">
              <input 
                className="w-full bg-surface-container-lowest border-outline-variant/30 border text-on-surface px-4 py-3 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none placeholder:text-outline font-body text-sm" 
                id="email" 
                placeholder="you@datalens.com" 
                type="email" 
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
              />
              <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors text-[20px]">verified_user</span>
            </div>
          </div>

          <div className="pt-2">
            <Link to="/signup/step2" className="block text-center obsidian-gradient w-full py-3.5 rounded-xl font-headline font-bold text-on-primary-container shadow-[0_20px_50px_rgba(148,170,255,0.1)] hover:shadow-[0_20px_50px_rgba(148,170,255,0.2)] hover:scale-[1.01] active:scale-[0.99] transition-all duration-300">
              Continue
            </Link>
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
