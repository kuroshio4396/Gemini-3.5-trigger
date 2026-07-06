import { GoogleGenAI, HarmCategory, HarmBlockThreshold, Type } from '@google/genai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { image, mimeType, textInput, apiKey, model, filterR18, multiCharacterMode, apiProvider } = req.body;
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

    let base64Data = "";
    if (image) {
      base64Data = image.replace(/^data:image\/\w+;base64,/, '');
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

      const fetchResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
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

      if (!fetchResponse.ok) {
        const errData = await fetchResponse.json().catch(() => ({}));
        throw new Error(`OpenRouter Error: ${errData.error?.message || fetchResponse.statusText}`);
      }

      const data = await fetchResponse.json();
      let text = data.choices?.[0]?.message?.content;
      if (!text) {
        throw new Error('No text generated from OpenRouter model');
      }

      if (text.startsWith('```json')) {
        text = text.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      }

      const tags = JSON.parse(text);
      return res.json(tags);
    }

    if (apiProvider === 'kimi') {
      if (!apiKey) {
        throw new Error('未配置 Kimi API Key。请在设置中配置您的 API Key。');
      }
      const jsonInstruction = "\n\nIMPORTANT: You must return the output STRICTLY as a valid JSON object with keys: 'style', 'character', 'action', 'environment', 'composition'. Each key must be an array of objects with 'en' and 'zh' string keys. Do not include markdown formatting or backticks around the JSON. Remove any trailing commas.";
      
      const contentParts: any[] = [{ type: 'text', text: promptText + jsonInstruction }];
      if (image) {
        contentParts.push({ type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } });
      }

      const fetchResponse = await fetch('https://api.kimi.com/coding/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            {
              role: 'user',
              content: contentParts
            }
          ],
          response_format: { type: 'json_object' }
        })
      });

      if (!fetchResponse.ok) {
        const errData = await fetchResponse.json().catch(() => ({}));
        throw new Error(`Kimi Error: ${errData.error?.message || fetchResponse.statusText}`);
      }

      const data = await fetchResponse.json();
      let text = data.choices?.[0]?.message?.content;
      if (!text) {
        throw new Error('No text generated from Kimi model');
      }

      if (text.startsWith('```json')) {
        text = text.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      }
      if (text.startsWith('```')) {
        text = text.replace(/^```\n?/, '').replace(/\n?```$/, '');
      }

      const tags = JSON.parse(text);
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

    const aiResponse = await client.models.generateContent({
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

    const text = aiResponse.text;
    if (!text) {
      const finishReason = aiResponse.candidates?.[0]?.finishReason;
      console.error('Model response:', JSON.stringify(aiResponse, null, 2));
      if (finishReason === 'SAFETY') {
        throw new Error('Image analysis blocked by safety filters. Please try another image.');
      }
      throw new Error(`No text generated from model (Finish reason: ${finishReason || 'unknown'})`);
    }

    const tags = JSON.parse(text);
    return res.json(tags);
  } catch (error) {
    console.error('Error analyzing image:', error);
    return res.status(500).json({ error: 'Failed to analyze image', details: error instanceof Error ? error.message : String(error) });
  }
}
