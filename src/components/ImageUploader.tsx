import React, { useCallback, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { motion } from 'motion/react';

interface ImageUploaderProps {
  onImageSelected: (base64: string, mimeType: string, previewUrl: string) => void;
  isLoading: boolean;
}

export function ImageUploader({ onImageSelected, isLoading }: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setPreview(result);
      onImageSelected(result, file.type, result);
    };
    reader.readAsDataURL(file);
  };

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col absolute inset-0">
      <input
        type="file"
        id="image-upload"
        className="hidden"
        accept="image/*"
        onChange={onFileInput}
        disabled={isLoading}
      />
      
      {!preview ? (
        <motion.label
          htmlFor="image-upload"
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          animate={{
            scale: isDragging ? 1.02 : 1,
            borderColor: isDragging ? '#6366f1' : '#cbd5e1',
            backgroundColor: isDragging ? '#e0e7ff' : '#f1f5f9'
          }}
          className={`flex-1 m-4 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors p-6
            ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-200'}`}
        >
          <UploadCloud className="w-10 h-10 text-slate-400 mb-3" />
          <h3 className="text-sm font-bold text-slate-600 mb-1">Upload Reference</h3>
          <p className="text-[10px] text-slate-400 text-center uppercase tracking-wide">
            JPG, PNG, WebP
          </p>
        </motion.label>
      ) : (
        <div className="flex-1 flex flex-col h-full">
          <div className="flex-1 p-4 flex items-center justify-center relative">
            <div className="absolute inset-4 rounded-lg overflow-hidden shadow-inner flex items-center justify-center bg-slate-300">
               <img 
                 src={preview} 
                 alt="Preview" 
                 className={`w-full h-full object-cover ${isLoading ? 'opacity-50' : ''}`}
               />
               <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 to-transparent"></div>
            </div>
            
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <div className="flex flex-col items-center p-4 bg-slate-900/90 rounded-lg shadow-xl backdrop-blur-sm">
                  <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mb-3"></div>
                  <p className="text-xs font-bold text-white uppercase tracking-wider">Analyzing Image...</p>
                </div>
              </div>
            )}
          </div>
          
          <div className="p-4 pt-0 shrink-0">
            <label 
              htmlFor="image-upload" 
              className={`w-full py-2 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 text-xs font-bold uppercase tracking-wide hover:bg-slate-50 transition-colors flex items-center justify-center cursor-pointer ${isLoading ? 'pointer-events-none opacity-50' : ''}`}
            >
              Replace Reference Image
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
