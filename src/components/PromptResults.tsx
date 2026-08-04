import React, { useMemo } from 'react';
import { Copy, Check, Tags } from 'lucide-react';
import { motion } from 'motion/react';
import { PromptData, Category } from '../types';

interface PromptResultsProps {
  data: PromptData | null;
}

const categoryStyles: Record<Category, { dot: string, bg: string, border: string, textEn: string, textZh: string, titleEn: string, titleZh: string, colSpan?: string }> = {
  style: { dot: 'bg-blue-500', bg: 'bg-blue-50', border: 'border-blue-100', textEn: 'text-blue-700', textZh: 'text-blue-400', titleEn: 'Art Style', titleZh: '画风提示词' },
  character: { dot: 'bg-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-100', textEn: 'text-emerald-700', textZh: 'text-emerald-400', titleEn: 'Character', titleZh: '人物提示词' },
  action: { dot: 'bg-amber-500', bg: 'bg-amber-50', border: 'border-amber-100', textEn: 'text-amber-700', textZh: 'text-amber-400', titleEn: 'Action', titleZh: '动作提示词' },
  environment: { dot: 'bg-purple-500', bg: 'bg-purple-50', border: 'border-purple-100', textEn: 'text-purple-700', textZh: 'text-purple-400', titleEn: 'Environment', titleZh: '环境提示词' },
  composition: { dot: 'bg-rose-500', bg: 'bg-rose-50', border: 'border-rose-100', textEn: 'text-rose-700', textZh: 'text-rose-400', titleEn: 'Composition', titleZh: '构图提示词', colSpan: 'col-span-2 row-span-1' },
};

export function PromptResults({ data }: PromptResultsProps) {
  const [copiedSection, setCopiedSection] = React.useState<string | null>(null);
  const [copyLanguage, setCopyLanguage] = React.useState<'en' | 'zh'>('en');

  const copyToClipboard = async (text: string, section: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSection(section);
      setTimeout(() => setCopiedSection(null), 2000);
    } catch (err) {
      console.error('Failed to copy text', err);
    }
  };

  const allPrompts = useMemo(() => {
    if (!data) return '';
    const all = Object.values(data).flatMap(tags => tags.map(t => copyLanguage === 'en' ? t.en : t.zh));
    return all.join(', ');
  }, [data, copyLanguage]);

  if (!data) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-white rounded-xl border border-slate-200 shadow-sm">
        <Tags className="w-12 h-12 text-slate-300 mb-4" />
        <p className="text-slate-400 font-bold text-center text-xs uppercase tracking-wider">Upload an image to start<br/>the interrogation process</p>
      </div>
    );
  }

  const renderCategory = (category: Category) => {
    const tags = data[category];
    const styles = categoryStyles[category];
    if (!tags || tags.length === 0) return null;

    const enTagsStr = tags.map(t => t.en).join(', ');
    const zhTagsStr = tags.map(t => t.zh).join(', ');
    const tagsStr = copyLanguage === 'en' ? enTagsStr : zhTagsStr;

    return (
      <div key={category} className={`bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col ${styles.colSpan || ''} overflow-hidden`}>
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${styles.dot}`}></div>
            <h4 className="text-xs font-bold text-slate-700 uppercase">{styles.titleZh} | {styles.titleEn}</h4>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-slate-100 rounded p-0.5">
              <button 
                onClick={() => setCopyLanguage('en')} 
                className={`px-2 py-0.5 text-[9px] font-bold rounded ${copyLanguage === 'en' ? 'bg-white shadow-sm text-slate-700' : 'text-slate-400 hover:text-slate-600'}`}
              >
                EN
              </button>
              <button 
                onClick={() => setCopyLanguage('zh')} 
                className={`px-2 py-0.5 text-[9px] font-bold rounded ${copyLanguage === 'zh' ? 'bg-white shadow-sm text-slate-700' : 'text-slate-400 hover:text-slate-600'}`}
              >
                中文
              </button>
            </div>
            <button
              onClick={() => copyToClipboard(tagsStr, category)}
              className="flex items-center gap-1 text-[10px] font-bold uppercase text-slate-400 hover:text-indigo-600 transition-colors"
            >
              {copiedSection === category ? (
                <><Check className="w-3 h-3 text-green-500" /> Copied</>
              ) : (
                <><Copy className="w-3 h-3" /> Copy</>
              )}
            </button>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2 overflow-y-auto pr-1 custom-scrollbar">
          {tags.map((tag, idx) => (
            <div 
              key={`${category}-${idx}`}
              className={`flex items-center gap-2 ${styles.bg} border ${styles.border} px-2 py-1 rounded cursor-pointer hover:opacity-80 transition-opacity`}
              onClick={() => copyToClipboard(copyLanguage === 'en' ? tag.en : tag.zh, `${category}-${idx}`)}
              title={`点击复制该提示词 (${copyLanguage === 'en' ? '英文' : '中文'})`}
            >
              {copiedSection === `${category}-${idx}` ? (
                <Check className={`w-3 h-3 ${styles.textEn}`} />
              ) : null}
              <span className={`text-xs font-medium ${styles.textEn}`}>
                {tag.en}
              </span>
              <span className={`text-[10px] ${styles.textZh}`}>
                {tag.zh}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const categories: Category[] = ['style', 'character', 'action', 'environment', 'composition'];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex-1 flex flex-col overflow-hidden gap-4"
    >
      <div className="grid grid-cols-2 grid-rows-3 flex-1 gap-4 overflow-hidden">
        {categories.map(renderCategory)}
      </div>

      <div className="h-14 bg-white border border-slate-200 rounded-xl px-4 flex items-center justify-between shrink-0 shadow-sm">
        <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Export Options</span>
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-slate-100 rounded p-0.5">
            <button 
              onClick={() => setCopyLanguage('en')} 
              className={`px-3 py-1 text-[10px] font-bold rounded ${copyLanguage === 'en' ? 'bg-white shadow-sm text-slate-700' : 'text-slate-400 hover:text-slate-600'}`}
            >
              EN
            </button>
            <button 
              onClick={() => setCopyLanguage('zh')} 
              className={`px-3 py-1 text-[10px] font-bold rounded ${copyLanguage === 'zh' ? 'bg-white shadow-sm text-slate-700' : 'text-slate-400 hover:text-slate-600'}`}
            >
              中文
            </button>
          </div>
          <button
            onClick={() => copyToClipboard(allPrompts, 'all')}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-bold shadow-sm flex items-center gap-2 transition-colors"
          >
            {copiedSection === 'all' ? (
              <><Check className="w-4 h-4" /> Copied Workflow Prompts</>
            ) : (
              <><Copy className="w-4 h-4" /> Export to ComfyUI Workflow</>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
