import React, { useState } from 'react';
import { FileText, FileSpreadsheet, Upload } from 'lucide-react';

interface QuoteGeneratorProps {
  onUploadClick: () => void;
  onViewExcel: (file: any) => void;
}

export function QuoteGenerator({ onUploadClick, onViewExcel }: QuoteGeneratorProps) {
  const [inputText, setInputText] = useState('');
  const [generatedQuote, setGeneratedQuote] = useState('');

  const generateTextQuote = () => {
    setGeneratedQuote(inputText);
  };

  const generateExcelQuote = () => {
    // Create sample data
    const data = [
      ['Item', 'Description', 'Quantity', 'Unit Price', 'Total'],
      ['Product A', 'High-quality widget', '2', '100', '200'],
      ['Product B', 'Premium gadget', '3', '150', '450'],
      ['Product C', 'Deluxe item', '1', '200', '200'],
      ['', '', '', 'Subtotal', '850'],
      ['', '', '', 'Tax (18%)', '153'],
      ['', '', '', 'Total', '1003']
    ];

    // Convert data to the format expected by the FileViewer
    const excelData = data.map(row => 
      row.map(cell => ({
        value: cell.toString(),
        width: 120
      }))
    );

    // Create a sample file object that matches the FileViewer's expectations
    const sampleFile = {
      name: 'quote.xlsx',
      type: 'Excel',
      uploadDate: new Date().toLocaleDateString(),
      size: '10 KB',
      url: '',
      data: excelData
    };

    onViewExcel(sampleFile);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="glass-card p-8 mb-8">
        <h2 className="text-2xl font-bold text-white mb-6">Create New Quote</h2>
        
        {/* Input Options */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-yellow-500 mb-4">Step 1: Choose Input Method</h3>
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="flex-1 w-full">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="w-full px-3 py-2 bg-black/50 border border-yellow-500/20 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 text-white h-32"
                placeholder="Enter product details, specifications, and requirements..."
              />
            </div>
            <div className="text-yellow-500 font-medium">OR</div>
            <div className="flex-1 w-full">
              <button
                onClick={onUploadClick}
                className="w-full btn-secondary flex items-center justify-center h-32 border-2 border-dashed"
              >
                <div className="text-center">
                  <Upload className="h-6 w-6 mx-auto mb-2" />
                  <span>Upload File</span>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Generate Options */}
        <div>
          <h3 className="text-lg font-semibold text-yellow-500 mb-4">Step 2: Generate Quote</h3>
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={generateTextQuote}
              className="flex-1 btn-secondary inline-flex items-center justify-center"
            >
              <FileText className="h-4 w-4 mr-2" />
              Generate Text Quote
            </button>
            <div className="text-yellow-500 font-medium self-center">OR</div>
            <button
              onClick={generateExcelQuote}
              className="flex-1 btn-secondary inline-flex items-center justify-center"
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Generate Excel Quote
            </button>
          </div>
        </div>
      </div>

      {generatedQuote && (
        <div className="glass-card p-8">
          <h3 className="text-xl font-bold text-white mb-4">Generated Quote</h3>
          <div className="bg-black/50 border border-yellow-500/20 rounded-md p-4 text-white whitespace-pre-wrap">
            {generatedQuote}
          </div>
        </div>
      )}
    </div>
  );
}