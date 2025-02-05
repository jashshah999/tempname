import { useEffect, useState } from 'react';
import axios from 'axios';
import { supabase } from '../lib/supabase';

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
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        </div>
      )
  );
} 