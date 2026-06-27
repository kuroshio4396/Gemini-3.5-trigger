export interface Tag {
  en: string;
  zh: string;
}

export interface PromptData {
  style: Tag[];
  character: Tag[];
  action: Tag[];
  environment: Tag[];
  composition: Tag[];
}

export type Category = keyof PromptData;

export interface AppSettings {
  apiProvider?: 'google' | 'openrouter';
  apiKey: string;
  model: string;
}

export const categoryLabels: Record<Category, string> = {
  style: '画风提示词 (Style)',
  character: '人物提示词 (Character)',
  action: '动作提示词 (Action)',
  environment: '环境提示词 (Environment)',
  composition: '构图提示词 (Composition)',
};
