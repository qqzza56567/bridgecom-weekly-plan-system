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
    你是一位嚴格且實用的生產力教練。請分析這三個「每日目標」是否符合具體工作產出的標準。
    
    我們的標準是「具體的工作產出」，必須包含**動詞 + 具體工作內容**，且不能是日常瑣事。
    
    判斷規則：
    1. ✅ **通過 (Valid)**：
       - 必須有**明確的動作 (Verb)** 和 **具體的工作對象 (Specific Noun)**。
       - 例如：「完成2次面試」、「撰寫Q3財報初稿」、「拜訪A客戶提案」、「修復登入頁面Bug」。
    
    2. ❌ **不通過 (Invalid)**：
       - **日常瑣事**：如「吃飯」、「睡覺」、「休息」、「運動」、「起床」。(這是工作計畫，不是生活流水帳)
       - **過於籠統**：如「寫程式」(寫什麼?)、「開會」(開什麼會?)、「做報告」(哪份報告?)。
       - **單一名詞**：如「財報」、「客戶」、「專案」。
       - **無意義字元**：如「123」、「hahaha」。
    
    輸入目標：
    1. ${goals[0]}
    2. ${goals[1]}
    3. ${goals[2]}

    請回傳一個 JSON 陣列，包含 isValid (布林值) 和 feedback (短建議)。
    若通過，feedback 請給予簡單的肯定；
    若不通過，請提供**具體的修改建議**（例如：將「寫程式」改為「完成首頁切版」）。
    請使用繁體中文 (台灣)。同步保持判斷的一致性。
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        temperature: 0.0, // 零隨機性，確保結果一致
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

export interface WeeklyTaskValidationResult {
  taskId: string;
  isValid: boolean; // True if status is 'valid' or 'warning'
  status: 'valid' | 'warning' | 'critical';
  nameFeedback?: string;
  outcomeFeedback?: string;
}

