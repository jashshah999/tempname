import React, { useState } from 'react';
import { Upload, FileSpreadsheet, FileDown, X, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface FileUploaderProps {
  onUploadComplete: (file: File) => void;
  onCancel: () => void;
}

export function FileUploader({ onUploadComplete, onCancel }: FileUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [uploadType, setUploadType] = useState<'price-list' | 'quotation' | 'pdf' | null>(null);

  const validateFile = (file: File) => {
    const validExcelTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];
    
    if (uploadType === 'pdf') {
      if (file.type !== 'application/pdf') {
        throw new Error('Please upload only PDF files');
      }
    } else if (!validExcelTypes.includes(file.type)) {
      throw new Error('Please upload only Excel files (.xlsx)');
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new Error('File size must be less than 5MB');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');

    try {
      validateFile(file);

      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Create a path with user ID as the folder
      const timestamp = Date.now();
      const filePath = `${user.id}/${timestamp}-${file.name}`;

      const { data, error: uploadError } = await supabase.storage
        .from('excel-files')
        .upload(filePath, file, {
          cacheControl: '3600',
          contentType: file.type,
          upsert: false
        });

      if (uploadError) throw uploadError;

      onUploadComplete(file);
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Error uploading file. Please try again.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  if (!uploadType) {
    return (
      <div className="glass-card p-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">What would you like to upload?</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-white">
            <X className="h-6 w-6" />
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button
            onClick={() => setUploadType('price-list')}
            className="upload-option-card"
          >
            <FileSpreadsheet className="h-8 w-8 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Excel Document</h3>
            <p className="text-gray-400 text-sm">Upload Excel files for processing</p>
          </button>
          <button
            onClick={() => setUploadType('pdf')}
            className="upload-option-card"
          >
            <FileText className="h-8 w-8 mb-4" />
            <h3 className="text-lg font-semibold mb-2">PDF Document</h3>
            <p className="text-gray-400 text-sm">Upload PDF documents</p>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Upload {uploadType === 'pdf' ? 'PDF' : 'Excel'} Document</h2>
          <p className="text-sm text-gray-400 mt-1">Files will be processed automatically</p>
        </div>
        <button onClick={onCancel} className="text-gray-400 hover:text-white">
          <X className="h-6 w-6" />
        </button>
      </div>

      {error && (
        <div className="bg-red-900/50 text-red-200 p-3 rounded mb-4 border border-red-500/20">
          {error}
        </div>
      )}

      <label className={`relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
        uploading ? 'border-yellow-500/20 bg-black/30' : 'border-yellow-500/30 hover:border-yellow-500/50 bg-black/50 hover:bg-black/40'
      }`}>
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          <Upload className={`w-8 h-8 mb-2 ${uploading ? 'text-yellow-500/50' : 'text-yellow-500'}`} />
          <p className="mb-2 text-sm text-gray-400">
            <span className="font-semibold">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-gray-500">
            {uploadType === 'pdf' ? 'PDF files only (max 5MB)' : 'XLSX files only (max 5MB)'}
          </p>
        </div>
        <input
          type="file"
          className="hidden"
          accept={uploadType === 'pdf' ? '.pdf' : '.xlsx'}
          onChange={handleFileUpload}
          disabled={uploading}
        />
      </label>

      {uploading && (
        <div className="mt-4 text-center text-yellow-500">
          Uploading file...
        </div>
      )}

      <button
        onClick={() => setUploadType(null)}
        className="mt-6 text-yellow-500 hover:text-yellow-400 text-sm"
      >
        ← Back to file type selection
      </button>
    </div>
  );
}