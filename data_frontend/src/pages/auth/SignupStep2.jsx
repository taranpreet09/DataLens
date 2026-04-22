import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSignup } from '../../context/SignupContext';

export default function SignupStep2() {
  const { formData, updateFields } = useSignup();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  const handleContinue = (e) => {
    e.preventDefault();
    setError('');

    if (!formData.fullName || formData.fullName.trim().length === 0) {
      setError('Full Name is required.');
      return;
    }

    navigate('/signup/step3');
  };

  return (
    <div className="w-full flex flex-col items-center justify-start px-6 py-2">
      <div className="w-full max-w-xl space-y-6">
        <div className="text-center md:text-left">
          <h1 className="text-2xl md:text-3xl font-headline font-bold text-on-surface tracking-tight mb-2">
            Personal Details
          </h1>
          <p className="text-on-surface-variant font-body text-sm leading-relaxed">
            Configure your professional identity within the Obsidian Analytics ecosystem. This information helps us tailor your insights.
          </p>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-xl bg-error/10 border border-error/20 text-error text-xs font-medium flex items-center gap-2">
            <span className="material-symbols-outlined text-sm shrink-0">error</span>
            {error}
          </div>
        )}

        <form className="space-y-5" onSubmit={handleContinue}>
          <div className="space-y-1.5">
            <label className="block text-sm font-label font-medium text-on-surface-variant tracking-wide" htmlFor="full_name">
              Full Name
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-outline">
                <span className="material-symbols-outlined text-[20px]">person</span>
              </div>
              <input 
                className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg py-3 pl-12 pr-4 text-on-surface placeholder:text-outline focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all duration-200 font-body" 
                id="full_name" 
                name="full_name" 
                placeholder="e.g. Alexander Vance" 
                required 
                type="text" 
                value={formData.fullName}
                onChange={(e) => updateFields({ fullName: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="block text-sm font-label font-medium text-on-surface-variant tracking-wide" htmlFor="role">
                Role <span className="text-outline text-xs italic">(Optional)</span>
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-outline">
                  <span className="material-symbols-outlined text-[20px]">badge</span>
                </div>
                <input 
                  className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg py-3 pl-12 pr-4 text-on-surface placeholder:text-outline focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all duration-200 font-body" 
                  id="role" 
                  name="role" 
                  placeholder="Lead Architect" 
                  type="text" 
                  value={formData.role}
                  onChange={(e) => updateFields({ role: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-label font-medium text-on-surface-variant tracking-wide" htmlFor="organization">
                Organization <span className="text-outline text-xs italic">(Optional)</span>
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-outline">
                  <span className="material-symbols-outlined text-[20px]">corporate_fare</span>
                </div>
                <input 
                  className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg py-3 pl-12 pr-4 text-on-surface placeholder:text-outline focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all duration-200 font-body" 
                  id="organization" 
                  name="organization" 
                  placeholder="Quantum Labs" 
                  type="text" 
                  value={formData.organization}
                  onChange={(e) => updateFields({ organization: e.target.value })}
                />
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
