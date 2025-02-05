import React, { useState, useEffect } from 'react';
import { Mail, MessageSquare, FileSpreadsheet, Settings, X, Plus, LogOut, Reply, ArrowLeft, Send, Loader, RefreshCw, Download, Paperclip, Image, FileText, File, ZoomIn, ZoomOut, Workflow } from 'lucide-react';
import { supabase } from '../lib/supabase';
import DOMPurify from 'dompurify';

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
  selectedImage: string | null;
}

interface EmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
}

interface EmailData {
  id: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
  body?: string;
  bodyHtml?: string;
  attachments?: EmailAttachment[];
  unread?: boolean;
}

interface ImageViewerProps {
  src: string;
  onClose: () => void;
}

function ImageViewer({ src, onClose }: ImageViewerProps) {
  const [zoomed, setZoomed] = useState(false);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={onClose}>
      <div className="absolute top-4 right-4 flex gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setZoomed(!zoomed);
          }}
          className="p-2 rounded-full bg-gray-800/50 hover:bg-gray-800 text-gray-400 hover:text-white"
        >
          {zoomed ? <ZoomOut className="h-5 w-5" /> : <ZoomIn className="h-5 w-5" />}
        </button>
        <button
          onClick={onClose}
          className="p-2 rounded-full bg-gray-800/50 hover:bg-gray-800 text-gray-400 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <img
        src={src}
        alt="Full size preview"
        className={`max-h-[90vh] ${zoomed ? 'max-w-none' : 'max-w-[90vw]'} rounded-lg`}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
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
    composing: null,
    selectedImage: null
  });
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [splitPosition, setSplitPosition] = useState(50); // Percentage
  const [isDragging, setIsDragging] = useState(false);
  const [backendMessage, setBackendMessage] = useState<string>('');

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

  const fetchEmailDetail = async (messageId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.provider_token) return null;

      const response = await fetch(
        `https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`, {
        headers: {
          'Authorization': `Bearer ${session.provider_token}`
        }
      }
      );

      if (!response.ok) return null;
      const data = await response.json();

      // Parse email parts
      const parts = data.payload.parts || [data.payload];
      let bodyText = '';
      let bodyHtml = '';
      const attachments: EmailAttachment[] = [];

      const processMessagePart = (part: any) => {
        const { mimeType, body, filename, headers = [] } = part;

        // Handle nested parts
        if (part.parts) {
          part.parts.forEach(processMessagePart);
          return;
        }

        // Handle attachments
        if (filename && filename.length > 0) {
          attachments.push({
            id: part.body.attachmentId,
            filename,
            mimeType,
            size: body.size,
            attachmentId: body.attachmentId
          });
          return;
        }

        // Handle email body
        if (body.data) {
          const content = atob(body.data.replace(/-/g, '+').replace(/_/g, '/'));
          if (mimeType === 'text/plain') {
            bodyText = content;
          } else if (mimeType === 'text/html') {
            bodyHtml = content;
          }
        }
      };

      parts.forEach(processMessagePart);

      return {
        body: bodyText,
        bodyHtml: bodyHtml,
        attachments
      };
    } catch (error) {
      console.error('Error fetching email detail:', error);
      return null;
    }
  };

  const downloadAttachment = async (messageId: string, attachment: EmailAttachment) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.provider_token) return;

      const response = await fetch(
        `https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachment.attachmentId}`, {
        headers: {
          'Authorization': `Bearer ${session.provider_token}`
        }
      }
      );

      if (!response.ok) throw new Error('Failed to fetch attachment');
      const data = await response.json();

      // Convert base64 to blob
      const binaryData = atob(data.data.replace(/-/g, '+').replace(/_/g, '/'));
      const bytes = new Uint8Array(binaryData.length);
      for (let i = 0; i < binaryData.length; i++) {
        bytes[i] = binaryData.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: attachment.mimeType });

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading attachment:', error);
    }
  };

  // Update the email interface JSX
  const renderEmailInterface = () => {
    if (!isConfigured.email) {
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <Mail className="h-16 w-16 text-green-600/50 mb-4" />
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

    if (emailState.view === 'detail' && emailState.selectedEmail) {
      return (
        <div className="fixed inset-0 z-50 bg-black/95">
          <div className="h-full overflow-y-auto">
            <div className="max-w-5xl mx-auto px-4 py-6">
              {/* Email Header */}
              <div className="flex justify-between items-start mb-8 sticky top-0 bg-black/95 py-4 z-10">
                <div>
                  <h1 className="text-2xl font-bold text-white mb-2">
                    {emailState.selectedEmail.subject}
                  </h1>
                  <div className="flex items-center gap-4 text-gray-400">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-green-600/10 flex items-center justify-center">
                        <span className="text-green-600 font-medium">
                          {emailState.selectedEmail.from.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium">{emailState.selectedEmail.from}</div>
                        <div className="text-sm text-gray-500">{emailState.selectedEmail.date}</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleReply(emailState.selectedEmail!)}
                    className="btn-primary"
                  >
                    <Reply className="h-4 w-4 mr-2" />
                    Reply
                  </button>
                  <button
                    onClick={() => setEmailState(prev => ({ ...prev, view: 'list' }))}
                    className="btn-secondary"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Attachments */}
              {emailState.selectedEmail.attachments?.length > 0 && (
                <div className="mb-8 bg-gray-900/50 rounded-xl p-6">
                  <h3 className="text-sm font-medium text-gray-400 mb-4">
                    Attachments ({emailState.selectedEmail.attachments.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {emailState.selectedEmail.attachments.map((attachment) => (
                      <button
                        key={attachment.id}
                        onClick={() => downloadAttachment(emailState.selectedEmail!.id, attachment)}
                        className="flex items-center gap-3 p-4 bg-gray-800/50 hover:bg-gray-800 rounded-lg transition-colors group"
                      >
                        <div className="p-2 rounded-lg bg-gray-700/50 group-hover:bg-gray-700">
                          {attachment.mimeType.startsWith('image/') ? (
                            <Image className="h-5 w-5 text-green-600" />
                          ) : attachment.mimeType.includes('pdf') ? (
                            <FileText className="h-5 w-5 text-red-500" />
                          ) : (
                            <File className="h-5 w-5 text-yellow-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-gray-300 truncate">
                            {attachment.filename}
                          </div>
                          <div className="text-xs text-gray-500">
                            {Math.round(attachment.size / 1024)}KB
                          </div>
                        </div>
                        <Download className="h-4 w-4 text-gray-400 group-hover:text-white" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Email Body */}
              <div className="bg-gray-900/50 rounded-xl p-8 mb-8">
                {emailState.selectedEmail.bodyHtml ? (
                  <div
                    className="email-content prose prose-invert max-w-none"
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(
                        processHtmlContent(emailState.selectedEmail.bodyHtml),
                        {
                          ALLOWED_TAGS: [
                            'p', 'br', 'strong', 'em', 'u', 'ol', 'ul', 'li',
                            'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote',
                            'a', 'img', 'div', 'span', 'table', 'tr', 'td', 'th'
                          ],
                          ALLOWED_ATTR: [
                            'href', 'src', 'alt', 'style', 'class', 'target',
                            'data-action'
                          ]
                        }
                      )
                    }}
                    onClick={e => {
                      const target = e.target as HTMLElement;
                      if (target.tagName === 'IMG' && target.getAttribute('data-action') === 'zoom') {
                        handleImageClick(e as any);
                      }
                    }}
                  />
                ) : (
                  <pre className="whitespace-pre-wrap font-sans text-gray-300">
                    {emailState.selectedEmail.body || emailState.selectedEmail.snippet}
                  </pre>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="h-full p-4">
        {/* Header with user info and actions */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Mail className="h-5 w-5 text-green-600" />
            <span className="text-white">{userEmail}</span>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={handleComposeNew}
              className="btn-primary flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>Compose</span>
            </button>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                setIsConfigured(prev => ({ ...prev, email: false }));
                setUserEmail(null);
                setEmails([]);
              }}
              className="btn-danger"
            >
              <LogOut className="h-4 w-4 mr-2" />
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
            className="input-primary"
          />
        </div>

        {/* Email Content Area */}
        <div className="h-full flex flex-col">
          <div className="overflow-hidden flex-grow flex flex-col min-h-0">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
              </div>
            ) : emailState.view === 'compose' ? (
              <div className="p-4 overflow-y-auto bg-neutral-800/30 rounded-lg border border-green-600/20">
                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="To"
                    value={emailState.composing?.to || ''}
                    onChange={(e) => setEmailState(prev => ({
                      ...prev,
                      composing: { ...prev.composing!, to: e.target.value }
                    }))}
                    className="input-primary"
                  />
                  <input
                    type="text"
                    placeholder="CC"
                    value={emailState.composing?.cc || ''}
                    onChange={(e) => setEmailState(prev => ({
                      ...prev,
                      composing: { ...prev.composing!, cc: e.target.value }
                    }))}
                    className="input-primary"
                  />
                  <input
                    type="text"
                    placeholder="BCC"
                    value={emailState.composing?.bcc || ''}
                    onChange={(e) => setEmailState(prev => ({
                      ...prev,
                      composing: { ...prev.composing!, bcc: e.target.value }
                    }))}
                    className="input-primary"
                  />
                  <input
                    type="text"
                    placeholder="Subject"
                    value={emailState.composing?.subject || ''}
                    onChange={(e) => setEmailState(prev => ({
                      ...prev,
                      composing: { ...prev.composing!, subject: e.target.value }
                    }))}
                    className="input-primary"
                  />
                  <textarea
                    placeholder="Message"
                    value={emailState.composing?.body || ''}
                    onChange={(e) => setEmailState(prev => ({
                      ...prev,
                      composing: { ...prev.composing!, body: e.target.value }
                    }))}
                    className="input-primary h-64 px-3 py-2 bg-neutral-900/30 border border-green-600/20 rounded text-white resize-none"
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
                      <Send className="h-4 w-4 mr-2" />
                      Send
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col h-[96%] min-h-0 justify-between">
                <div className={`h-${hasMore ? "[85%]" : "full"} divide-y divide-green-600/10 overflow-y-auto flex-grow bg-neutral-800/30 rounded-md border border-green-600/20`}>
                  {emails.map((email) => (
                    <div
                      key={email.id}
                      className={`p-4 hover:bg-green-600/5 cursor-pointer ${email.unread ? 'bg-green-600/10' : ''
                        }`}
                      onClick={async () => {
                        const emailData = await fetchEmailDetail(email.id);
                        setEmailState(prev => ({
                          ...prev,
                          view: 'detail',
                          selectedEmail: { ...email, ...emailData }
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
                </div>

                {hasMore && (
                  <div className="h-[15%] flex-shrink-0 border-t border-green-600/10 py-2">
                    <button
                      onClick={loadMoreEmails}
                      className="btn-secondary w-full rounded-none"
                      disabled={loading}
                    >
                      {loading ? (
                        <span className="flex items-center justify-center">
                          <Loader className="h-4 w-4 animate-spin mr-2" />
                          Loading...
                        </span>
                      ) : (
                        <span className="flex items-center justify-center">
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Load More
                        </span>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );

  };

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    e.stopPropagation();
    const src = e.currentTarget.src;
    setEmailState(prev => ({ ...prev, selectedImage: src }));
  };

  const processHtmlContent = (html: string) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');

    // Process images to make them clickable
    doc.querySelectorAll('img').forEach(img => {
      img.classList.add('cursor-zoom-in', 'hover:opacity-90', 'transition-opacity');
      img.setAttribute('data-action', 'zoom');
    });

    // Fix relative URLs in images
    doc.querySelectorAll('img[src^="cid:"]').forEach(img => {
      const contentId = img.getAttribute('src')?.replace('cid:', '');
      const attachment = emailState.selectedEmail?.attachments?.find(
        att => att.contentId === contentId
      );
      if (attachment?.dataUrl) {
        img.setAttribute('src', attachment.dataUrl);
      }
    });

    return doc.body.innerHTML;
  };

  // Add these handlers
  const handleDragStart = (e: React.MouseEvent) => {
    setIsDragging(true);
    e.preventDefault(); // Prevent text selection while dragging
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleDrag = (e: MouseEvent) => {
    if (!isDragging) return;

    const container = document.getElementById('split-container');
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const mouseX = e.clientX - containerRect.left;

    // Calculate percentage (constrain between 20% and 80%)
    const newPosition = Math.min(Math.max((mouseX / containerWidth) * 100, 20), 80);
    setSplitPosition(newPosition);
  };

  // Add event listeners
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDrag);
      window.addEventListener('mouseup', handleDragEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleDrag);
      window.removeEventListener('mouseup', handleDragEnd);
    };
  }, [isDragging]);

  // Add the fetch useEffect
  useEffect(() => {
    const fetchBackendMessage = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/test');
        const data = await response.json();
        setBackendMessage(data.message);
      } catch (error) {
        console.error('Error fetching from backend:', error);
      }
    };

    fetchBackendMessage();
  }, []);

  return (
    <div className="min-h-screen bg-neutral-900">
      {/* Top Navigation Bar */}
      <div className="bg-neutral-800/50 px-4 py-3">
        <div className="flex items-center justify-between relative">
          <div className="flex items-center space-x-3">
            <div className="logo-icon">
              <Workflow className="h-6 w-6" />
            </div>
            <span className="text-lg font-bold text-white">MSME Flow</span>
            {backendMessage && (
              <div className="ml-4 px-3 py-1 bg-green-600/10 rounded-full text-green-500">
                {backendMessage}
              </div>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={async () => {
                await supabase.auth.signOut();
              }}
              className="btn-secondary flex items-center space-x-2"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-800/50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Split View Container */}
      <div
        id="split-container"
        className="h-[calc(100vh-4rem)] flex relative"
        style={{ cursor: isDragging ? 'col-resize' : 'auto' }}
      >
        {/* Email Section */}
        <div
          className="h-full border-r border-neutral-700 overflow-hidden"
          style={{ width: `${splitPosition}%` }}
        >
          <div className="h-full">
            {!isConfigured.email ? (
              <div className="flex flex-col items-center justify-center h-full">
                <Mail className="h-16 w-16 text-green-600/50 mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">Connect Gmail Account</h3>
                <p className="text-gray-400 mb-4 text-center max-w-md">
                  Connect your Gmail account to send and receive emails directly.
                </p>
                <button onClick={handleGmailAuth} className="btn-primary">
                  Connect Gmail
                </button>
              </div>
            ) : (
              <div className="h-full">
                {renderEmailInterface()}
              </div>
            )}
          </div>
        </div>

        {/* Draggable Divider */}
        <div
          className="absolute h-full w-1 cursor-col-resize group"
          style={{
            left: `${splitPosition}%`,
            transform: 'translateX(-50%)',
          }}
          onMouseDown={handleDragStart}
        >
          <div className={`
            absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
            w-4 h-24 rounded-full bg-green-600/10 opacity-0 
            group-hover:opacity-100 transition-opacity
            ${isDragging ? 'opacity-100' : ''}
          `}>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-0.5 h-12 bg-green-600/50 rounded-full" />
            </div>
          </div>
        </div>

        {/* WhatsApp Section */}
        <div
          className="h-full overflow-hidden"
          style={{ width: `${100 - splitPosition}%` }}
        >
          <div className="h-full">
            {!isConfigured.whatsapp ? (
              <div className="flex flex-col items-center justify-center h-full">
                <MessageSquare className="h-16 w-16 text-green-600/50 mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">Connect WhatsApp</h3>
                <p className="text-gray-400 mb-4 text-center max-w-md">
                  Link your WhatsApp account to send and receive messages directly.
                </p>
                <button onClick={handleWhatsAppAuth} className="btn-primary">
                  Connect WhatsApp
                </button>
              </div>
            ) : (
              <div className="h-full p-4">
                {/* WhatsApp interface will go here */}
                <div className="bg-gray-900/50 rounded-lg h-full p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-white">WhatsApp Messages</h2>
                    <span className="text-sm text-gray-400">Connected</span>
                  </div>
                  {/* WhatsApp content will go here */}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Image Viewer Modal */}
      {emailState.selectedImage && (
        <ImageViewer
          src={emailState.selectedImage}
          onClose={() => setEmailState(prev => ({ ...prev, selectedImage: null }))}
        />
      )}
    </div>
  );
}