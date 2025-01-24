import React, { useState, useEffect, useCallback } from 'react';
import { X, Save, ChevronLeft, ChevronRight } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Document, Page, pdfjs } from 'react-pdf';
import { supabase } from '../lib/supabase';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface FileViewerProps {
  url: string;
  type: string;
  onClose: () => void;
  onUpdate?: () => void;
  data?: { value: string; width: number; }[][];  // Add data prop for direct Excel data
}

interface CellData {
  value: string;
  width: number;
}

export function FileViewer({ url, type, onClose, onUpdate, data }: FileViewerProps) {
  const [excelData, setExcelData] = useState<CellData[][]>([]);
  const [originalData, setOriginalData] = useState<any[][]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [columnWidths, setColumnWidths] = useState<number[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragColumnIndex, setDragColumnIndex] = useState<number | null>(null);

  useEffect(() => {
    if (type === 'Excel') {
      if (data) {
        // If direct data is provided, use it
        setExcelData(data);
        setOriginalData(data.map(row => row.map(cell => cell.value)));
        setColumnWidths(data[0].map(cell => cell.width));
        setLoading(false);
      } else if (url) {
        // Otherwise load from URL
        loadExcelFile();
      }
    } else {
      setLoading(false);
    }
  }, [url, type, data]);

  const loadExcelFile = async () => {
    try {
      setLoading(true);
      setError('');

      // Add cache-busting parameter to URL
      const cacheBustUrl = `${url}?t=${Date.now()}`;
      const response = await fetch(cacheBustUrl);
      const blob = await response.blob();
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: 'array' });
          setWorkbook(wb);
          
          const firstSheet = wb.Sheets[wb.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
          
          // Calculate column widths based on content
          const widths = calculateColumnWidths(jsonData);
          setColumnWidths(widths);

          // Convert data to CellData format
          const formattedData = jsonData.map((row: any[]) =>
            row.map((cell, colIndex) => ({
              value: cell?.toString() || '',
              width: widths[colIndex]
            }))
          );

          setExcelData(formattedData);
          setOriginalData(jsonData);
          setLoading(false);
        } catch (err) {
          setError('Error processing Excel file');
          setLoading(false);
        }
      };

      reader.onerror = () => {
        setError('Error reading file');
        setLoading(false);
      };

      reader.readAsArrayBuffer(blob);
    } catch (err) {
      setError('Error loading file');
      setLoading(false);
    }
  };

  const calculateColumnWidths = (data: any[][]): number[] => {
    const widths: number[] = [];
    if (data.length === 0) return widths;

    // Get the maximum number of columns
    const maxCols = Math.max(...data.map(row => row.length));

    // Initialize with minimum width
    for (let i = 0; i < maxCols; i++) {
      widths[i] = 100; // Minimum width in pixels
    }

    // Calculate width based on content
    data.forEach(row => {
      row.forEach((cell, colIndex) => {
        const content = cell?.toString() || '';
        const contentWidth = content.length * 8 + 24; // Rough estimate of width
        widths[colIndex] = Math.max(widths[colIndex], contentWidth);
      });
    });

    return widths;
  };

  const handleCellEdit = (rowIndex: number, colIndex: number) => {
    if (type === 'Excel') {
      setEditingCell({ row: rowIndex, col: colIndex });
    }
  };

  const handleCellChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingCell) return;

    const newData = [...excelData];
    newData[editingCell.row][editingCell.col] = {
      ...newData[editingCell.row][editingCell.col],
      value: e.target.value
    };
    setExcelData(newData);
  };

  const handleCellBlur = () => {
    setEditingCell(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!editingCell) return;

    if (e.key === 'Enter') {
      setEditingCell(null);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const nextCol = editingCell.col + (e.shiftKey ? -1 : 1);
      if (nextCol >= 0 && nextCol < excelData[0].length) {
        setEditingCell({ row: editingCell.row, col: nextCol });
      }
    } else if (e.key === 'ArrowDown' && !e.shiftKey) {
      e.preventDefault();
      const nextRow = editingCell.row + 1;
      if (nextRow < excelData.length) {
        setEditingCell({ row: nextRow, col: editingCell.col });
      }
    } else if (e.key === 'ArrowUp' && !e.shiftKey) {
      e.preventDefault();
      const prevRow = editingCell.row - 1;
      if (prevRow >= 0) {
        setEditingCell({ row: prevRow, col: editingCell.col });
      }
    }
  };

  const handleColumnResizeStart = (e: React.MouseEvent, colIndex: number) => {
    setIsDragging(true);
    setDragStartX(e.clientX);
    setDragColumnIndex(colIndex);
  };

  const handleColumnResize = useCallback((e: MouseEvent) => {
    if (!isDragging || dragColumnIndex === null) return;

    const deltaX = e.clientX - dragStartX;
    const newWidths = [...columnWidths];
    newWidths[dragColumnIndex] = Math.max(100, columnWidths[dragColumnIndex] + deltaX);
    setColumnWidths(newWidths);
    setDragStartX(e.clientX);
  }, [isDragging, dragColumnIndex, dragStartX, columnWidths]);

  const handleColumnResizeEnd = useCallback(() => {
    setIsDragging(false);
    setDragColumnIndex(null);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleColumnResize);
      window.addEventListener('mouseup', handleColumnResizeEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleColumnResize);
      window.removeEventListener('mouseup', handleColumnResizeEnd);
    };
  }, [isDragging, handleColumnResize, handleColumnResizeEnd]);

  const saveExcelFile = async () => {
    if (!workbook) return;

    try {
      setSaving(true);
      setError('');
      
      // Get the current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('Not authenticated');

      // Convert the edited data back to the format expected by XLSX
      const newData = excelData.map(row => row.map(cell => cell.value));
      
      // Update the workbook with new data
      const ws = XLSX.utils.aoa_to_sheet(newData);
      workbook.Sheets[workbook.SheetNames[0]] = ws;
      
      // Convert workbook to binary
      const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      // Extract the filename from the URL and ensure it's in the user's folder
      const urlParts = url.split('/');
      const fileName = urlParts[urlParts.length - 1].split('?')[0]; // Remove any query parameters
      const filePath = `${user.id}/${fileName}`;

      // Upload the updated file
      const { error: uploadError } = await supabase.storage
        .from('excel-files')
        .update(filePath, blob, {
          cacheControl: '0', // Disable caching
          upsert: true
        });

      if (uploadError) throw uploadError;

      setOriginalData(newData);
      setError('');

      // Notify parent component to refresh the file list
      if (onUpdate) {
        onUpdate();
      }

      // Reload the file to ensure we're showing the latest version
      await loadExcelFile();
    } catch (err: any) {
      console.error('Save error:', err);
      setError(err.message || 'Error saving file. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
  };

  const hasChanges = JSON.stringify(excelData.map(row => row.map(cell => cell.value))) !== 
                     JSON.stringify(originalData);

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="glass-card w-full h-[90vh] max-w-6xl p-4 relative">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center space-x-4">
            <h2 className="text-sm font-bold text-white">Document Viewer</h2>
            {type === 'Excel' && hasChanges && (
              <button
                onClick={saveExcelFile}
                disabled={saving}
                className="btn-secondary text-xs py-1 px-2 inline-flex items-center space-x-1"
              >
                {saving ? (
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-yellow-500"></div>
                ) : (
                  <Save className="h-3 w-3" />
                )}
                <span>Save Changes</span>
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="h-[calc(100%-2rem)] overflow-auto">
          {error ? (
            <div className="text-red-500 text-sm">{error}</div>
          ) : loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-yellow-500"></div>
            </div>
          ) : type === 'PDF' ? (
            <div className="h-full flex flex-col items-center bg-gray-900">
              <Document
                file={url}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-yellow-500"></div>
                  </div>
                }
              >
                <Page 
                  pageNumber={pageNumber} 
                  width={Math.min(window.innerWidth * 0.8, 800)}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                />
              </Document>
              {numPages && (
                <div className="sticky bottom-0 bg-black/80 w-full p-2 flex justify-center items-center space-x-4">
                  <button
                    onClick={() => setPageNumber(page => Math.max(1, page - 1))}
                    disabled={pageNumber <= 1}
                    className="text-xs text-yellow-500 disabled:text-gray-500"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-xs text-gray-400">
                    Page {pageNumber} of {numPages}
                  </span>
                  <button
                    onClick={() => setPageNumber(page => Math.min(numPages || 1, page + 1))}
                    disabled={pageNumber >= (numPages || 1)}
                    className="text-xs text-yellow-500 disabled:text-gray-500"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-800">
                <tbody className="text-xs">
                  {excelData.map((row, rowIndex) => (
                    <tr key={rowIndex} className={rowIndex === 0 ? 'bg-yellow-500/10' : ''}>
                      {row.map((cell, colIndex) => (
                        <td
                          key={colIndex}
                          className={`px-2 py-1 whitespace-nowrap relative ${
                            rowIndex === 0
                              ? 'font-medium text-yellow-500'
                              : 'text-gray-300'
                          }`}
                          style={{ width: `${columnWidths[colIndex]}px` }}
                        >
                          {editingCell?.row === rowIndex && editingCell?.col === colIndex ? (
                            <input
                              type="text"
                              value={cell.value}
                              onChange={handleCellChange}
                              onBlur={handleCellBlur}
                              onKeyDown={handleKeyDown}
                              className="w-full bg-black/50 border border-yellow-500 rounded px-1 py-0.5 text-white focus:outline-none focus:ring-1 focus:ring-yellow-500"
                              autoFocus
                            />
                          ) : (
                            <div
                              onClick={() => handleCellEdit(rowIndex, colIndex)}
                              className="cursor-text"
                            >
                              {cell.value}
                            </div>
                          )}
                          {colIndex < row.length - 1 && (
                            <div
                              className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-yellow-500/30"
                              onMouseDown={(e) => handleColumnResizeStart(e, colIndex)}
                            />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}