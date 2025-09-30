// FIX: Removed 'RequestOptions' as it is not an exported member of '@google/genai'.
import { GoogleGenAI, GenerateContentResponse, HarmCategory, HarmBlockThreshold, CountTokensResponse, Type } from "@google/genai";
import { ApiConfig, SafetySetting, ParsedAiResponse, AiChoice } from '../../types/index'; 
// FIX: Corrected constant name from API_SETTINGS_STORAGE_KEY to STORAGE_SETTINGS_STORAGE_KEY.
import { VIETNAMESE, STORAGE_SETTINGS_STORAGE_KEY, HARM_CATEGORIES, DEFAULT_API_CONFIG, AVAILABLE_MODELS, AVAILABLE_AVATAR_ENGINES, DEFAULT_AVATAR_GENERATION_ENGINE } from '../../constants';
import { parseAiResponseText } from "../../utils/responseParser";

// Rate Limiting constants and state
export const RATE_LIMIT_MODEL_ID = 'gemini-2.5-flash';
export const MAX_REQUESTS_PER_MINUTE = 5;
export const TIME_WINDOW_MS = 60 * 1000; // 1 minute
export let requestTimestamps: number[] = [];

let ai: GoogleGenAI | null = null;
let lastUsedEffectiveApiKey: string | null = null;
let lastUsedApiKeySource: 'system' | 'user' | null = null;
let lastUsedModelForClient: string | null = null;
let currentApiKeyIndex = 0; // for round-robin


export const getApiSettings = (): ApiConfig => {
  const storedSettings = localStorage.getItem(STORAGE_SETTINGS_STORAGE_KEY);
  if (storedSettings) {
    try {
      const parsed = JSON.parse(storedSettings);

      const validSafetySettings =
        parsed.safetySettings &&
        Array.isArray(parsed.safetySettings) &&
        parsed.safetySettings.length === HARM_CATEGORIES.length &&
        parsed.safetySettings.every((setting: any) =>
          typeof setting.category === 'string' &&
          typeof setting.threshold === 'string' &&
          HARM_CATEGORIES.some(cat => cat.id === setting.category)
        );
      
      const modelExists = AVAILABLE_MODELS.some(m => m.id === parsed.model);
      const avatarEngineExists = AVAILABLE_AVATAR_ENGINES.some(e => e.id === parsed.avatarGenerationEngine);
      const ragTopKIsValid = typeof parsed.ragTopK === 'number' && parsed.ragTopK >= 0 && parsed.ragTopK <= 500;

      // Handle user API keys with backward compatibility
      let userApiKeys: string[] = [''];
      if (parsed.userApiKeys && Array.isArray(parsed.userApiKeys) && parsed.userApiKeys.length > 0) {
        userApiKeys = parsed.userApiKeys;
      } else if (parsed.userApiKey && typeof parsed.userApiKey === 'string' && parsed.userApiKey.trim() !== '') {
        // Legacy support for old string-based userApiKey
        userApiKeys = [parsed.userApiKey];
      }

      return {
        apiKeySource: parsed.apiKeySource || DEFAULT_API_CONFIG.apiKeySource,
        userApiKeys: userApiKeys,
        model: modelExists ? parsed.model : DEFAULT_API_CONFIG.model,
        economyModel: parsed.economyModel || (modelExists ? parsed.model : DEFAULT_API_CONFIG.model),
        safetySettings: validSafetySettings ? parsed.safetySettings : DEFAULT_API_CONFIG.safetySettings,
        autoGenerateNpcAvatars: parsed.autoGenerateNpcAvatars === undefined ? DEFAULT_API_CONFIG.autoGenerateNpcAvatars : parsed.autoGenerateNpcAvatars,
        avatarGenerationEngine: avatarEngineExists ? parsed.avatarGenerationEngine : DEFAULT_API_CONFIG.avatarGenerationEngine,
        ragTopK: ragTopKIsValid ? parsed.ragTopK : DEFAULT_API_CONFIG.ragTopK,
        temperature: parsed.temperature ?? DEFAULT_API_CONFIG.temperature,
        topK: parsed.topK ?? DEFAULT_API_CONFIG.topK,
        topP: parsed.topP ?? DEFAULT_API_CONFIG.topP,
        thinkingBudget: parsed.thinkingBudget ?? DEFAULT_API_CONFIG.thinkingBudget,
        maxOutputTokens: parsed.maxOutputTokens ?? DEFAULT_API_CONFIG.maxOutputTokens,
        seed: parsed.seed ?? DEFAULT_API_CONFIG.seed,
        useProxy: parsed.useProxy ?? DEFAULT_API_CONFIG.useProxy,
        proxyUrl: parsed.proxyUrl ?? DEFAULT_API_CONFIG.proxyUrl,
      };
    } catch (e) {
      console.error("Failed to parse API settings from localStorage, using defaults:", e);
    }
  }
  return { ...DEFAULT_API_CONFIG }; 
};

