import React, { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface SignUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function SignUpModal({ isOpen, onClose, onSuccess }: SignUpModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
      setError('Please connect to Supabase first using the "Connect to Supabase" button.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            company_name: companyName,
            business_type: businessType,
            phone: phone
          }
        }
      });

      if (signUpError) throw signUpError;

      if (authData.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert([
            {
              id: authData.user.id,
              company_name: companyName,
              business_type: businessType,
              phone: phone,
            }
          ]);

        if (profileError) {
          console.error('Profile creation error:', profileError);
        }

        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during sign up');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="glass-card w-full max-w-md p-6 relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-200"
        >
          <X size={20} />
        </button>
        
        <h2 className="text-2xl font-bold mb-6 text-white">Create Your Account</h2>
        
        {error && (
          <div className="bg-red-900/50 text-red-200 p-3 rounded mb-4 border border-red-500/20">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-200 text-sm font-medium mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-black/50 border border-sky-500/20 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 text-white"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-200 text-sm font-medium mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-black/50 border border-sky-500/20 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 text-white"
              required
              minLength={6}
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-200 text-sm font-medium mb-2">
              Company Name
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full px-3 py-2 bg-black/50 border border-sky-500/20 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 text-white"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-200 text-sm font-medium mb-2">
              Business Type
            </label>
            <input
              type="text"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              className="w-full px-3 py-2 bg-black/50 border border-sky-500/20 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 text-white"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-gray-200 text-sm font-medium mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 bg-black/50 border border-sky-500/20 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 text-white"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>
      </div>
    </div>
  );
}