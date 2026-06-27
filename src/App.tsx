import React, { useState } from 'react';
import { Camera, Settings as SettingsIcon } from 'lucide-react';
import { ImageUploader } from './components/ImageUploader';
import { PromptResults } from './components/PromptResults';
import { PromptData, AppSettings } from './types';
import { SettingsModal } from './components/SettingsModal';

export default function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [promptData, setPromptData] = useState<PromptData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('promptrefine_settings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return { apiProvider: 'google', apiKey: '', model: 'gemini-2.5-flash' };
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [filterR18, setFilterR18] = useState(false);

  const handleSaveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    localStorage.setItem('promptrefine_settings', JSON.stringify(newSettings));
  };

  const handleImageSelected = async (base64: string, mimeType: string) => {
    setIsLoading(true);
    setError(null);
    setPromptData(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          image: base64, 
          mimeType,
          apiProvider: settings.apiProvider,
          apiKey: settings.apiKey,
          model: settings.model,
          filterR18
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to analyze image');
      }

      const data: PromptData = await response.json();
      setPromptData(data);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen bg-slate-50 flex flex-col font-sans text-slate-900 overflow-hidden">
      {/* Header */}
      <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center">
            <Camera className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-800">PromptRefine AI</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">ComfyUI Image-to-Prompt Interrogator</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setFilterR18(!filterR18)}
            className={`text-sm font-semibold px-4 py-1.5 rounded-lg shadow-sm transition-colors flex items-center gap-2 border ${
              filterR18 
                ? 'bg-rose-100 border-rose-200 text-rose-700 hover:bg-rose-200' 
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-current"></span>
            R18+ 词汇过滤 {filterR18 ? '已开启' : '未开启'}
          </button>
          <div className="flex items-center bg-slate-100 rounded-lg px-3 py-1.5 border border-slate-200 hidden md:flex">
            <span className="text-xs font-medium text-slate-600">
              Model: {settings.model}
            </span>
          </div>
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="bg-white border border-slate-200 text-slate-700 text-sm font-semibold px-4 py-1.5 rounded-lg shadow-sm hover:bg-slate-50 transition-colors flex items-center gap-2"
          >
            <SettingsIcon className="w-4 h-4" />
            <span className="hidden sm:inline">API 配置</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden p-6 gap-6">
        {/* Left Column - Uploader */}
        <section className="w-[340px] flex flex-col gap-4 shrink-0 overflow-y-auto">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
            <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Input Source</span>
            </div>
            <div className="flex-1 bg-slate-200 flex flex-col relative">
              <ImageUploader onImageSelected={handleImageSelected} isLoading={isLoading} />
            </div>
          </div>
          
          {error && (
            <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm font-medium shadow-sm">
              发生错误: {error}
            </div>
          )}
          
          {promptData && (
             <div className="bg-slate-800 rounded-xl p-4 text-white shadow-lg shrink-0">
               <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Processing Stats</h3>
               <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1">
                   <p className="text-[10px] text-slate-500">Total Categories</p>
                   <p className="text-sm font-mono">5</p>
                 </div>
                 <div className="space-y-1">
                   <p className="text-[10px] text-slate-500">Total Tags</p>
                   <p className="text-sm font-mono">
                     {Object.values(promptData).flat().length} Tags
                   </p>
                 </div>
               </div>
             </div>
          )}
        </section>

        {/* Right Column - Results */}
        <section className="flex-1 flex flex-col gap-4 overflow-hidden">
          <PromptResults data={promptData} />
        </section>
      </main>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        onSave={handleSaveSettings} 
        initialSettings={settings} 
      />
    </div>
  );
}
