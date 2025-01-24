import React, { useState, useEffect } from 'react';
import { Mail, MessageSquare, FileSpreadsheet, Settings, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface UnifiedCommunicationProps {
  onClose: () => void;
}

interface EmailMessage {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  unread?: boolean;
  body?: string;
  to?: string[];
  cc?: string[];
  bcc?: string[];
}

interface EmailState {
  view: 'list' | 'detail' | 'compose';
  selectedEmail: EmailMessage | null;
  searchQuery: string;
  composing: {
    to: string;
    subject: string;
    body: string;
    replyTo?: EmailMessage;
    cc?: string[];
    bcc?: string[];
  } | null;
}

export function UnifiedCommunication({ onClose }: UnifiedCommunicationProps) {
  const [activeTab, setActiveTab] = useState<'email' | 'whatsapp' | 'sheets'>('email');
  const [isConfigured, setIsConfigured] = useState({
    email: false,
    whatsapp: false,
    sheets: false
  });
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [emailState, setEmailState] = useState<EmailState>({
    view: 'list',
    selectedEmail: null,
    searchQuery: '',
    composing: null
  });
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // Check if user is already authenticated with Google
  useEffect(() => {
    checkGoogleAuth();
  }, []);

  // Add auth state listener
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.provider_token && session?.user?.email) {
        setIsConfigured(prev => ({ ...prev, email: true }));
        setUserEmail(session.user.email);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const checkGoogleAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.provider_token && session?.user?.email) {
      setIsConfigured(prev => ({ ...prev, email: true }));
      setUserEmail(session.user.email);
    }
  };

  const handleGmailAuth = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
            scope: [
              'email',
              'https://www.googleapis.com/auth/gmail.readonly',
              'https://www.googleapis.com/auth/gmail.send',
              'https://www.googleapis.com/auth/gmail.modify',
              'https://www.googleapis.com/auth/gmail.labels'
            ].join(' ')
          }
        }
      });

      if (error) {
        console.error('Auth error:', error);
        return;
      }

      if (data?.url) {
        const popup = window.open(
          data.url,
          'googleOAuth',
          'width=600,height=800,left=400,top=100'
        );

        // Poll for auth completion
        const checkAuth = setInterval(async () => {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.provider_token && session?.user?.email) {
              clearInterval(checkAuth);
              setIsConfigured(prev => ({ ...prev, email: true }));
              setUserEmail(session.user.email);
              popup?.close();
            }
          } catch (err) {
            console.error('Error checking auth:', err);
          }
        }, 1000);

        // Clear interval if popup closes
        const pollTimer = setInterval(() => {
          if (popup?.closed) {
            clearInterval(pollTimer);
            clearInterval(checkAuth);
          }
        }, 500);
      }
    } catch (err) {
      console.error('Failed to initiate OAuth:', err);
    }
  };

  const handleWhatsAppAuth = () => {
    window.open('https://web.whatsapp.com', '_blank');
  };

  const handleSheetsAuth = handleGmailAuth; // Use the same OAuth flow

  const fetchEmails = async () => {
    if (!isConfigured.email) return;
    
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.provider_token) {
        console.error('No provider token found');
        return;
      }

      // First, test the token with a simple request
      try {
        const testResponse = await fetch('https://www.googleapis.com/gmail/v1/users/me/profile', {
          headers: {
            'Authorization': `Bearer ${session.provider_token}`
          }
        });
        
        if (!testResponse.ok) {
          const errorData = await testResponse.json();
          console.error('Gmail API error:', errorData);
          return;
        }
      } catch (error) {
        console.error('Error testing Gmail API:', error);
        return;
      }

      // Fetch messages list
      const response = await fetch('https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=20', {
        headers: {
          'Authorization': `Bearer ${session.provider_token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Gmail API error:', errorData);
        return;
      }

      const data = await response.json();
      console.log('Messages data:', data); // Debug log
      
      if (!data.messages || !Array.isArray(data.messages)) {
        console.error('Unexpected response format:', data);
        return;
      }

      // Fetch details for each email
      const emailDetails = await Promise.all(
        data.messages.map(async (message: { id: string }) => {
          const detailResponse = await fetch(
            `https://www.googleapis.com/gmail/v1/users/me/messages/${message.id}`, {
              headers: {
                'Authorization': `Bearer ${session.provider_token}`
              }
            }
          );

          if (!detailResponse.ok) {
            console.error(`Error fetching message ${message.id}:`, await detailResponse.json());
            return null;
          }

          const detail = await detailResponse.json();
          console.log('Message detail:', detail); // Debug log
          
          // Parse email details
          const headers = detail.payload?.headers || [];
          const subject = headers.find((h: any) => h.name === 'Subject')?.value || 'No Subject';
          const from = headers.find((h: any) => h.name === 'From')?.value || '';
          const date = headers.find((h: any) => h.name === 'Date')?.value || '';
          
          return {
            id: message.id,
            subject,
            from,
            date: new Date(date).toLocaleString(),
            snippet: detail.snippet || '',
            unread: detail.labelIds?.includes('UNREAD') || false
          };
        })
      );

      // Filter out null values and set emails
      const validEmails = emailDetails.filter((email): email is EmailMessage => email !== null);
      console.log('Processed emails:', validEmails); // Debug log
      setEmails(validEmails);
    } catch (error) {
      console.error('Error fetching emails:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch emails when configured
  useEffect(() => {
    if (isConfigured.email) {
      fetchEmails();
    }
  }, [isConfigured.email]);

  // Add email action handlers
  const handleComposeNew = () => {
    setEmailState(prev => ({
      ...prev,
      view: 'compose',
      composing: {
        to: '',
        subject: '',
        body: ''
      }
    }));
  };

  const handleReply = (email: EmailMessage) => {
    setEmailState(prev => ({
      ...prev,
      view: 'compose',
      composing: {
        to: email.from,
        subject: `Re: ${email.subject}`,
        body: `\n\n---Original Message---\nFrom: ${email.from}\nDate: ${email.date}\n${email.snippet}`,
        replyTo: email
      }
    }));
  };

  const handleSearch = (query: string) => {
    setEmailState(prev => ({ ...prev, searchQuery: query }));
    // Filter emails based on search query
    if (query) {
      const filtered = emails.filter(email => 
        email.subject.toLowerCase().includes(query.toLowerCase()) ||
        email.from.toLowerCase().includes(query.toLowerCase()) ||
        email.snippet.toLowerCase().includes(query.toLowerCase())
      );
      setEmails(filtered);
    } else {
      fetchEmails(); // Reset to all emails
    }
  };

  const handleSendEmail = async (email: typeof emailState.composing) => {
    if (!email) return;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.provider_token) return;

      // Construct email in RFC 2822 format
      const message = [
        `To: ${email.to}`,
        `Subject: ${email.subject}`,
        'Content-Type: text/plain; charset=utf-8',
        'MIME-Version: 1.0',
        '',
        email.body
      ].join('\r\n');

      // Encode the email in base64
      const encodedMessage = btoa(message).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      const response = await fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.provider_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          raw: encodedMessage
        })
      });

      if (!response.ok) throw new Error('Failed to send email');

      // Reset compose state and refresh emails
      setEmailState(prev => ({ ...prev, view: 'list', composing: null }));
      fetchEmails();
    } catch (error) {
      console.error('Error sending email:', error);
    }
  };

  // Add this function to load more emails
  const loadMoreEmails = async () => {
    if (!hasMore || loading) return;
    
    const nextPage = page + 1;
    const pageSize = 20;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.provider_token) return;

      const response = await fetch(
        `https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=${pageSize}&pageToken=${nextPage}`,
        {
          headers: {
            'Authorization': `Bearer ${session.provider_token}`
          }
        }
      );

      const data = await response.json();
      if (!data.messages) {
        setHasMore(false);
        return;
      }

      // Fetch and process new emails...
      const newEmails = await Promise.all(
        data.messages.map(async (message: { id: string }) => {
          const detailResponse = await fetch(
            `https://www.googleapis.com/gmail/v1/users/me/messages/${message.id}`, {
              headers: {
                'Authorization': `Bearer ${session.provider_token}`
              }
            }
          );

          if (!detailResponse.ok) {
            console.error(`Error fetching message ${message.id}:`, await detailResponse.json());
            return null;
          }

          const detail = await detailResponse.json();
          console.log('Message detail:', detail); // Debug log
          
          // Parse email details
          const headers = detail.payload?.headers || [];
          const subject = headers.find((h: any) => h.name === 'Subject')?.value || 'No Subject';
          const from = headers.find((h: any) => h.name === 'From')?.value || '';
          const date = headers.find((h: any) => h.name === 'Date')?.value || '';
          
          return {
            id: message.id,
            subject,
            from,
            date: new Date(date).toLocaleString(),
            snippet: detail.snippet || '',
            unread: detail.labelIds?.includes('UNREAD') || false
          };
        })
      );
      setEmails(prev => [...prev, ...newEmails.filter(email => email !== null)]);
      setPage(nextPage);
      setHasMore(!!data.nextPageToken);
    } catch (error) {
      console.error('Error loading more emails:', error);
    }
  };

  // Add function to fetch email detail
  const fetchEmailDetail = async (emailId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.provider_token) return;

      const response = await fetch(
        `https://www.googleapis.com/gmail/v1/users/me/messages/${emailId}?format=full`,
        {
          headers: {
            'Authorization': `Bearer ${session.provider_token}`
          }
        }
      );

      const data = await response.json();
      
      // Parse email body
      const body = data.payload.parts?.find(
        (part: any) => part.mimeType === 'text/plain'
      )?.body?.data;

      if (body) {
        const decodedBody = atob(body.replace(/-/g, '+').replace(/_/g, '/'));
        return decodedBody;
      }
      
      return '';
    } catch (error) {
      console.error('Error fetching email detail:', error);
      return '';
    }
  };

  // Update the email interface JSX
  const renderEmailInterface = () => {
    if (!isConfigured.email) {
      return (
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
      );
    }

    return (
      <div className="h-full p-4">
        {/* Header with user info and actions */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Mail className="h-5 w-5 text-sky-500" />
            <span className="text-white">{userEmail}</span>
          </div>
          <div className="flex items-center space-x-4">
            <button 
              onClick={handleComposeNew}
              className="btn-primary text-sm"
            >
              Compose
            </button>
            <button 
              onClick={async () => {
                await supabase.auth.signOut();
                setIsConfigured(prev => ({ ...prev, email: false }));
                setUserEmail(null);
                setEmails([]);
              }}
              className="text-red-500 hover:text-red-400 text-sm"
            >
              Disconnect
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search emails..."
            value={emailState.searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full px-4 py-2 bg-black/30 border border-sky-500/20 rounded-lg focus:outline-none focus:border-sky-500/50 text-white"
          />
        </div>

        {/* Email Content Area */}
        <div className="bg-black/30 rounded-lg border border-sky-500/20 h-[calc(100%-8rem)] overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
            </div>
          ) : emailState.view === 'compose' ? (
            <div className="p-4">
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="To"
                  value={emailState.composing?.to || ''}
                  onChange={(e) => setEmailState(prev => ({
                    ...prev,
                    composing: { ...prev.composing!, to: e.target.value }
                  }))}
                  className="w-full px-3 py-2 bg-black/30 border border-sky-500/20 rounded text-white"
                />
                <input
                  type="text"
                  placeholder="CC"
                  value={emailState.composing?.cc || ''}
                  onChange={(e) => setEmailState(prev => ({
                    ...prev,
                    composing: { ...prev.composing!, cc: e.target.value }
                  }))}
                  className="w-full px-3 py-2 bg-black/30 border border-sky-500/20 rounded text-white"
                />
                <input
                  type="text"
                  placeholder="BCC"
                  value={emailState.composing?.bcc || ''}
                  onChange={(e) => setEmailState(prev => ({
                    ...prev,
                    composing: { ...prev.composing!, bcc: e.target.value }
                  }))}
                  className="w-full px-3 py-2 bg-black/30 border border-sky-500/20 rounded text-white"
                />
                <input
                  type="text"
                  placeholder="Subject"
                  value={emailState.composing?.subject || ''}
                  onChange={(e) => setEmailState(prev => ({
                    ...prev,
                    composing: { ...prev.composing!, subject: e.target.value }
                  }))}
                  className="w-full px-3 py-2 bg-black/30 border border-sky-500/20 rounded text-white"
                />
                <textarea
                  placeholder="Message"
                  value={emailState.composing?.body || ''}
                  onChange={(e) => setEmailState(prev => ({
                    ...prev,
                    composing: { ...prev.composing!, body: e.target.value }
                  }))}
                  className="w-full h-64 px-3 py-2 bg-black/30 border border-sky-500/20 rounded text-white resize-none"
                />
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setEmailState(prev => ({ ...prev, view: 'list', composing: null }))}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleSendEmail(emailState.composing)}
                    className="btn-primary"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          ) : emailState.view === 'detail' && emailState.selectedEmail ? (
            <div className="p-4 h-full overflow-y-auto">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl font-bold text-white mb-2">
                    {emailState.selectedEmail.subject}
                  </h2>
                  <div className="space-y-1">
                    <p className="text-gray-400">
                      <span className="text-gray-500">From:</span> {emailState.selectedEmail.from}
                    </p>
                    <p className="text-gray-400">
                      <span className="text-gray-500">Date:</span> {emailState.selectedEmail.date}
                    </p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleReply(emailState.selectedEmail!)}
                    className="btn-secondary text-sm"
                  >
                    Reply
                  </button>
                  <button
                    onClick={() => setEmailState(prev => ({ ...prev, view: 'list' }))}
                    className="btn-secondary text-sm"
                  >
                    Back
                  </button>
                </div>
              </div>
              
              <div className="prose prose-invert max-w-none">
                {emailState.selectedEmail.body || emailState.selectedEmail.snippet}
              </div>
            </div>
          ) : (
            <div className="divide-y divide-sky-500/10 overflow-y-auto h-full">
              {emails.map((email) => (
                <div 
                  key={email.id}
                  className={`p-4 hover:bg-sky-500/5 cursor-pointer ${
                    email.unread ? 'bg-sky-500/10' : ''
                  }`}
                  onClick={async () => {
                    const body = await fetchEmailDetail(email.id);
                    setEmailState(prev => ({
                      ...prev,
                      view: 'detail',
                      selectedEmail: { ...email, body }
                    }));
                  }}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-white font-medium">{email.from}</span>
                    <span className="text-gray-400 text-sm">{email.date}</span>
                  </div>
                  <div className="text-white mb-1">{email.subject}</div>
                  <div className="text-gray-400 text-sm truncate">{email.snippet}</div>
                </div>
              ))}
              
              {hasMore && (
                <div className="p-4 text-center">
                  <button
                    onClick={loadMoreEmails}
                    className="btn-secondary text-sm"
                    disabled={loading}
                  >
                    {loading ? 'Loading...' : 'Load More'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

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
                {renderEmailInterface()}
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