export const getAiClient = (): GoogleGenAI => {
  const settings = getApiSettings();
  let effectiveApiKey: string;

  if (settings.apiKeySource === 'system') {
    const systemApiKey = process.env.API_KEY; 

    if (typeof systemApiKey !== 'string' || systemApiKey.trim() === '') {
        throw new Error(VIETNAMESE.apiKeySystemUnavailable + " (API_KEY not found in environment)");
    }
    effectiveApiKey = systemApiKey;
  } else {
    const validKeys = settings.userApiKeys.filter(k => k && k.trim() !== '');
    if (validKeys.length === 0) {
      throw new Error(VIETNAMESE.apiKeyMissing);
    }
    // Round-robin key selection
    if (currentApiKeyIndex >= validKeys.length) {
        currentApiKeyIndex = 0; // Wrap around
    }
    effectiveApiKey = validKeys[currentApiKeyIndex];
    currentApiKeyIndex = (currentApiKeyIndex + 1) % validKeys.length;
  }

  if (!ai || lastUsedApiKeySource !== settings.apiKeySource || lastUsedEffectiveApiKey !== effectiveApiKey || lastUsedModelForClient !== settings.model) {
    try {
      ai = new GoogleGenAI({ apiKey: effectiveApiKey });
      lastUsedEffectiveApiKey = effectiveApiKey;
      lastUsedApiKeySource = settings.apiKeySource;
      lastUsedModelForClient = settings.model; 
    } catch (initError) {
        console.error("Failed to initialize GoogleGenAI client:", initError);
        if (settings.apiKeySource === 'system') {
            throw new Error(`${VIETNAMESE.apiKeySystemUnavailable} Details: ${initError instanceof Error ? initError.message : String(initError)} (Using system key: API_KEY)`);
        } else {
            throw new Error(`Lỗi khởi tạo API Key người dùng: ${initError instanceof Error ? initError.message : String(initError)}`);
        }
    }
  }
  return ai;
};

export const getGenerationConfig = (modelId?: string) => {
    const { safetySettings, temperature, topK, topP, thinkingBudget, maxOutputTokens, seed } = getApiSettings();
    const config: any = { safetySettings };
    if (temperature !== undefined) config.temperature = temperature;
    if (topK !== undefined) config.topK = topK;
    if (topP !== undefined) config.topP = topP;
    if (seed !== undefined) config.seed = seed;
    
    // Handle thinking and token budget specifically for gemini-2.5-flash
    if (modelId === 'gemini-2.5-flash') {
      if (maxOutputTokens !== undefined) {
          config.maxOutputTokens = maxOutputTokens;
          // IMPORTANT: As per Gemini docs, thinkingBudget must be less than maxOutputTokens
          if (thinkingBudget !== undefined) {
              config.thinkingConfig = { thinkingBudget: Math.min(thinkingBudget, maxOutputTokens - 1) };
          }
      } else if (thinkingBudget !== undefined) {
         config.thinkingConfig = { thinkingBudget: thinkingBudget };
      }
    }
    return config;
}