export const validateWeeklyTask = async (taskId: string, name: string, outcome: string): Promise<WeeklyTaskValidationResult> => {
  const isPlaceholder = !apiKey || apiKey === 'PLACEHOLDER_API_KEY';

  if (isPlaceholder) {
    console.warn("Gemini API Key is placeholder or missing. Mode: MOCK");
    return {
      taskId,
      isValid: true,
      status: 'valid',
      nameFeedback: "本地測試模式：名稱驗證通過",
      outcomeFeedback: "本地測試模式：成果驗證通過"
    };
  }

  const modelId = "gemini-2.0-flash";

  const prompt = `
    你是一位專業的績效管理教練。請驗證以下週計畫任務，並根據 **S.M.A.R.T. 原則** (Specific & Measurable) 與**字數規範**給予紅綠燈評價。

    **審核標準 (Pass/Fail System)**：

    1. 🔴 **紅燈 (Critical) - 不通過**
       - **結構錯誤**：完全不符合「動詞 + 名詞」結構，或內容過於模糊（如「開會」、「處理」、「123」）。
       - **預期成果錯誤**：❌ **必須是具體的交付物或狀態**。若寫「無」、「做完」、「努力中」、「如期完成」，直接紅燈。
       - **字數不足**：由原先的黃燈改為紅燈。內容雖有意義但**字數過少 (少於 5 個字)**，資訊量不足（如「寫報告」），直接紅燈。
       - **缺乏數據**：符合結構但缺乏具體數據或對象細節（如「拜訪客戶」），直接紅燈。
       - **結果**：\`status: 'critical'\`。

    2. 🟢 **綠燈 (Valid) - 通過**
       - **條件**：具體、可衡量，且字數充足 (>5 字) 能表達完整語意。
       - **結果**：\`status: 'valid'\`。

    **任務資訊**：
    - 任務名稱：${name}
    - 預期成果：${outcome}

    請回傳一個 JSON 物件，格式如下：
    {
      "status": "valid" | "critical",
      "nameFeedback": string | null, // 若非 valid，提供具體修改建議；若 valid 則為 null
      "outcomeFeedback": string | null // 若非 valid，提供具體修改建議；若 valid 則為 null
    }
    
    請使用繁體中文 (台灣)。
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        temperature: 0.0,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            status: { type: Type.STRING, enum: ["valid", "critical"] },
            nameFeedback: { type: Type.STRING, nullable: true },
            outcomeFeedback: { type: Type.STRING, nullable: true }
          },
          required: ["status"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    const result = JSON.parse(text);
    return {
      taskId,
      isValid: result.status !== 'critical',
      status: result.status,
      nameFeedback: result.nameFeedback || undefined,
      outcomeFeedback: result.outcomeFeedback || undefined
    };

  } catch (error) {
    console.error("Gemini validation error:", error);
    return {
      taskId,
      isValid: false,
      status: 'critical',
      nameFeedback: "AI 連線錯誤",
      outcomeFeedback: "請稍後再試"
    };
  }
};

export interface PlanValidationResult {
  isValid: boolean;
  results: Record<string, WeeklyTaskValidationResult>;
}

export const validatePlanContent = async (tasks: { id: string; name: string; outcome: string }[]): Promise<PlanValidationResult> => {
  const isPlaceholder = !apiKey || apiKey === 'PLACEHOLDER_API_KEY';

  if (isPlaceholder) {
    console.warn("Gemini API Key is placeholder. Mode: MOCK BATCH");
    const results: Record<string, WeeklyTaskValidationResult> = {};
    tasks.forEach(task => {
      results[task.id] = {
        taskId: task.id,
        isValid: true,
        status: 'valid',
        nameFeedback: "本地測試模式：通過",
        outcomeFeedback: "本地測試模式：通過"
      };
    });
    return { isValid: true, results };
  }

  const modelId = "gemini-2.0-flash";

  const tasksJson = JSON.stringify(tasks.map(t => ({ id: t.id, name: t.name, outcome: t.outcome })));

  const prompt = `
    你是一位**嚴格但有建設性**的績效教練。請審查以下週計畫任務，並根據 **S.M.A.R.T. 原則** (Specific & Measurable) 與**字數規範**給予紅綠燈評價。
    
    **審核標準 (Pass/Fail System)**：

    1. 🔴 **紅燈 (Critical) - 不通過**
       - **結構錯誤**：完全不符合「動詞 + 名詞」結構，或內容過於模糊（如「開會」、「處理」、「研究」）。
       - **預期成果錯誤**：❌ **必須是具體的交付物或狀態**。若寫「無」、「做完」、「努力中」、「如期完成」，直接紅燈。
       - **字數/數據不足**：原本的「黃燈」標準現在改為**紅燈**。
         - **條件 A (太短)**：字數少於 5 個字（如「寫報告」），直接紅燈。
         - **條件 B (缺乏數據)**：缺乏具體數據或對象細節（如「拜訪客戶」），直接紅燈。
       - **結果**：\`status: 'critical'\`。

    2. 🟢 **綠燈 (Valid) - 通過**
       - **條件**：具體、可衡量，且字數充足 (>5 字) 能表達完整語意。
       - **範例**：✅「撰寫 Q3 結案報告」、✅「拜訪 A 客戶並確認需求」、✅「產出 API v1.0 文件」。
       - **結果**：\`status: 'valid'\`。

    **最高原則 (Self-Consistency)**：
    - 若判定 **Critical**，請確保你提供的建議內容**具體且可行**。
    - **一致性**：若內容處於邊緣地帶但符合基本定義，請傾向給予 **Green (Valid)** 以避免反覆修改。

    待審查任務列表 (JSON):
    ${tasksJson}

    請回傳一個 JSON 物件，格式如下：
    {
      "results": [
        {
          "id": "任務ID (對應輸入)",
          "status": "valid" | "critical",
          "nameFeedback": "若非 valid，提供修改建議；若 valid 則為 null",
          "outcomeFeedback": "若非 valid，提供修改建議；若 valid 則為 null"
        }
      ]
    }
    
    請使用繁體中文 (台灣)。
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        temperature: 0.0,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            results: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  status: { type: Type.STRING, enum: ["valid", "critical"] },
                  nameFeedback: { type: Type.STRING, nullable: true },
                  outcomeFeedback: { type: Type.STRING, nullable: true }
                },
                required: ["id", "status"]
              }
            }
          },
          required: ["results"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    const parsed = JSON.parse(text);
    const resultMap: Record<string, WeeklyTaskValidationResult> = {};
    let allValid = true;

    parsed.results.forEach((item: any) => {
      // Critical is the only blocking state
      if (item.status === 'critical') allValid = false;

      resultMap[item.id] = {
        taskId: item.id,
        isValid: item.status !== 'critical',
        status: item.status,
        nameFeedback: item.nameFeedback || undefined,
        outcomeFeedback: item.outcomeFeedback || undefined
      };
    });

    return { isValid: allValid, results: resultMap };

  } catch (error) {
    console.error("Gemini batch validation error:", error);
    // Fallback: assume valid to not block user if AI fails
    const results: Record<string, WeeklyTaskValidationResult> = {};
    tasks.forEach(task => {
      results[task.id] = { taskId: task.id, isValid: true, status: 'valid' };
    });
    return { isValid: true, results };
  }
};