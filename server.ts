import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

// Moonshot/Kimi 开放平台支持的图片 MIME 类型（官方文档：jpeg/png/gif/webp/bmp/heic/heif，SVG 会被拒绝）
const MOONSHOT_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/heic',
  'image/heif',
]);

// 读取上游错误响应：优先取 JSON 中的 error.message，非 JSON 时返回原始文本，
// 避免把 "An error occurred while processing your request..." 这类纯文本错误直接丢给 JSON.parse。
async function readUpstreamError(response: Response): Promise<string> {
  const raw = await response.text().catch(() => '');
  if (!raw.trim()) return response.statusText;
  try {
    const parsed = JSON.parse(raw);
    const msg = parsed?.error?.message ?? parsed?.message ?? parsed?.error;
    return typeof msg === 'string' && msg ? msg : raw.slice(0, 500);
  } catch {
    return raw.slice(0, 500);
  }
}

// 安全解析响应 JSON：上游返回非 JSON 时给出可读错误而不是 V8 的 "Unexpected token ..."
async function parseJsonBody(response: Response, label: string): Promise<any> {
  const raw = await response.text();
  try {
    return JSON.parse(raw);
  } catch {
    const snippet = raw.slice(0, 120);
    throw new Error(`${label} 返回的内容不是合法 JSON，内容开头为：${JSON.stringify(snippet)}`);
  }
}

