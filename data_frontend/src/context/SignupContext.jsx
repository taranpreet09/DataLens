import { createContext, useContext, useState } from 'react';

const SignupContext = createContext(null);

export function SignupProvider({ children }) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    role: '',
    organization: '',
    platform: 'business_intelligence',
  });

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const updateFields = (fields) => {
    setFormData(prev => ({ ...prev, ...fields }));
  };

  const reset = () => {
    setFormData({
      email: '',
      password: '',
      confirmPassword: '',
      fullName: '',
      role: '',
      organization: '',
      platform: 'business_intelligence',
    });
  };

  return (
    <SignupContext.Provider value={{ formData, updateField, updateFields, reset }}>
      {children}
    </SignupContext.Provider>
  );
}

export function useSignup() {
  const ctx = useContext(SignupContext);
  if (!ctx) throw new Error('useSignup must be used inside SignupProvider');
  return ctx;
}