export async function generateContentAndCheck(
    params: { model: string, contents: any, config?: any }
): Promise<GenerateContentResponse> {
    const settings = getApiSettings();
    
    // If proxy is enabled, use fetch to call the proxy server
    if (settings.useProxy && settings.proxyUrl) {
        try {
            // Get effective API key, handling round-robin for user keys
            let effectiveApiKey: string;
            if (settings.apiKeySource === 'system') {
                const systemApiKey = process.env.API_KEY;
                if (typeof systemApiKey !== 'string' || systemApiKey.trim() === '') {
                    throw new Error(VIETNAMESE.apiKeySystemUnavailable + " (API_KEY not found in environment for proxy)");
                }
                effectiveApiKey = systemApiKey;
            } else {
                const validKeys = settings.userApiKeys.filter(k => k && k.trim() !== '');
                if (validKeys.length === 0) {
                     const systemApiKey = process.env.API_KEY;
                     if (!systemApiKey) {
                        throw new Error("Proxy is enabled, but no user API keys are set and no system API key is available.");
                     }
                     effectiveApiKey = systemApiKey;
                } else {
                    if (currentApiKeyIndex >= validKeys.length) currentApiKeyIndex = 0;
                    effectiveApiKey = validKeys[currentApiKeyIndex];
                    currentApiKeyIndex = (currentApiKeyIndex + 1) % validKeys.length;
                }
            }
            
            let finalProxyUrl = settings.proxyUrl.trim();
            if (finalProxyUrl && !finalProxyUrl.startsWith('http://') && !finalProxyUrl.startsWith('https://')) {
                finalProxyUrl = 'http://' + finalProxyUrl;
            }
            
            // Construct the final URL including the model path and API key
            const modelPath = `/v1beta/models/${params.model}:generateContent?key=${effectiveApiKey}`;
            const fullProxyUrl = new URL(modelPath, finalProxyUrl).toString();

            // The body for the request should not contain the 'model' key
            const { model, ...bodyForProxy } = params;

            const proxyResponse = await fetch(fullProxyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(bodyForProxy),
            });

            // CORRECTED LOGIC: Read body as text ONCE.
            const responseText = await proxyResponse.text();

            if (!proxyResponse.ok) {
                let errorDetails = responseText; // Default to raw text
                try {
                    // TRY to parse the text as JSON.
                    const errorJson = JSON.parse(responseText);
                    errorDetails = errorJson.error?.message || JSON.stringify(errorJson);
                } catch {
                    // It's not JSON, so errorDetails already correctly contains the raw text.
                }
                throw new Error(`Proxy server error: ${proxyResponse.status} - ${errorDetails}`);
            }

            // Now, parse the successful response text as JSON.
            const data = JSON.parse(responseText);
            
            // Manually extract text from the first candidate's content part.
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

            // Reconstruct a GenerateContentResponse-like object.
            const fakeResponse: GenerateContentResponse = {
                text: text,
                candidates: data.candidates || [],
            } as any; 

            return fakeResponse;

        } catch (error) {
            console.error("Error calling proxy server:", error);
            const userMessage = error instanceof Error ? error.message : "Unknown proxy error.";
            throw new Error(`Lỗi kết nối đến proxy: ${userMessage}`);
        }
    }

    // Default behavior: call Gemini API directly
    const ai = getAiClient();
    const baseConfig = getGenerationConfig(params.model);
    const finalConfig = { ...baseConfig, ...params.config };
    
    const response = await ai.models.generateContent({ ...params, config: finalConfig });
    
    if (!response.text && !response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
        throw new Error("Phản hồi từ AI trống. Điều này có thể do bộ lọc nội dung. Vui lòng thử một hành động khác hoặc lùi lượt.");
    }
    
    return response;
}

export async function countTokens(text: string): Promise<number> {
    const ai = getAiClient();
    const { model } = getApiSettings();
    const response: CountTokensResponse = await ai.models.countTokens({
        model,
        contents: [{ parts: [{ text }] }],
    });
    return response.totalTokens;
}

export async function generateContentWithRateLimit(
    prompt: string, 
    modelId: string, 
    onPromptConstructed?: (prompt: string) => void,
    config?: any
): Promise<{response: ParsedAiResponse, rawText: string, constructedPrompt: string}> {
    if (onPromptConstructed) {
        onPromptConstructed(prompt);
    }
    
    const response = await generateContentAndCheck({
        model: modelId,
        contents: [{ parts: [{ text: prompt }] }],
        config,
    });
    const rawText = response.text;
    const parsedResponse = parseAiResponseText(rawText);
    parsedResponse.groundingMetadata = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    return { response: parsedResponse, rawText, constructedPrompt: prompt };
}