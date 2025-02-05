import { useEffect, useState } from 'react';
import axios from 'axios';
import { supabase } from '../lib/supabase';
import { Loader2 } from 'lucide-react';

export function AuthCallback() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (code) {
      try {
        const backendUrl = !import.meta.env.VITE_BACKEND_URL ? 'http://localhost:8000' : import.meta.env.VITE_BACKEND_URL;
        axios.post(`${backendUrl}/api/authentication/verify-user`, { code })
          .then(async response => {
            await supabase.auth.setSession({ access_token: response.data.access_token, refresh_token: response.data.refresh_token });
            console.log(response)
            window.location.href = window.location.origin;
          })
          .catch(error => {
            console.error('API error:', error);
          });
      } catch (error) {
        console.error('Error processing callback:', error);
        setError(`Error processing callback: ${error}`);
      }
    }
  }, []);

  return (
    error ? (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-white">{error}</div>
      </div>
    ) :
      (
        <div className="min-h-screen flex flex-col items-center justify-center">
          <div className="relative p-12">
            <div className="absolute -inset-2 bg-green-600/20 rounded-full blur-xl animate-pulse" />
            <div>
              <Loader2
                className="text-green-500 w-16 h-16 animate-spin relative"
                strokeWidth={1.5}
              />
            </div>
          </div>

          {/* Loading text with animations */}
          <div className="mt-8 flex flex-col items-center animate-fade-in">
            <p className="text-green-500 text-xl font-light tracking-wider">
              LOADING
            </p>
          </div>
        </div>
      )
  );
} 