import { useEffect } from 'react';

export function AuthCallback() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    
    if (code && state) {
      try {
        // Decode state parameter
        const stateData = JSON.parse(atob(state));
        
        // Send the code back to the opener window
        if (window.opener) {
          window.opener.postMessage({
            type: 'GOOGLE_OAUTH_SUCCESS',
            code
          }, window.location.origin);
        }
      } catch (error) {
        console.error('Error processing callback:', error);
      }
    }
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-black">
      <div className="text-white">Processing authentication...</div>
    </div>
  );
} 