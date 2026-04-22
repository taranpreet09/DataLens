import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import ParticleBackground from '../../components/ParticleBackground';
import { SignupProvider } from '../../context/SignupContext';

const STEP_CONFIG = {
  '/signup': { step: 1, label: 'Account Creation', percent: 33, width: 'w-1/3' },
  '/signup/step2': { step: 2, label: 'Personal Details', percent: 50, width: 'w-1/2' },
  '/signup/step3': { step: 3, label: 'Platform Setup', percent: 100, width: 'w-full' },
};

export default function SignupLayout() {
  const location = useLocation();
  const config = STEP_CONFIG[location.pathname] || STEP_CONFIG['/signup'];

  return (
    <SignupProvider>
      <div className="bg-surface text-on-surface font-body selection:bg-primary selection:text-on-primary antialiased h-screen w-screen flex flex-col overflow-hidden relative">
        {/* Particle Background */}
        <ParticleBackground />

        {/* Compact Header — never animates */}
        <header className="relative z-50 flex justify-center py-4 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary rounded-sm flex items-center justify-center overflow-hidden">
              <div className="w-3.5 h-3.5 bg-on-primary rotate-45 transform"></div>
            </div>
            <span className="font-headline font-extrabold text-lg tracking-tighter text-on-surface">Obsidian Analytics</span>
          </div>
        </header>

        {/* Compact Progress Bar — never animates */}
        <div className="relative z-40 w-full max-w-md mx-auto px-6 shrink-0 mb-4">
          <div className="flex justify-between items-end mb-2">
            <div>
              <h2 className="font-headline font-bold text-xs text-on-surface-variant uppercase tracking-widest">
                Step {config.step} of 3
              </h2>
              <p className="font-headline font-extrabold text-xl text-on-surface mt-0.5">
                {config.label}
              </p>
            </div>
            <span className="text-primary font-headline font-bold text-sm">{config.percent}%</span>
          </div>
          <div className="h-1 w-full bg-surface-container-highest rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={false}
              animate={{ width: `${config.percent}%` }}
              transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
            />
          </div>
        </div>

        {/* Animated Content Area — only this part transitions */}
        <div className="relative z-10 flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -60 }}
              transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
              className="h-full overflow-y-auto no-scrollbar"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </SignupProvider>
  );
}
