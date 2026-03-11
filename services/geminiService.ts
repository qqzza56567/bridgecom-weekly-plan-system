import { WeeklyPlanSubmission, MonthlyReportData } from "../types";
import { supabase } from "../supabaseClient";

// ─────────────────────────────────────────────────────────────
// Gemini Proxy Helper
//
// All Gemini API calls now go through a Supabase Edge Function
// (gemini-proxy). The actual GEMINI_API_KEY lives only on the
// server side and is never exposed to the browser.
// ─────────────────────────────────────────────────────────────

/**
 * Calls the gemini-proxy Edge Function with the given action and prompt.
 * Returns the parsed JSON result from Gemini.
 */
async function callGeminiProxy<T>(action: string, prompt: string): Promise<T> {
  const { data, error } = await supabase.functions.invoke('gemini-proxy', {
    body: { action, prompt }
  });

  if (error) {
    throw new Error(`Gemini proxy error [${action}]: ${error.message}`);
  }

  return data.result as T;
}

/** True when running locally without a real Supabase project (CI / dev mock mode). */
const isMockMode = import.meta.env.DEV && !import.meta.env.VITE_SUPABASE_URL;

export interface SmartValidationResult {
  index: number;
  isValid: boolean;
  feedback: string;
}

export const validateSmartGoals = async (goals: string[]): Promise<SmartValidationResult[]> => {
  if (isMockMode) {
    console.warn("[geminiService] MOCK MODE: skipping validateSmartGoals");
    return goals.map((_, i) => ({ index: i, isValid: true, feedback: "本地測試模式：驗證已跳過。" }));
  }

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
    return await callGeminiProxy<SmartValidationResult[]>('validateSmartGoals', prompt);
  } catch (error) {
    console.error("Gemini validateSmartGoals error:", error);
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
  const isPlaceholder = isMockMode;

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

  // Schema constraints are now handled by explicit prompts and proxy's JSON mimeType.

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
    const parsedResult = await callGeminiProxy<any>('validateWeeklyTask', prompt);
    
    return {
      taskId,
      isValid: parsedResult.status !== 'critical',
      status: parsedResult.status,
      nameFeedback: parsedResult.nameFeedback || undefined,
      outcomeFeedback: parsedResult.outcomeFeedback || undefined
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
  const isPlaceholder = isMockMode;

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

  // Schema constraints are now handled by explicit prompts and proxy's JSON mimeType.

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
    const parsed = await callGeminiProxy<any>('validatePlanContent', prompt);
    
    const resultMap: Record<string, WeeklyTaskValidationResult> = {};
    let allValid = true;

    if (parsed && Array.isArray(parsed.results)) {
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
    }

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

export interface DailyTaskEvaluation {
  date: string;
  task: string;
  isAligned: boolean;
  reason: string;
}

export interface WeeklyReportData {
  statusTheme: 'red' | 'yellow' | 'green';
  statusText: string;
  totalTasks: number;
  unplannedTasks: number;
  unplannedRatio: number;
  alignedTasks: number;
  taskEvaluations: DailyTaskEvaluation[];
  ai: {
    critical: string | null;
    suggestion: string;
    highlight: string | null;
  }
}

export const generateWeeklyReport = async (
  userName: string,
  userRole: string,
  weeklyTasks: { name: string; outcome: string; priority: string }[],
  dailyPlans: { date: string; goals: string[] }[]
): Promise<WeeklyReportData | null> => {
  const isPlaceholder = isMockMode;

  if (isPlaceholder) {
    console.warn("Gemini API Key is placeholder. Mode: MOCK REPORT");
    return {
      statusTheme: 'yellow',
      statusText: '偏離注意 (65% 對齊) [MOCK]',
      totalTasks: 15,
      unplannedTasks: 5,
      unplannedRatio: 33,
      alignedTasks: 10,
      taskEvaluations: [],
      ai: {
        critical: '週四與週五出現大量未在週計畫內的臨時任務。',
        suggestion: '建議與該同仁進行 1on1，確認是否有過度塞單的狀況。',
        highlight: '週三的任務執行效率極高。'
      }
    };
  }

  // Schema constraints are now handled by explicit prompts and proxy's JSON mimeType.

  const prompt = `
    你是一位專業的人力資源與績效管理顧問。
    請分析員工「${userName}」(${userRole}) 過去一週的「每日曉三計畫 (Daily Goals)」與「原定週計畫 (Weekly Plan)」的關聯度，並產生結構化的診斷報告。

    【原定週計畫任務】：
    ${JSON.stringify(weeklyTasks, null, 2)}

    【每日實際填寫的曉三計畫】：
    ${JSON.stringify(dailyPlans, null, 2)}

    【分析步驟與定義】：
    1. 計算本週實際填寫的每日總任務數 (totalTasks)。
    2. 比對每日任務與週計畫任務。判斷哪些每日任務是「有對齊原計畫」的(alignedTasks)，哪些是「臨時插單/未在原計畫內」的(unplannedTasks)。
    3. 計算 unplannedRatio = (unplannedTasks / totalTasks) * 100，四捨五入到整數。如果 totalTasks 是 0，則數值為 0。
    4. 針對每一天的每一項具體曉三計畫任務，評估其是否與「原定週計畫任務」相關 (有對齊為 isAligned: true，臨時插單為 isAligned: false)，並簡述極短的判定理由 (reason)。將所有評估結果放進 taskEvaluations 陣列中。
    5. 依據 unplannedRatio 及質性分析給予整體狀態燈號 (statusTheme):
       - 🟢 green: 高度對齊 (unplannedRatio < 20%)
       - 🟡 yellow: 偏離注意 (unplannedRatio 介於 20% ~ 50%)
       - 🔴 red: 嚴重偏離 (unplannedRatio > 50%) 或 有明顯的方向錯誤。
    6. 產生對應長度的 statusText，例如「高度對齊 (92% 對齊)」、「嚴重偏離 (40% 對齊)」。
    7. 提供具體的 AI 洞察 (ai 物件):
       - critical: 如果有嚴重的偏誤、大量插單、或連續幾天沒推進核心任務，請具體指出是哪一天、什麼任務造成的。若無嚴重問題傳回 null。
       - suggestion: 給主管的一段溝通建議 (例如該不該找員工 1on1，或該如何讚賞)。
       - highlight: 表現優異的亮點 (例如某天專注完成了重要計畫)。若無明顯亮點傳回 null。

    請使用繁體中文 (台灣) 回覆，文字風格要專業且簡潔。
  `;

  try {
    return await callGeminiProxy<WeeklyReportData>('generateWeeklyReport', prompt);
  } catch (error) {
    console.error("Gemini weekly report error:", error);
    return null;
  }
};

export const generateMonthlyExecutiveReport = async (userName: string, userRole: string, monthLabel: string, plans: WeeklyPlanSubmission[]): Promise<MonthlyReportData | null> => {
  const isPlaceholder = isMockMode;

  if (isPlaceholder) {
    return {
      strategicFocus: {
        averageUnplannedRatio: 35,
        alignedTasks: 45,
        unplannedTasks: 25
      },
      executionReliability: {
        completionRate: 85,
        estimationDeviation: -5
      },
      topAchievements: [
        "順利完成核心系統的資料庫轉移，確保服務穩定性 (MOCK)",
        "帶領團隊提早交付月底主打功能 (MOCK)"
      ],
      systemicObstacles: "跨部門溝通成本偏高，導致多項計畫初期延宕 (MOCK)",
      managementAction: "建議賦予該員更多專案主導權，並協助排除跨部門協調障礙 (MOCK)"
    };
  }

  let alignedTasks = 0;
  let unplannedTasks = 0;
  let totalTasksCount = 0;
  let highCompletionTasks = 0;
  let totalEstimatedHours = 0;
  let totalActualHours = 0;
  let planTaskCountForCompletion = 0; // 用於計算完成率的基數
  let weeksWithAiReport = 0; // 有 AI 週報的週數，用於計算數據品質

  for (const p of plans) {
    if (p.aiReport) {
      // 若該週有 AI 審查紀錄，採用 AI 比對每日計畫與週計畫算出的真實插單與對齊數
      totalTasksCount += (p.aiReport.totalTasks || 0);
      alignedTasks += (p.aiReport.alignedTasks || 0);
      unplannedTasks += (p.aiReport.unplannedTasks || 0);
      weeksWithAiReport++;
    }
    // ✅ 修正：若無 AI 週報，不再以「類別」錯誤推算插單數。
    // 原因：「其他事項」≠「臨時插單」，員工可能事先規劃行政工作。
    // 無數据的週次將體現在 dataQuality 指標中，於 UI 顯示警告。

    // 完成率與工時偏差這類「原定計畫執行度」指標，則是絕對看 p.tasks
    for (const t of p.tasks) {
      planTaskCountForCompletion++;
      if (t.progress >= 80) {
        highCompletionTasks++;
      }
      totalEstimatedHours += (Number(t.hours) || 0);
      totalActualHours += (Number(t.actualHours) || 0);
    }
  }

  // dataQuality: 有 AI 週報的週數 / 總週數，決定插單率數據是否可信
  const dataQuality = plans.length > 0
    ? Math.round((weeksWithAiReport / plans.length) * 100)
    : 0;

  // 統一由系統客觀計算；若 dataQuality=0 則插單率無意義（保留為 0 供 UI 判斷隱藏）
  const averageUnplannedRatio = totalTasksCount > 0 ? Math.round((unplannedTasks / totalTasksCount) * 100) : 0;
  const completionRate = planTaskCountForCompletion > 0 ? Math.round((highCompletionTasks / planTaskCountForCompletion) * 100) : 0;

  // 工時預估偏差算法: ((總真實工時 - 總預估工時) / 總預估工時) * 100
  // 正數 = 高估預估 (實際花的時間比較少) / 負數 = 低估預估 (實際花的時間超過預期)
  const estimationDeviation = totalEstimatedHours > 0
    ? Math.round(((totalActualHours - totalEstimatedHours) / totalEstimatedHours) * 100)
    : 0;

  const calculatedMetrics = {
    dataQuality,
    strategicFocus: {
      averageUnplannedRatio,
      alignedTasks,
      unplannedTasks
    },
    executionReliability: {
      completionRate,
      estimationDeviation
    }
  };

  // Schema constraints are now handled by explicit prompts and proxy's JSON mimeType.

  // 整理用於分析的精簡資料，避免爆 Token
  const monthDataSummary = plans.map(p => {
    const aiSummary = p.aiReport ? {
      aiCritical: p.aiReport.ai.critical,
      aiHighlight: p.aiReport.ai.highlight
    } : null;

    return {
      weekStart: p.weekStart,
      tasks: p.tasks.map(t => ({
        name: t.name,
        category: t.category,
        estimatedHours: t.hours,
        actualHours: t.actualHours,
        progress: t.progress
      })),
      aiSummary: aiSummary
    };
  });

  const prompt = `
    你是一位擁有豐富管理經驗的企業高層幕僚與人資顧問。
    請分析員工「${userName}」(${userRole}) 在「${monthLabel}」整個月的週計畫執行總結，撰寫一份專供總經理/高階主管閱讀的【月度人才戰情洞察報告】(Monthly Executive Report)。
    
    【高層閱讀原則】：
    - 不要流水帳。高層不在乎每天做了什麼雜事。
    - 關注宏觀趨勢：戰略對齊度 (Strategic Focus)、執行可靠度 (Reliability & Execution)。
    - 挖掘系統性風險與高光時刻。

    【穩定化與客觀性限制 (絕對遵守)】：
    - 切勿隨機捏造任何細節，務必「完全且僅能」基於下方提供的歷史數據作客觀運算與摘要。
    - 用詞需高度模式化、收斂，不應該有過度的發散描述。
    
    【系統已事前結算出的客觀指標供您參考】：
    ${JSON.stringify(calculatedMetrics, null, 2)}
    
    【本月任務明細與各週報告重點】：
    ${JSON.stringify(monthDataSummary, null, 2)}
    
    【請依照以下結構分析並回傳 JSON】：
    1. topAchievements (本月高光成就):
       - 提煉出 1 到 3 句話，依據進度(progress)最高的核心任務摘要貢獻。請直接平鋪直敘，不加額外的主觀修飾語。
    2. systemicObstacles (系統性的摩擦與風險警告):
       - 綜合觀察是否有反覆出現的延遲原因、大量插單、或倦怠與離職風險警報 (可參考系統計算出的客觀指標，如高插單率與低完成率)。
       - 例如："連續三週皆投入超過 60% 處理非預期客訴，建議檢視一線人力配置" 或 "本月無明顯風險"。若都極順利無風險請給 null。
    3. managementAction (人才管理建議):
       - 給高層的唯一一句總結行動建議 (基於前述客觀指標給予制式化建議，如：是否考慮晉升/獎勵、或約談重新釐清專注範圍)。

    請使用繁體中文 (台灣)。語氣冷靜、專業、直擊痛點。
  `;

  try {
    const aiTextReport = await callGeminiProxy<any>('generateMonthlyReport', prompt);

    // 合併 TypeScript 計算出的精確數據與 AI 生成的文字洞察
    return {
      ...calculatedMetrics,
      topAchievements: aiTextReport.topAchievements,
      systemicObstacles: aiTextReport.systemicObstacles,
      managementAction: aiTextReport.managementAction
    } as MonthlyReportData;
  } catch (error) {
    console.error("Gemini monthly report error:", error);
    return null;
  }
};