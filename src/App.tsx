import React, { useState, useEffect } from 'react';
import { Workflow, ArrowRight, Settings, FileText, Sparkles, MessageSquare } from 'lucide-react';
import { LoginModal } from './components/LoginModal';
import { SignUpModal } from './components/SignUpModal';
import { FileUploader } from './components/FileUploader';
import { Dashboard } from './components/Dashboard';
import { FileViewer } from './components/FileViewer';
import { QuoteGenerator } from './components/QuoteGenerator';
import { UnifiedCommunication } from './components/UnifiedCommunication';
import { supabase } from './lib/supabase';
import { WelcomeSplash } from './components/WelcomeSplash';
import { AuthCallback } from './pages/AuthCallback';

interface UploadedFile {
  name: string;
  type: string;
  uploadDate: string;
  size: string;
  url?: string;
  path?: string;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

export default function App() {
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isSignUpOpen, setIsSignUpOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [showDashboard, setShowDashboard] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [showUploader, setShowUploader] = useState(false);
  const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [showUnifiedComm, setShowUnifiedComm] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      loadUserFiles();
    }
  }, [user]);

  const loadUserFiles = async () => {
    if (isLoadingFiles) return;
    
    try {
      setIsLoadingFiles(true);

      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        setUploadedFiles([]);
        return;
      }

      const { data: files, error } = await supabase.storage
        .from('excel-files')
        .list(user.id, {
          limit: 100,
          sortBy: { column: 'created_at', order: 'desc' },
        });

      if (error) throw error;

      if (!files) {
        setUploadedFiles([]);
        return;
      }

      const formattedFiles = await Promise.all(files.map(async (file) => {
        const { data: { publicUrl } } = supabase.storage
          .from('excel-files')
          .getPublicUrl(`${user.id}/${file.name}`);

        return {
          name: file.name,
          type: file.name.toLowerCase().endsWith('.pdf') ? 'PDF' : 'Excel',
          uploadDate: new Date(file.created_at).toLocaleDateString(),
          size: formatFileSize(file.metadata?.size || 0),
          url: publicUrl,
          path: `${user.id}/${file.name}`
        };
      }));

      setUploadedFiles(formattedFiles);
    } catch (error) {
      console.error('Error loading files:', error);
      setUploadedFiles([]);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleUploadComplete = async (file: File) => {
    const newFile = {
      name: file.name,
      type: file.type.includes('pdf') ? 'PDF' : 'Excel',
      uploadDate: new Date().toLocaleDateString(),
      size: formatFileSize(file.size)
    };

    setShowDashboard(true);
    setShowUploader(false);
    await loadUserFiles();
  };

  const handleDeleteComplete = async () => {
    setTimeout(loadUserFiles, 500);
  };

  const handleFileUpdate = async () => {
    setTimeout(loadUserFiles, 500);
  };

  if (window.location.pathname === '/auth/callback') {
    return <AuthCallback />;
  }

  if (showUnifiedComm) {
    return <UnifiedCommunication onClose={() => setShowUnifiedComm(false)} />;
  }

  return (
    <div className="min-h-screen bg-black">
      {showWelcome && <WelcomeSplash onComplete={() => setShowWelcome(false)} />}
      <div className="relative isolate">
        {!user ? (
          <>
            {/* Navigation */}
            <nav className="absolute w-full top-0 z-10">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-20">
                  <div className="logo-container">
                    <div className="logo-icon">
                      <Workflow className="h-8 w-8" />
                    </div>
                    <div className="logo-text">
                      <span className="text-xl font-bold text-white">MSME Flow</span>
                      <span className="text-sm text-gray-400">Business Operations Platform</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={() => setIsLoginOpen(true)}
                      className="btn-secondary"
                    >
                      Login
                    </button>
                    <button
                      onClick={() => setIsSignUpOpen(true)}
                      className="btn-primary"
                    >
                      Get Started
                    </button>
                  </div>
                </div>
              </div>
            </nav>

            {/* Hero Section */}
            <div className="relative pt-14">
              <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80">
                {/* ... gradient background ... */}
              </div>
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 text-center hero-content">
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold">
                  <span className="block mb-2">Streamline Your Business</span>
                  <span className="block text-sky-500">Operations in One Place</span>
                </h1>
                <p className="mt-6 max-w-2xl mx-auto text-lg sm:text-xl text-gray-400">
                  The ultimate platform for Indian MSMEs to manage quotations, vendors, leads, and communications - all in one unified interface.
                </p>
                <div className="mt-10">
                  <button
                    onClick={() => setIsSignUpOpen(true)}
                    className="btn-primary text-lg px-8 py-3"
                  >
                    Get Started
                  </button>
                </div>
              </div>

              {/* Features Section */}
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
                <div className="text-center scroll-fade-in">
                  <h2 className="text-3xl font-bold text-white mb-4">
                    Everything You Need to Grow Your Business
                  </h2>
                </div>

                <div className="mt-16">
                  <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                    {[
                      {
                        icon: FileText,
                        title: "Quick Quotations",
                        description: "Generate and manage quotations specific to your business needs instantly."
                      },
                      {
                        icon: Settings,
                        title: "Vendor Management",
                        description: "Send RFQs and manage your vendor relationships efficiently."
                      },
                      {
                        icon: FileText,
                        title: "Unified Communication",
                        description: "WhatsApp and email integration for seamless communication."
                      }
                    ].map((feature, index) => (
                      <div key={index} className="feature-card scroll-fade-in">
                        <div className="feature-icon">
                          <feature.icon className="h-6 w-6" />
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                        <p className="text-gray-400">
                          {feature.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Navigation */}
            <nav className="glass border-b border-sky-500/20">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16 items-center">
                  <div className="flex-shrink-0 flex items-center space-x-3">
                    <div className="logo-container">
                      <div className="logo-icon">
                        <Workflow className="h-8 w-8" />
                        <Sparkles className="h-4 w-4 absolute -top-1 -right-1" />
                      </div>
                      <div className="logo-text">
                        <span className="text-xl font-bold bg-gradient-to-r from-sky-400 via-sky-500 to-sky-600 text-transparent bg-clip-text">
                          FlowMSME
                        </span>
                        <span className="text-xs text-sky-500/60 block -mt-1">Business Accelerator</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={() => setShowUnifiedComm(true)}
                      className="btn-secondary"
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Unified UI
                    </button>
                    <button
                      onClick={() => setShowDashboard(!showDashboard)}
                      className="btn-secondary"
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Settings
                    </button>
                    <button
                      onClick={() => supabase.auth.signOut()}
                      className="btn-secondary"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              </div>
            </nav>

            {user ? (
              showDashboard ? (
                <Dashboard 
                  files={uploadedFiles} 
                  onUploadClick={() => setShowUploader(true)}
                  onDeleteComplete={handleDeleteComplete}
                  onFileView={(file) => setSelectedFile(file)}
                  onFileUpdate={handleFileUpdate}
                />
              ) : (
                <QuoteGenerator 
                  onUploadClick={() => setShowUploader(true)}
                  onViewExcel={(file) => setSelectedFile(file)}
                />
              )
            ) : (
              <>
                {/* Hero Section */}
                <div className="relative overflow-hidden">
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 text-center hero-content">
                    <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold">
                      <span className="block mb-2">Streamline Your Business</span>
                      <span className="block text-sky-500">Operations in One Place</span>
                    </h1>
                    <p className="mt-6 max-w-2xl mx-auto text-lg sm:text-xl text-gray-400">
                      The ultimate platform for Indian MSMEs to manage quotations, vendors, leads, and communications - all in one unified interface.
                    </p>
                    <div className="mt-10">
                      <button
                        onClick={() => setIsSignUpOpen(true)}
                        className="btn-primary inline-flex items-center"
                      >
                        Get Started
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Features Section with scroll animations */}
                <div className="py-16 border-t border-sky-500/20">
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center scroll-fade-in">
                      <h2 className="text-3xl font-bold text-white mb-4">
                        Everything You Need to Grow Your Business
                      </h2>
                    </div>

                    <div className="mt-16">
                      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                        {[
                          {
                            icon: FileText,
                            title: "Quick Quotations",
                            description: "Generate and manage quotations specific to your business needs instantly."
                          },
                          {
                            icon: Settings,
                            title: "Vendor Management",
                            description: "Send RFQs and manage your vendor relationships efficiently."
                          },
                          {
                            icon: FileText,
                            title: "Unified Communication",
                            description: "WhatsApp and email integration for seamless communication."
                          }
                        ].map((feature, index) => (
                          <div key={index} className="feature-card scroll-fade-in">
                            <div className="feature-icon">
                              <feature.icon className="h-6 w-6" />
                            </div>
                            <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                            <p className="text-gray-400">
                              {feature.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* Modals */}
        <LoginModal 
          isOpen={isLoginOpen}
          onClose={() => setIsLoginOpen(false)}
          onSignUpClick={() => {
            setIsLoginOpen(false);
            setIsSignUpOpen(true);
          }}
        />
        <SignUpModal
          isOpen={isSignUpOpen}
          onClose={() => setIsSignUpOpen(false)}
          onSuccess={() => {
            setIsSignUpOpen(false);
            setIsLoginOpen(true);
          }}
        />
        {showUploader && (
          <FileUploader 
            onUploadComplete={handleUploadComplete}
            onCancel={() => setShowUploader(false)}
          />
        )}
        {selectedFile && (
          <FileViewer
            url={selectedFile.url || ''}
            type={selectedFile.type}
            onClose={() => setSelectedFile(null)}
            onUpdate={handleFileUpdate}
            data={selectedFile.data}
          />
        )}
      </div>
    </div>
  );
}