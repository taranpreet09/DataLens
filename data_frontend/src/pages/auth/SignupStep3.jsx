import { useState } from 'react';
import { Link, Navigate, useNavigate, useOutletContext } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';

export default function SignupStep3() {
  const { signupData, updateSignupData, clearSignupData } = useOutletContext();
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [selectedRole, setSelectedRole] = useState(signupData.platform || 'business_intelligence');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Redirect back if previous steps not completed — use Navigate component
  if (!signupData.email || !signupData.password || !signupData.fullName) {
    return <Navigate to="/signup" replace />;
  }

  const options = [
    { id: 'personal_analytics', icon: 'monitoring', title: 'Personal Analytics', desc: 'Track private assets and individual performance metrics.', colorClass: 'primary' },
    { id: 'business_intelligence', icon: 'insights', title: 'Business Intelligence', desc: 'Enterprise dashboarding and collaborative reporting.', colorClass: 'primary' },
    { id: 'machine_learning', icon: 'psychology', title: 'Machine Learning', desc: 'Deploy models and automate feature engineering.', colorClass: 'tertiary' },
    { id: 'data_engineering', icon: 'database', title: 'Data Engineering', desc: 'Architect ETL flows and manage data pipelines.', colorClass: 'secondary' },
  ];

  const handleFinish = async () => {
    setError('');
    setIsLoading(true);
    try {
      const finalData = { ...signupData, platform: selectedRole };
      updateSignupData({ platform: selectedRole });
      await signup(finalData);
      clearSignupData();
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Signup failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col items-center justify-start px-6 py-2">
      <section className="text-center mb-6 max-w-2xl">
        <h1 className="font-headline font-extrabold text-2xl md:text-3xl tracking-tight mb-2 text-white">What do you want to use this platform for?</h1>
        <p className="text-on-surface-variant max-w-xl mx-auto text-sm">Select your primary focus. We'll tailor the workspace to match your requirements.</p>
      </section>

      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -10, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, y: -10, height: 0 }} className="mb-4 p-3 rounded-xl bg-error/10 border border-error/20 flex items-center gap-3 max-w-5xl w-full">
            <span className="material-symbols-outlined text-error text-lg">error</span>
            <span className="text-error text-sm font-medium">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full max-w-5xl">
        {options.map((opt) => {
          const isActive = selectedRole === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => setSelectedRole(opt.id)}
              className={`group relative flex flex-col items-start p-5 rounded-xl text-left overflow-hidden transition-all duration-300 cursor-pointer ${isActive ? 'bg-surface-container-high border-2' : 'bg-surface-container-low border border-outline-variant/10'}`}
              style={isActive ? { borderColor: `var(--color-${opt.colorClass})`, boxShadow: `0 0 20px -5px rgba(var(--color-${opt.colorClass}-rgb), 0.3)` } : {}}
            >
              <div className={`absolute inset-0 bg-gradient-to-br from-${opt.colorClass}/10 to-transparent ${isActive ? '' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}></div>
              <div
                className={`mb-3 w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${isActive ? '' : `bg-surface-container-high text-${opt.colorClass}`}`}
                style={isActive ? { backgroundColor: `var(--color-${opt.colorClass})`, color: `var(--color-on-${opt.colorClass})` } : {}}
              >
                <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive ? "'opsz' 32, 'FILL' 1" : "'opsz' 32" }}>{opt.icon}</span>
              </div>
              <h3 className="font-headline font-bold text-base mb-1 text-white">{opt.title}</h3>
              <p className="text-on-surface-variant text-xs leading-relaxed mb-3">{opt.desc}</p>
              <div className={`mt-auto flex items-center text-${opt.colorClass} text-[10px] font-bold uppercase tracking-widest ${isActive ? '' : 'opacity-0 group-hover:opacity-100'} transition-all`}>
                {isActive ? (<>Active <span className="material-symbols-outlined ml-1 text-sm">check_circle</span></>) : (<>Select <span className="material-symbols-outlined ml-1 text-sm">arrow_forward</span></>)}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-8 flex flex-col items-center gap-3 w-full">
        <button onClick={handleFinish} disabled={isLoading} className="w-full max-w-sm bg-primary hover:bg-primary-container text-on-primary font-headline font-extrabold text-base py-4 rounded-xl shadow-glow-primary transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed">
          {isLoading ? (
            <><span className="w-5 h-5 border-2 border-on-primary border-t-transparent rounded-full animate-spin"></span> Creating Account...</>
          ) : (
            <>Finish Setup <span className="material-symbols-outlined">rocket_launch</span></>
          )}
        </button>
        <Link to="/signup/step2" className="text-on-surface-variant hover:text-white transition-colors font-label font-medium text-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          Go back to Step 2
        </Link>
      </div>
    </div>
  );
}
