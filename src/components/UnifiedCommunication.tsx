import React, { useState, useEffect } from 'react';
import { Mail, MessageSquare, FileSpreadsheet, Settings, X } from 'lucide-react';

interface UnifiedCommunicationProps {
  onClose: () => void;
}

export function UnifiedCommunication({ onClose }: UnifiedCommunicationProps) {
  const [activeTab, setActiveTab] = useState<'email' | 'whatsapp' | 'sheets'>('email');
  const [isConfigured, setIsConfigured] = useState({
    email: false,
    whatsapp: false,
    sheets: false
  });

  const handleGmailAuth = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      console.error('Google Client ID not configured');
      return;
    }

    // Define the OAuth configuration
    const redirectUri = `${window.location.origin}/auth/callback`;
    const scopes = [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file'
    ];
    
    // Build the OAuth URL with all required parameters
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', scopes.join(' '));
    authUrl.searchParams.append('access_type', 'offline');
    authUrl.searchParams.append('prompt', 'consent');
    authUrl.searchParams.append('state', JSON.stringify({ returnTo: window.location.pathname }));

    // Redirect to Google's OAuth page
    window.location.href = authUrl.toString();
  };

  const handleWhatsAppAuth = () => {
    window.open('https://web.whatsapp.com', '_blank');
  };

  const handleSheetsAuth = handleGmailAuth; // Use the same OAuth flow

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="glass-card w-full max-w-6xl h-[90vh] p-4 relative">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Unified Communication</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Main Content */}
        <div className="flex h-[calc(100%-4rem)]">
          {/* Sidebar */}
          <div className="w-64 border-r border-sky-500/20 pr-4">
            <div className="space-y-2">
              <button
                onClick={() => setActiveTab('email')}
                className={`w-full text-left p-3 rounded-lg flex items-center space-x-3 ${
                  activeTab === 'email' ? 'bg-sky-500/10 text-sky-500' : 'hover:bg-sky-500/5'
                }`}
              >
                <Mail className="h-16 w-16 text-sky-500/50 mb-4" />
                <span>Email</span>
                {!isConfigured.email && (
                  <span className="ml-auto text-xs text-sky-500">Setup Required</span>
                )}
              </button>
              
              <button
                onClick={() => setActiveTab('whatsapp')}
                className={`w-full text-left p-3 rounded-lg flex items-center space-x-3 ${
                  activeTab === 'whatsapp' ? 'bg-sky-500/10 text-sky-500' : 'hover:bg-sky-500/5'
                }`}
              >
                <MessageSquare className="h-16 w-16 text-sky-500/50 mb-4" />
                <span>WhatsApp</span>
                {!isConfigured.whatsapp && (
                  <span className="ml-auto text-xs text-sky-500">Setup Required</span>
                )}
              </button>
              
              <button
                onClick={() => setActiveTab('sheets')}
                className={`w-full text-left p-3 rounded-lg flex items-center space-x-3 ${
                  activeTab === 'sheets' ? 'bg-sky-500/10 text-sky-500' : 'hover:bg-sky-500/5'
                }`}
              >
                <FileSpreadsheet className="h-16 w-16 text-sky-500/50 mb-4" />
                <span>Sheets</span>
                {!isConfigured.sheets && (
                  <span className="ml-auto text-xs text-sky-500">Setup Required</span>
                )}
              </button>
            </div>

            {/* Settings */}
            <div className="absolute bottom-4 left-4 w-56">
              <button className="w-full btn-secondary flex items-center justify-center space-x-2">
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </button>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 pl-4 overflow-hidden">
            {/* Email Tab */}
            {activeTab === 'email' && (
              <div className="h-full">
                {!isConfigured.email ? (
                  <div className="flex flex-col items-center justify-center h-full">
                    <Mail className="h-16 w-16 text-sky-500/50 mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">Connect Gmail Account</h3>
                    <p className="text-gray-400 mb-4 text-center max-w-md">
                      Connect your Gmail account to send and receive emails directly from this interface.
                    </p>
                    <button onClick={handleGmailAuth} className="btn-primary">
                      Connect Gmail
                    </button>
                  </div>
                ) : (
                  <div className="h-full">
                    {/* Email interface will go here */}
                  </div>
                )}
              </div>
            )}

            {/* WhatsApp Tab */}
            {activeTab === 'whatsapp' && (
              <div className="h-full">
                {!isConfigured.whatsapp ? (
                  <div className="flex flex-col items-center justify-center h-full">
                    <MessageSquare className="h-16 w-16 text-sky-500/50 mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">Connect WhatsApp</h3>
                    <p className="text-gray-400 mb-4 text-center max-w-md">
                      Link your WhatsApp account to send and receive messages from this interface.
                    </p>
                    <button onClick={handleWhatsAppAuth} className="btn-primary">
                      Connect WhatsApp
                    </button>
                  </div>
                ) : (
                  <div className="h-full">
                    {/* WhatsApp interface will go here */}
                  </div>
                )}
              </div>
            )}

            {/* Sheets Tab */}
            {activeTab === 'sheets' && (
              <div className="h-full">
                {!isConfigured.sheets ? (
                  <div className="flex flex-col items-center justify-center h-full">
                    <FileSpreadsheet className="h-16 w-16 text-sky-500/50 mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">Connect Google Sheets</h3>
                    <p className="text-gray-400 mb-4 text-center max-w-md">
                      Connect your Google Sheets to view and edit spreadsheets directly.
                    </p>
                    <button onClick={handleSheetsAuth} className="btn-primary">
                      Connect Sheets
                    </button>
                  </div>
                ) : (
                  <div className="h-full">
                    {/* Sheets interface will go here */}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}