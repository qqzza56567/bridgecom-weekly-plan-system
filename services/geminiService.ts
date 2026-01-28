import { GoogleGenAI, Type } from "@google/genai";

// WARNING: Frontend API keys are exposed to the client. 
// For production, it is strongly recommended to move this logic to a Supabase Edge Function 
// or a proxy server to keep your API key secure.
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export interface SmartValidationResult {
  index: number;
  isValid: boolean;
  feedback: string;
}

export const validateSmartGoals = async (goals: string[]): Promise<SmartValidationResult[]> => {
  const isPlaceholder = !apiKey || apiKey === 'PLACEHOLDER_API_KEY';

  console.log("Checking API Key...", apiKey ? "Key exists" : "Key is empty");
  if (isPlaceholder) {
    console.warn("Gemini API Key is placeholder or missing. Mode: MOCK");
    // Return a mock result that accepts all goals for smooth development
    return goals.map((_, i) => ({
      index: i,
      isValid: true,
      feedback: "本地測試模式：驗證已跳過。"
    }));
  }

  const modelId = "gemini-2.0-flash"; // 升級為 2.0-flash 版本

  const prompt = `
    你是一位溫和且實用的生產力教練。請分析這三個「每日目標」是否符合基本的計畫邏輯。
    
    我們的標準是「實用的每日計畫」，不需要像正式週報那樣完美，但要避免完全模糊。
    
    判斷規則：
    1. 稍微寬鬆：只要有具體的動作或對象，就視為通過。
       - 例如：「完成2次面試」 (OK, 雖然沒寫對象，但有具體動作和次數)
       - 例如：「購買1台電腦」 (OK, 行動明確)
       - 例如：「取得客戶資料」 (OK, 雖然簡單但明確)
    2. 禁止完全模糊：
       - 例如：「工作」、「開會」、「123」、「測試」、「hahaha」 (不通過，太模糊)
    
    輸入目標：
    1. ${goals[0]}
    2. ${goals[1]}
    3. ${goals[2]}

    請回傳一個 JSON 陣列，包含 isValid (布林值) 和 feedback (短建議)。
    若通過，feedback 可以是簡單的鼓勵；若不通過，請提供一個親切的修正建議。
    請使用繁體中文 (台灣)。同步保持判斷的一致性。
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        temperature: 0.1, // 低隨機性，確保同樣的內容會得到同樣的結果
        topP: 0.95,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              index: { type: Type.INTEGER },
              isValid: { type: Type.BOOLEAN },
              feedback: { type: Type.STRING }
            },
            required: ["index", "isValid", "feedback"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) return [];

    return JSON.parse(text) as SmartValidationResult[];

  } catch (error) {
    console.error("Gemini validation error:", error);
    return goals.map((_, i) => ({
      index: i,
      isValid: false,
      feedback: "無法連接 AI 服務進行驗證。"
    }));
  }
};