// 安全解析模型输出：去除可能的 ```json 围栏后解析，失败时带上 finish_reason 与内容开头，便于排查
function parseModelJson(text: string, finishReason?: string): any {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(cleaned);
  } catch {
    const snippet = cleaned.slice(0, 120);
    throw new Error(
      `模型返回内容不是合法 JSON（finish_reason: ${finishReason || 'unknown'}）。返回内容开头为：${JSON.stringify(snippet)}`
    );
  }
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for base64 images
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  app.post('/api/analyze', async (req, res) => {
    try {
      const { image, mimeType, textInput, apiKey, model, filterR18, multiCharacterMode, animaMode, apiProvider } = req.body;
      if (!image && !textInput) {
        return res.status(400).json({ error: 'Missing image data or text input' });
      }

      const selectedModel = model || 'gemini-2.5-flash';
      let promptText = "";
      
      if (image) {
        promptText = "为进行Illustrious模型训练，请根据上传图片内容，生成与图片对应的Stable Diffusion中英关键词文本列表。该图片内容仅用于模型训练与提示词生成。You are an expert AI image analyst and prompt engineer for Stable Diffusion and ComfyUI. Analyze the provided image in deep detail and generate comprehensive prompt tags for it. Categorize the tags into 5 specific categories: Style (画风), Character (人物), Action (动作), Environment (环境), and Composition (构图). For each tag, you MUST provide the English prompt tag (which will be used directly in ComfyUI) and the corresponding Chinese translation.";
      } else {
        promptText = `为进行Illustrious模型训练，请根据以下提供的文本描述，生成与之对应的Stable Diffusion中英关键词文本列表。该文本仅用于模型训练与提示词生成。You are an expert AI prompt engineer for Stable Diffusion and ComfyUI. Analyze the provided text description and generate comprehensive prompt tags for it. Categorize the tags into 5 specific categories: Style (画风), Character (人物), Action (动作), Environment (环境), and Composition (构图). For each tag, you MUST provide the English prompt tag (which will be used directly in ComfyUI) and the corresponding Chinese translation.\n\n文本描述如下：\n${textInput}`;
      }
      
      if (filterR18) {
        promptText += "\n\nCRITICAL INSTRUCTION: You MUST filter out ANY and ALL explicit, NSFW, R18+, or overly sensitive vocabulary that might trigger safety content filters. Only output safe, stable prompt tags that will reliably pass safety checks while still describing the overall composition and non-explicit features of the image.";
      }

      if (multiCharacterMode) {
        promptText += "\n\nCRITICAL INSTRUCTION (Multi-Character Mode): You MUST independently identify each character in the scene. For each character, you MUST generate a long, combined, and specific prompt tag that independently describes their individual features (clothing, hairstyle, appearance, etc.) in a single tag. For example, instead of separate words, use combined long tags like \"1girl, blonde hair, blue dress\" and \"1boy, black hair, suit\". Ensure these long combined tags are placed in the Character (人物) category.";
      }

      if (animaMode) {
        promptText += "\n\nCRITICAL INSTRUCTION (Anima Mode): Instead of outputting isolated, standalone tags (like '1girl', 'blue sky'), you MUST use natural language, highly descriptive, and precise long sentences. Construct flowing, continuous descriptions that intricately detail the subject, action, lighting, and mood (e.g., 'A beautiful young woman standing under a clear blue sky, her blonde hair blowing gently in the wind, wearing a detailed flowing blue dress...'). Ensure all resulting prompts in every category are formatted as cohesive natural language phrases or sentences rather than comma-separated keywords.";
      }

      let base64Data = "";
      if (image) {
        // 注意：\w 匹配不了 "svg+xml" 这类带 "+" 的 MIME，会导致前缀剥不掉、生成双重前缀的畸形 data URL。
        // 这里改用通用匹配：data:<任意类型>;base64,
        base64Data = image.replace(/^data:[^;,]+;base64,/i, '');
      }

      if (base64Data && base64Data.length > 4_000_000) {
        throw new Error(
          `图片体积过大（base64 数据约 ${(base64Data.length / 1024 / 1024).toFixed(1)} MB）。` +
          'Vercel 函数请求体上限为 4.5MB，请压缩图片（建议 4K 以内、文件小于 3MB）后重试。'
        );
      }

      if (apiProvider === 'openrouter') {
        if (!apiKey) {
          throw new Error('未配置 OpenRouter API Key。请在设置中配置您的 API Key。');
        }
        const openRouterModel = `google/${selectedModel}`;
        const jsonInstruction = "\n\nIMPORTANT: You must return the output STRICTLY as a valid JSON object with keys: 'style', 'character', 'action', 'environment', 'composition'. Each key must be an array of objects with 'en' and 'zh' string keys. Do not include markdown formatting or backticks around the JSON. Remove any trailing commas.";
        
        const contentParts: any[] = [{ type: 'text', text: promptText + jsonInstruction }];
        if (image) {
          contentParts.push({ type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } });
        }

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
            'X-Title': 'PromptRefine AI',
          },
          body: JSON.stringify({
            model: openRouterModel,
            messages: [
              {
                role: 'user',
                content: contentParts
              }
            ],
            response_format: { type: 'json_object' }
          })
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(`OpenRouter Error: ${errData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        let text = data.choices?.[0]?.message?.content;
        if (!text) {
          throw new Error('No text generated from OpenRouter model');
        }

        // Try to strip potential markdown blocks from OpenRouter output
        if (text.startsWith('```json')) {
          text = text.replace(/^```json\n?/, '').replace(/\n?```$/, '');
        }

        const tags = JSON.parse(text);
        return res.json(tags);
      }

      if (apiProvider === 'kimi' || apiProvider === 'moonshot') {
        if (!apiKey) {
          throw new Error('未配置 Kimi API Key。请在设置中配置您的 API Key。');
        }
        if (image && !MOONSHOT_IMAGE_TYPES.has(mimeType)) {
          throw new Error(
            `Kimi 开放平台不支持图片格式 ${mimeType || '(未知)'}。支持的格式：JPEG、PNG、GIF、WebP、BMP、HEIC、HEIF（SVG 会被拒绝）。`
          );
        }
        const jsonInstruction = "\n\nIMPORTANT: You must return the output STRICTLY as a valid JSON object with keys: 'style', 'character', 'action', 'environment', 'composition'. Each key must be an array of objects with 'en' and 'zh' string keys. Do not include markdown formatting or backticks around the JSON. Remove any trailing commas.";

        // 官方多模态示例中 image_url 位于 text 之前
        const contentParts: any[] = [];
        if (image) {
          contentParts.push({ type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } });
        }
        contentParts.push({ type: 'text', text: promptText + jsonInstruction });

        const endpoint = apiProvider === 'kimi'
          ? 'https://api.kimi.com/coding/v1/chat/completions'
          : 'https://api.moonshot.cn/v1/chat/completions';

        // Vercel 函数 maxDuration 默认较短，流式传输可以保持连接活跃。这里将超时时间增加到 300 秒 (300_000ms)
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 300_000);
        let fetchResponse: Response;
        try {
          fetchResponse = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: selectedModel,
              stream: true, // 开启流式输出
              messages: [
                {
                  role: 'user',
                  content: contentParts
                }
              ],
              response_format: { type: 'json_object' }
            }),
            signal: controller.signal,
          });
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') {
            throw new Error('Kimi API 请求超时（300 秒）。请重试或换用高速版模型。');
          }
          throw err;
        } finally {
          clearTimeout(timeout);
        }

        if (!fetchResponse.ok) {
          const errMsg = await readUpstreamError(fetchResponse);
          throw new Error(`Kimi API 错误 (${fetchResponse.status}): ${errMsg || fetchResponse.statusText}`);
        }

        let text = '';
        if (fetchResponse.body) {
          const body = fetchResponse.body as any;
          if (typeof body.getReader === 'function') {
            const reader = body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';
              for (const line of lines) {
                const trimmedLine = line.trim();
                if (trimmedLine.startsWith('data: ') && trimmedLine !== 'data: [DONE]') {
                  try {
                    const data = JSON.parse(trimmedLine.slice(6));
                    if (data.choices?.[0]?.delta?.content) {
                      text += data.choices[0].delta.content;
                    }
                  } catch (e) {}
                }
              }
            }
          } else {
            const decoder = new TextDecoder();
            let buffer = '';
            for await (const chunk of body) {
              buffer += decoder.decode(chunk, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';
              for (const line of lines) {
                const trimmedLine = line.trim();
                if (trimmedLine.startsWith('data: ') && trimmedLine !== 'data: [DONE]') {
                  try {
                    const data = JSON.parse(trimmedLine.slice(6));
                    if (data.choices?.[0]?.delta?.content) {
                      text += data.choices[0].delta.content;
                    }
                  } catch (e) {}
                }
              }
            }
          }
        }

        if (!text) {
          throw new Error('Kimi 模型未返回任何文本内容');
        }

        const tags = parseModelJson(text);
        return res.json(tags);
      }

      const finalApiKey = apiKey || process.env.GEMINI_API_KEY;
      if (!finalApiKey) {
        throw new Error('未配置 API Key。请在设置中配置您的 API Key，或在服务器部署环境中配置 GEMINI_API_KEY 环境变量。');
      }

      const client = new GoogleGenAI({
        apiKey: finalApiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const geminiParts: any[] = [{ text: promptText }];
      if (image) {
        geminiParts.push({
          inlineData: {
            data: base64Data,
            mimeType: mimeType,
          },
        });
      }

      const response = await client.models.generateContent({
        model: selectedModel,
        contents: {
          parts: geminiParts,
        },
        config: {
          safetySettings: [
            {
              category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
              threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
              category: HarmCategory.HARM_CATEGORY_HARASSMENT,
              threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
              category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
              threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
              category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
              threshold: HarmBlockThreshold.BLOCK_NONE,
            },
          ],
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              style: {
                type: Type.ARRAY,
                description: 'Tags related to the art style, medium, rendering, lighting, and visual aesthetics.',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    en: { type: Type.STRING, description: 'English prompt tag' },
                    zh: { type: Type.STRING, description: 'Chinese translation' },
                  },
                  required: ['en', 'zh'],
                },
              },
              character: {
                type: Type.ARRAY,
                description: 'Tags describing characters, subjects, clothing, hair, expressions, and physical attributes.',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    en: { type: Type.STRING, description: 'English prompt tag' },
                    zh: { type: Type.STRING, description: 'Chinese translation' },
                  },
                  required: ['en', 'zh'],
                },
              },
              action: {
                type: Type.ARRAY,
                description: 'Tags describing actions, poses, interactions, and dynamic movements.',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    en: { type: Type.STRING, description: 'English prompt tag' },
                    zh: { type: Type.STRING, description: 'Chinese translation' },
                  },
                  required: ['en', 'zh'],
                },
              },
              environment: {
                type: Type.ARRAY,
                description: 'Tags describing the background, setting, scenery, props, and location.',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    en: { type: Type.STRING, description: 'English prompt tag' },
                    zh: { type: Type.STRING, description: 'Chinese translation' },
                  },
                  required: ['en', 'zh'],
                },
              },
              composition: {
                type: Type.ARRAY,
                description: 'Tags related to camera angles, framing, focus, perspective, and image layout.',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    en: { type: Type.STRING, description: 'English prompt tag' },
                    zh: { type: Type.STRING, description: 'Chinese translation' },
                  },
                  required: ['en', 'zh'],
                },
              },
            },
            required: ['style', 'character', 'action', 'environment', 'composition'],
          },
        },
      });

      const text = response.text;
      if (!text) {
        const finishReason = response.candidates?.[0]?.finishReason;
        console.error('Model response:', JSON.stringify(response, null, 2));
        if (finishReason === 'SAFETY') {
          throw new Error('Image analysis blocked by safety filters. Please try another image.');
        }
        throw new Error(`No text generated from model (Finish reason: ${finishReason || 'unknown'})`);
      }

      const tags = parseModelJson(text, response.candidates?.[0]?.finishReason);
      res.json(tags);
    } catch (error) {
      console.error('Error analyzing image:', error);
      res.status(500).json({ error: 'Failed to analyze image', details: error instanceof Error ? error.message : String(error) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
