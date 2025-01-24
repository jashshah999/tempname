import React, { useState } from 'react';
import { Upload, FileSpreadsheet } from 'lucide-react';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';

interface ExcelUploaderProps {
  onUploadComplete: (headers: string[]) => void;
}

export function ExcelUploader({ onUploadComplete }: ExcelUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);

  const validateFile = (file: File) => {
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];
    
    if (!validTypes.includes(file.type)) {
      throw new Error('Please upload only Excel files (.xlsx)');
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB
      throw new Error('File size must be less than 5MB');
    }
  };

  const processExcelFile = async (file: File): Promise<string[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          
          // Get the first worksheet
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          
          // Convert to JSON to get headers
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
          
          // Find the header row (first non-empty row)
          const headerRow = jsonData.find((row: any[]) => row.length > 0) || [];
          
          // Filter out empty headers and clean them
          const headers = headerRow
            .filter((header: any) => header && String(header).trim())
            .map((header: any) => String(header).trim());
          
          resolve(headers);
        } catch (err) {
          reject(new Error('Failed to process Excel file'));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read Excel file'));
      };
      
      reader.readAsArrayBuffer(file);
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');

    try {
      // Validate file before upload
      validateFile(file);

      // Process the Excel file locally
      setProcessing(true);
      const headers = await processExcelFile(file);

      // Upload to Supabase Storage
      const { data, error: uploadError } = await supabase.storage
        .from('excel-files')
        .upload(`price-lists/${Date.now()}-${file.name}`, file, {
          cacheControl: '3600',
          contentType: file.type,
          upsert: false
        });

      if (uploadError) throw uploadError;

      onUploadComplete(headers);
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Error uploading file. Please try again.');
    } finally {
      setUploading(false);
      setProcessing(false);
      // Clear the input
      event.target.value = '';
    }
  };

  return (
    <div className="glass-card p-8">
      <div className="text-center mb-6">
        <div className="feature-icon mx-auto">
          <FileSpreadsheet className="h-16 w-16" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Upload Price List</h2>
        <p className="text-gray-400">Upload your Excel price list to get started</p>
      </div>

      {error && (
        <div className="bg-red-900/50 text-red-200 p-3 rounded mb-4 border border-red-500/20">
          {error}
        </div>
      )}

      <label className={`relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
        uploading || processing ? 'border-yellow-500/20 bg-black/30' : 'border-yellow-500/30 hover:border-yellow-500/50 bg-black/50 hover:bg-black/40'
      }`}>
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          <Upload className={`w-8 h-8 mb-2 ${uploading || processing ? 'text-yellow-500/50' : 'text-yellow-500'}`} />
          <p className="mb-2 text-sm text-gray-400">
            <span className="font-semibold">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-gray-500">XLSX files only (max 5MB)</p>
        </div>
        <input
          type="file"
          className="hidden"
          accept=".xlsx"
          onChange={handleFileUpload}
          disabled={uploading || processing}
        />
      </label>

      {(uploading || processing) && (
        <div className="mt-4 text-center text-yellow-500">
          {uploading ? 'Uploading file...' : 'Processing Excel file...'}
        </div>
      )}
    </div>
  );
}