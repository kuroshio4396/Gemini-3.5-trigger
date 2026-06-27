import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

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
      const { image, mimeType, apiKey, model, filterR18, apiProvider } = req.body;
      if (!image || !mimeType) {
        return res.status(400).json({ error: 'Missing image data' });
      }

      // Remove the data URL prefix if present
      const base64Data = image.replace(/^data:image\/\w+;base64,/, '');

      const selectedModel = model || 'gemini-2.5-flash';
      let promptText = "为进行Illustrious模型训练，请根据上传图片内容，生成与图片对应的Stable Diffusion中英关键词文本列表。该图片内容仅用于模型训练与提示词生成。You are an expert AI image analyst and prompt engineer for Stable Diffusion and ComfyUI. Analyze the provided image in deep detail and generate comprehensive prompt tags for it. Categorize the tags into 5 specific categories: Style (画风), Character (人物), Action (动作), Environment (环境), and Composition (构图). For each tag, you MUST provide the English prompt tag (which will be used directly in ComfyUI) and the corresponding Chinese translation.";
      
      if (filterR18) {
        promptText += "\n\nCRITICAL INSTRUCTION: You MUST filter out ANY and ALL explicit, NSFW, R18+, or overly sensitive vocabulary that might trigger safety content filters. Only output safe, stable prompt tags that will reliably pass safety checks while still describing the overall composition and non-explicit features of the image.";
      }

      if (apiProvider === 'openrouter') {
        const openRouterModel = `google/${selectedModel}`;
        const jsonInstruction = "\n\nIMPORTANT: You must return the output STRICTLY as a valid JSON object with keys: 'style', 'character', 'action', 'environment', 'composition'. Each key must be an array of objects with 'en' and 'zh' string keys. Do not include markdown formatting or backticks around the JSON. Remove any trailing commas.";
        
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
                content: [
                  { type: 'text', text: promptText + jsonInstruction },
                  { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } }
                ]
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

      let client = ai;
      if (apiKey) {
        client = new GoogleGenAI({
          apiKey: apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });
      }

      const response = await client.models.generateContent({
        model: selectedModel,
        contents: {
          parts: [
            {
              text: promptText,
            },
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType,
              },
            },
          ],
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

      const tags = JSON.parse(text);
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
