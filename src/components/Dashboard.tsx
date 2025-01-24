import React, { useState } from 'react';
import { BarChart3, FileText, FileUp, PieChart, ArrowUpRight, Download, Eye, Trash2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface DashboardProps {
  files: {
    name: string;
    type: string;
    uploadDate: string;
    size: string;
    url?: string;
    path?: string;
  }[];
  onUploadClick: () => void;
  onDeleteComplete: () => void;
  onFileView: (file: any) => void;
  onFileUpdate?: () => void;  // Add callback for file updates
}

export function Dashboard({ files, onUploadClick, onDeleteComplete, onFileView, onFileUpdate }: DashboardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [localFiles, setLocalFiles] = useState(files);

  // Update local files when props change
  React.useEffect(() => {
    setLocalFiles(files);
  }, [files]);

  const handleFileDelete = async (filePath?: string) => {
    if (!filePath) {
      setDeleteError('Invalid file path');
      return;
    }
    
    try {
      setDeletingFileId(filePath);
      setIsDeleting(true);
      setDeleteError('');

      // Immediately update local state for visual feedback
      setLocalFiles(prevFiles => prevFiles.filter(file => file.path !== filePath));

      const { error: deleteError } = await supabase.storage
        .from('excel-files')
        .remove([filePath]);

      if (deleteError) {
        // If deletion fails, revert the local state
        setLocalFiles(files);
        throw deleteError;
      }

      // Notify parent component to refresh the file list
      await onDeleteComplete();
      
    } catch (err: any) {
      console.error('Delete error:', err);
      setDeleteError(err.message || 'Error deleting file');
    } finally {
      setDeletingFileId(null);
      setIsDeleting(false);
    }
  };

  const handleFileView = (file: any) => {
    onFileView({
      ...file,
      onUpdate: onFileUpdate || onDeleteComplete // Use onFileUpdate if provided, fall back to onDeleteComplete
    });
  };

  const truncateFileName = (name: string, maxLength: number = 30) => {
    if (name.length <= maxLength) return name;
    const extension = name.split('.').pop();
    const nameWithoutExt = name.slice(0, name.lastIndexOf('.'));
    return `${nameWithoutExt.slice(0, maxLength - 3)}...${extension}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="dashboard-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 mb-1">Total Files</p>
              <p className="dashboard-stat">{localFiles.length}</p>
            </div>
            <div className="feature-icon">
              <FileText className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-4">
            <div className="progress-bar">
              <div className="progress-bar-fill" style={{ width: '70%' }}></div>
            </div>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 mb-1">Processing Status</p>
              <p className="dashboard-stat">85%</p>
            </div>
            <div className="feature-icon">
              <PieChart className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-4">
            <div className="progress-bar">
              <div className="progress-bar-fill" style={{ width: '85%' }}></div>
            </div>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 mb-1">Analysis Complete</p>
              <p className="dashboard-stat">60%</p>
            </div>
            <div className="feature-icon">
              <BarChart3 className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-4">
            <div className="progress-bar">
              <div className="progress-bar-fill" style={{ width: '60%' }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* Upload More Section */}
      <div className="dashboard-card mb-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white">Add More Files</h3>
          <button 
            className="btn-secondary inline-flex items-center"
            onClick={onUploadClick}
          >
            <FileUp className="h-4 w-4 mr-2" />
            Upload Files
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="glass p-4 rounded-lg border-dashed border-2 border-sky-500/30 hover:border-sky-500/50 transition-colors">
            <p className="text-sky-500 font-medium mb-2">Excel Documents</p>
            <p className="text-gray-400 text-sm">Upload Excel files for processing</p>
          </div>
          <div className="glass p-4 rounded-lg border-dashed border-2 border-sky-500/30 hover:border-sky-500/50 transition-colors">
            <p className="text-sky-500 font-medium mb-2">PDF Documents</p>
            <p className="text-gray-400 text-sm">Upload PDF files for reference</p>
          </div>
        </div>
      </div>

      {/* Files List */}
      <div className="dashboard-card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white">Uploaded Files</h3>
          <button className="btn-secondary inline-flex items-center">
            <Download className="h-4 w-4 mr-2" />
            Export All
          </button>
        </div>

        {deleteError && (
          <div className="bg-red-900/50 text-red-200 p-3 rounded mb-4 border border-red-500/20 flex items-center justify-between">
            <span>{deleteError}</span>
            <button onClick={() => setDeleteError('')} className="text-red-200 hover:text-red-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left py-3 text-gray-400 font-medium w-2/5">File Name</th>
                <th className="text-left py-3 text-gray-400 font-medium w-1/5">Type</th>
                <th className="text-left py-3 text-gray-400 font-medium w-1/5">Upload Date</th>
                <th className="text-left py-3 text-gray-400 font-medium w-1/5">Size</th>
                <th className="text-right py-3 text-gray-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {localFiles.map((file, index) => (
                <tr key={index} className="border-b border-gray-800/50 hover:bg-yellow-500/5">
                  <td className="py-3 text-white">
                    <div className="max-w-xs truncate pr-4" title={file.name}>
                      {truncateFileName(file.name)}
                    </div>
                  </td>
                  <td className="py-3 text-gray-400">{file.type}</td>
                  <td className="py-3 text-gray-400">{file.uploadDate}</td>
                  <td className="py-3 text-gray-400">{file.size}</td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end space-x-4">
                      <button 
                        className="text-yellow-500 hover:text-yellow-400 inline-flex items-center"
                        onClick={() => handleFileView(file)}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        className={`text-red-500 hover:text-red-400 inline-flex items-center ${
                          isDeleting && deletingFileId === file.path ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                        onClick={() => handleFileDelete(file.path)}
                        disabled={isDeleting && deletingFileId === file.path}
                      >
                        {isDeleting && deletingFileId === file.path ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-500"></div>
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}