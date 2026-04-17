import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import ParticleBackground from '../../components/ParticleBackground';

export default function Login() {
  return (
    <motion.div 
      initial={{ opacity: 0, filter: 'blur(10px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, filter: 'blur(10px)' }}
      transition={{ duration: 0.5 }}
      className="bg-surface text-on-surface font-body selection:bg-primary selection:text-on-primary h-screen w-screen flex flex-col relative overflow-hidden"
    >
      {/* Particle Background */}
      <ParticleBackground />
      
      <div className="h-full flex flex-col items-center justify-center relative z-10 px-6 w-full">
        {/* Branding */}
        <div className="mb-10 text-center">
          <h1 className="font-headline text-4xl font-extrabold tracking-tighter text-primary mb-2.5">
            DataLens
          </h1>
          <p className="font-headline font-semibold text-on-surface-variant/60 text-xs tracking-[0.3em] uppercase">
            Enterprise Intelligence Architect
          </p>
        </div>

        {/* Login Container */}
        <div className="w-full max-w-md relative">
          <div className="glass-panel border border-white/5 rounded-2xl p-10 shadow-[0_40px_100px_rgba(0,0,0,0.8)] relative overflow-hidden bg-[#121212]/40 backdrop-blur-[40px] saturate-150">
            {/* Subtle Top Highlight */}
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
            
            <header className="mb-10 text-center">
              <h2 className="font-headline text-2xl font-bold text-on-surface mb-2">Welcome Back</h2>
              <p className="font-body text-on-surface-variant text-sm font-medium opacity-80">Access your strategic insights portal.</p>
            </header>

            <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
              {/* Email Field */}
              <div className="space-y-2.5">
                <label className="block font-headline text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/70" htmlFor="email">Security Identity (Email)</label>
                <div className="relative group">
                  <input 
                    className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3.5 text-on-surface placeholder:text-outline/40 focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 transition-all duration-500 font-body text-sm" 
                    id="email" 
                    placeholder="you@datalens.io" 
                    type="email" 
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2.5">
                <div className="flex justify-between items-center">
                  <label className="block font-headline text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/70" htmlFor="password">Access Credential</label>
                  <a className="font-headline text-[10px] font-bold text-primary/80 hover:text-primary transition-colors tracking-widest uppercase" href="#">Reset Key?</a>
                </div>
                <div className="relative group">
                  <input 
                    className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3.5 text-on-surface placeholder:text-outline/40 focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 transition-all duration-500 font-body text-sm" 
                    id="password" 
                    placeholder="••••••••••••" 
                    type="password" 
                  />
                </div>
              </div>

              {/* Login Button */}
              <Link to="/dashboard" className="block text-center w-full bg-primary hover:bg-primary-container text-on-primary font-headline font-extrabold text-sm uppercase tracking-widest py-4 rounded-xl transition-all duration-300 transform active:scale-[0.98] shadow-lg shadow-primary/10 border border-white/10">
                Initialize Session
              </Link>
            </form>

            {/* Divider */}
            <div className="relative py-4 flex items-center">
              <div className="flex-grow border-t border-white/5"></div>
              <span className="flex-shrink mx-4 font-headline text-[9px] font-bold uppercase tracking-[0.25em] text-outline/50">Extended Protocol</span>
              <div className="flex-grow border-t border-white/5"></div>
            </div>

            {/* Social Login Stack */}
            <div className="space-y-3">
              <button className="w-full flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 border border-white/5 text-on-surface font-headline font-semibold text-xs py-3.5 rounded-xl transition-all duration-300 glow-hover" type="button">
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"></path>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
                </svg>
                Continue with Google
              </button>
              
              <div className="grid grid-cols-2 gap-3">
                <button className="flex items-center justify-center gap-2 bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 text-on-surface/80 font-headline font-semibold text-[10px] py-2.5 rounded-xl transition-all duration-300 uppercase tracking-widest glow-hover" type="button">
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"></path>
                  </svg>
                  GitHub
                </button>
                <button className="flex items-center justify-center gap-2 bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 text-on-surface/80 font-headline font-semibold text-[10px] py-2.5 rounded-xl transition-all duration-300 uppercase tracking-widest glow-hover" type="button">
                  <span className="material-symbols-outlined text-sm">key</span>
                  Corporate SSO
                </button>
              </div>
            </div>

            <footer className="mt-10 text-center">
              <p className="font-body text-on-surface-variant text-sm font-medium">
                Unauthorized access is monitored. 
                <Link className="text-primary font-bold hover:underline decoration-primary/30 underline-offset-4 ml-1 transition-all" to="/signup">Register</Link>
              </p>
            </footer>
          </div>
          
          {/* Footer Meta */}
          <div className="mt-12 flex justify-center gap-8">
            <a className="font-headline text-[9px] font-bold uppercase tracking-[0.25em] text-outline/40 hover:text-primary transition-colors" href="#">Security Core</a>
            <a className="font-headline text-[9px] font-bold uppercase tracking-[0.25em] text-outline/40 hover:text-primary transition-colors" href="#">Legal Protocol</a>
            <a className="font-headline text-[9px] font-bold uppercase tracking-[0.25em] text-outline/40 hover:text-primary transition-colors" href="#">Architecture</a>
          </div>
        </div>

        {/* System Status Indicator (Corner) */}
        <div className="fixed top-8 right-8 flex items-center gap-3 bg-black/20 border border-white/5 px-4 py-2 rounded-full backdrop-blur-md">
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary"></span>
          </div>
          <span className="font-headline text-[9px] font-bold uppercase tracking-[0.15em] text-on-surface/60">Node: Primary_Core // Status: Nominal</span>
        </div>

        {/* Decorative UI Bits */}
        <div className="fixed bottom-10 left-10 text-[10px] font-mono text-outline/20 tracking-widest hidden lg:block">
          LATENCY: 14ms // ENC: AES-256-GCM
        </div>
        <div className="fixed bottom-10 right-10 text-[10px] font-mono text-outline/40 tracking-tighter">
          V 2.4.0 // DATALENS_OS
        </div>
      </div>
    </motion.div>
  );
}
