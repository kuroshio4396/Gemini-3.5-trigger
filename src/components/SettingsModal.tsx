import React, { useState, useEffect } from 'react';
import { X, Key, Save } from 'lucide-react';
import { AppSettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: AppSettings) => void;
  initialSettings: AppSettings;
}

export function SettingsModal({ isOpen, onClose, onSave, initialSettings }: SettingsModalProps) {
  const [apiProvider, setApiProvider] = useState(initialSettings.apiProvider || 'google');
  const [apiKey, setApiKey] = useState(initialSettings.apiKey);
  const [model, setModel] = useState(initialSettings.model);

  useEffect(() => {
    if (isOpen) {
      setApiProvider(initialSettings.apiProvider || 'google');
      setApiKey(initialSettings.apiKey);
      setModel(initialSettings.model);
    }
  }, [isOpen, initialSettings]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Key className="w-5 h-5 text-indigo-600" />
            API 秘钥配置
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 flex flex-col gap-5 bg-white">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">API 服务商</label>
            <select 
              value={apiProvider}
              onChange={(e) => {
                const newProvider = e.target.value as 'google' | 'openrouter' | 'kimi';
                setApiProvider(newProvider);
                // Switch model if switching providers
                if (newProvider === 'kimi') {
                  setModel('kimi k2.7 code');
                } else if (model === 'kimi k2.7 code' || model === 'kimi-2.6') {
                  setModel('gemini-2.5-flash');
                }
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
            >
              <option value="google">Google AI Studio</option>
              <option value="openrouter">OpenRouter</option>
              <option value="kimi">Kimi API</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">API Key (可选)</label>
            <input 
              type="password" 
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                apiProvider === 'openrouter' ? '请输入 OpenRouter API Key' : 
                apiProvider === 'kimi' ? '请输入 Kimi API Key' : '留空则使用内置 AI 进行处理'
              }
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
            />
          </div>
          
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">模型选择</label>
            <select 
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
            >
              {apiProvider === 'kimi' ? (
                <option value="kimi k2.7 code">Kimi k2.7 Code</option>
              ) : (
                <>
                  <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
                  <option value="gemini-3.0-flash">Gemini 3 Flash</option>
                  <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite</option>
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                </>
              )}
            </select>
          </div>
          
          <div className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100 leading-relaxed">
            <p className="font-semibold text-slate-700 mb-1">说明：</p>
            当您配置了 API 秘钥后，所有的图片分析及提示词反推将使用您配置的秘钥及模型进行处理。如果服务商选择 Google AI Studio 且秘钥为空，则默认维持当前状态，由内置 AI 免费完成任务处理。
          </div>
        </div>
        
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-800 transition-colors"
          >
            取消
          </button>
          <button 
            onClick={() => {
              onSave({ apiProvider: apiProvider as 'google' | 'openrouter' | 'kimi', apiKey, model });
              onClose();
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            保存配置
          </button>
        </div>
      </div>
    </div>
  );
}
