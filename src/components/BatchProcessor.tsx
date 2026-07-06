import React, { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, Download, Trash2 } from 'lucide-react';
import JSZip from 'jszip';
import { PromptData, AppSettings } from '../types';

interface BatchFile {
  id: string;
  file: File;
  previewUrl: string;
  status: 'idle' | 'processing' | 'success' | 'error';
  result?: PromptData;
  error?: string;
}

interface BatchProcessorProps {
  settings: AppSettings;
  filterR18: boolean;
  multiCharacterMode: boolean;
  onViewResult: (data: PromptData | null) => void;
}

export function BatchProcessor({ settings, filterR18, multiCharacterMode, onViewResult }: BatchProcessorProps) {
  const [files, setFiles] = useState<BatchFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const fileList = Array.from(e.target.files) as File[];
      const newFiles = fileList.map(file => ({
        id: Math.random().toString(36).substring(7),
        file,
        previewUrl: URL.createObjectURL(file),
        status: 'idle' as const,
      }));
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => {
      const newFiles = prev.filter(f => f.id !== id);
      const removed = prev.find(f => f.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return newFiles;
    });
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const processFiles = async () => {
    setIsProcessing(true);
    for (let i = 0; i < files.length; i++) {
      if (files[i].status === 'success') continue; // Skip already successful

      setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'processing', error: undefined } : f));
      
      try {
        const base64 = await fileToBase64(files[i].file);
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: base64,
            mimeType: files[i].file.type,
            apiProvider: settings.apiProvider,
            apiKey: settings.apiKey,
            model: settings.model,
            filterR18,
            multiCharacterMode
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to analyze image');
        }

        const data: PromptData = await response.json();
        setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'success', result: data } : f));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'error', error: errorMessage } : f));
      }
    }
    setIsProcessing(false);
  };

  const generatePromptText = (data: PromptData): string => {
    const allTags = [
      ...data.style,
      ...data.character,
      ...data.action,
      ...data.environment,
      ...data.composition
    ];
    return allTags.map(tag => tag.en).join(', ');
  };

  const downloadAll = async () => {
    const zip = new JSZip();
    const successfulFiles = files.filter(f => f.status === 'success' && f.result);
    
    if (successfulFiles.length === 0) return;

    successfulFiles.forEach(f => {
      const text = generatePromptText(f.result!);
      const originalName = f.file.name;
      const baseName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
      zip.file(`${baseName}.txt`, text);
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'prompts.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      const fileList = Array.from(e.dataTransfer.files) as File[];
      const imageFiles = fileList.filter(file => file.type.startsWith('image/'));
      const newFiles = imageFiles.map(file => ({
        id: Math.random().toString(36).substring(7),
        file,
        previewUrl: URL.createObjectURL(file),
        status: 'idle' as const,
      }));
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white p-4">
      {/* Upload Area */}
      <div 
        className="border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer mb-4 shrink-0"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="w-8 h-8 text-slate-400 mb-3" />
        <p className="text-sm font-semibold text-slate-700">点击或拖拽上传多张图片</p>
        <p className="text-xs text-slate-500 mt-1">支持 JPG, PNG, WEBP 等格式</p>
        <input 
          type="file" 
          multiple 
          accept="image/*" 
          className="hidden" 
          ref={fileInputRef}
          onChange={handleFileSelect}
        />
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto min-h-[200px] border border-slate-200 rounded-xl bg-slate-50 p-2 space-y-2">
        {files.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-slate-400">
            暂无图片，请上传
          </div>
        ) : (
          files.map(f => (
            <div key={f.id} className="flex items-center gap-3 p-2 bg-white rounded-lg border border-slate-200 shadow-sm">
              <img src={f.previewUrl} alt={f.file.name} className="w-10 h-10 object-cover rounded-md" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-700 truncate">{f.file.name}</p>
                <div className="text-[10px] mt-0.5 flex items-center gap-1">
                  {f.status === 'idle' && <span className="text-slate-500">等待处理...</span>}
                  {f.status === 'processing' && <span className="text-indigo-600 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> 处理中...</span>}
                  {f.status === 'success' && <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> 成功</span>}
                  {f.status === 'error' && <span className="text-red-500 truncate" title={f.error}><AlertCircle className="w-3 h-3 inline mr-1" /> {f.error}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 pr-2">
                {f.status === 'success' && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); onViewResult(f.result || null); }}
                    className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                    title="查看结果"
                  >
                    <FileText className="w-4 h-4" />
                  </button>
                )}
                {!isProcessing && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); removeFile(f.id); }}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Actions */}
      <div className="mt-4 flex gap-3 shrink-0">
        <button
          onClick={processFiles}
          disabled={isProcessing || files.length === 0 || files.every(f => f.status === 'success')}
          className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg disabled:opacity-50 transition-colors text-sm"
        >
          {isProcessing ? '处理中...' : '开始批量反推'}
        </button>
        <button
          onClick={downloadAll}
          disabled={!files.some(f => f.status === 'success')}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg disabled:opacity-50 transition-colors text-sm flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          下载 ZIP
        </button>
      </div>
    </div>
  );
}
