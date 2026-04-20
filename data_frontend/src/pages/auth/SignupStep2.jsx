import { useState } from 'react';
import { Link, Navigate, useNavigate, useOutletContext } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

export default function SignupStep2() {
  const { signupData, updateSignupData } = useOutletContext();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState(signupData.fullName);
  const [role, setRole] = useState(signupData.role);
  const [organization, setOrganization] = useState(signupData.organization);
  const [error, setError] = useState('');

  // Redirect back if step 1 not completed — use Navigate component, not navigate()
  if (!signupData.email || !signupData.password) {
    return <Navigate to="/signup" replace />;
  }

  const handleContinue = (e) => {
    e.preventDefault();
    setError('');
    if (!fullName.trim()) { setError('Full name is required.'); return; }
    updateSignupData({ fullName: fullName.trim(), role: role.trim(), organization: organization.trim() });
    navigate('/signup/step3');
  };

  return (
    <div className="w-full flex flex-col items-center justify-start px-6 py-2">
      <div className="w-full max-w-xl space-y-6">
        <div className="text-center md:text-left">
          <h1 className="text-2xl md:text-3xl font-headline font-bold text-on-surface tracking-tight mb-2">Personal Details</h1>
          <p className="text-on-surface-variant font-body text-sm leading-relaxed">Configure your professional identity within the DataLens ecosystem. This information helps us tailor your insights.</p>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -10, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, y: -10, height: 0 }} className="p-3 rounded-xl bg-error/10 border border-error/20 flex items-center gap-3">
              <span className="material-symbols-outlined text-error text-lg">error</span>
              <span className="text-error text-sm font-medium">{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <form className="space-y-5" onSubmit={handleContinue}>
          <div className="space-y-1.5">
            <label className="block text-sm font-label font-medium text-on-surface-variant tracking-wide" htmlFor="full_name">Full Name</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-outline">
                <span className="material-symbols-outlined text-[20px]">person</span>
              </div>
              <input className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg py-3 pl-12 pr-4 text-on-surface placeholder:text-outline focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all duration-200 font-body" id="full_name" name="full_name" placeholder="e.g. Alexander Vance" required type="text" value={fullName} onChange={(e) => { setFullName(e.target.value); setError(''); }} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="block text-sm font-label font-medium text-on-surface-variant tracking-wide" htmlFor="role">Role <span className="text-outline text-xs italic">(Optional)</span></label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-outline">
                  <span className="material-symbols-outlined text-[20px]">badge</span>
                </div>
                <input className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg py-3 pl-12 pr-4 text-on-surface placeholder:text-outline focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all duration-200 font-body" id="role" name="role" placeholder="Lead Architect" type="text" value={role} onChange={(e) => setRole(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-label font-medium text-on-surface-variant tracking-wide" htmlFor="organization">Organization <span className="text-outline text-xs italic">(Optional)</span></label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-outline">
                  <span className="material-symbols-outlined text-[20px]">corporate_fare</span>
                </div>
                <input className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg py-3 pl-12 pr-4 text-on-surface placeholder:text-outline focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all duration-200 font-body" id="organization" name="organization" placeholder="Quantum Labs" type="text" value={organization} onChange={(e) => setOrganization(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="pt-3 flex flex-col md:flex-row items-center justify-between gap-4">
            <Link className="group flex items-center gap-2 text-on-surface-variant hover:text-white transition-colors font-label py-2 px-4" to="/signup">
              <span className="material-symbols-outlined text-[18px] transition-transform group-hover:-translate-x-1">arrow_back</span>
              Back
            </Link>
            <button type="submit" className="w-full md:w-auto primary-gradient text-on-primary-fixed px-10 py-3.5 rounded-lg font-headline font-bold text-lg hover:shadow-[0_0_20px_rgba(148,170,255,0.3)] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2">
              Continue
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
