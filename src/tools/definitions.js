/**
 * EKMS MCP Tools Definitions
 * 定義所有可供 Claude 調用的知識庫工具
 */

export const tools = [
  {
    name: "search_knowledge",
    description: `搜尋企業知識庫。支援三種搜尋模式：
- hybrid: 混合搜尋（關鍵字 + 語意），最佳平衡
- semantic: 純語意搜尋，理解意圖但可能漏掉精確匹配
- keyword: 純關鍵字搜尋，精確但可能漏掉同義詞

知識類型包含：product_info（產品資訊）、faq（常見問題）、policy（政策規定）、
announcement（公告）、tutorial（教學）、troubleshooting（故障排除）、
best_practice（最佳實踐）、case_study（案例研究）、glossary（術語）、other（其他）`,
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "搜尋查詢文字"
        },
        searchType: {
          type: "string",
          enum: ["hybrid", "semantic", "keyword"],
          default: "hybrid",
          description: "搜尋模式"
        },
        knowledgeTypes: {
          type: "array",
          items: { type: "string" },
          description: "過濾特定知識類型（可選）"
        },
        customerName: {
          type: "string",
          description: "過濾特定客戶的知識（可選）"
        },
        limit: {
          type: "number",
          default: 10,
          description: "返回結果數量上限"
        },
        includeRelated: {
          type: "boolean",
          default: false,
          description: "是否包含相關知識（知識圖譜）"
        }
      },
      required: ["query"]
    }
  },
  {
    name: "recommend_knowledge",
    description: `根據對話上下文和客戶特徵推薦相關知識。
可根據 Big Five 人格特質和健康分數進行個人化推薦：
- openness: 開放性（高=喜歡延伸資訊，低=只要核心答案）
- conscientiousness: 盡責性（高=詳細步驟，低=簡潔重點）
- extraversion: 外向性
- agreeableness: 親和性
- neuroticism: 神經質（高=需要更多安撫）
健康分數 0-100，低分客戶需要更多關懷`,
    inputSchema: {
      type: "object",
      properties: {
        context: {
          type: "string",
          description: "當前對話上下文或客戶問題"
        },
        customerName: {
          type: "string",
          description: "客戶名稱（用於個人化）"
        },
        personalityScores: {
          type: "object",
          properties: {
            openness: { type: "number", minimum: 0, maximum: 1 },
            conscientiousness: { type: "number", minimum: 0, maximum: 1 },
            extraversion: { type: "number", minimum: 0, maximum: 1 },
            agreeableness: { type: "number", minimum: 0, maximum: 1 },
            neuroticism: { type: "number", minimum: 0, maximum: 1 }
          },
          description: "Big Five 人格特質分數（0-1）"
        },
        healthScore: {
          type: "number",
          minimum: 0,
          maximum: 100,
          description: "客戶健康分數"
        },
        limit: {
          type: "number",
          default: 5,
          description: "推薦數量上限"
        }
      },
      required: ["context"]
    }
  },
  {
    name: "get_knowledge_item",
    description: "根據 ID 取得特定知識項目的完整內容，包含所有元資料和關聯知識",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "知識項目的 UUID"
        },
        includeRelations: {
          type: "boolean",
          default: true,
          description: "是否包含關聯知識"
        }
      },
      required: ["id"]
    }
  },
  {
    name: "list_knowledge_types",
    description: "列出所有可用的知識類型及其說明，用於了解知識庫結構",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "list_customers",
    description: "列出知識庫中所有客戶名稱，用於過濾特定客戶的知識",
    inputSchema: {
      type: "object",
      properties: {
        includeStats: {
          type: "boolean",
          default: false,
          description: "是否包含各客戶的知識統計"
        }
      }
    }
  },
  {
    name: "get_knowledge_graph",
    description: "取得特定知識項目的關聯圖譜，顯示與其他知識的關係",
    inputSchema: {
      type: "object",
      properties: {
        knowledgeId: {
          type: "string",
          description: "中心知識項目的 UUID"
        },
        depth: {
          type: "number",
          default: 1,
          minimum: 1,
          maximum: 3,
          description: "關聯深度（1-3 層）"
        },
        relationTypes: {
          type: "array",
          items: { type: "string" },
          description: "過濾特定關係類型"
        }
      },
      required: ["knowledgeId"]
    }
  },
  {
    name: "record_knowledge_feedback",
    description: "記錄知識使用反饋，用於持續優化知識品質",
    inputSchema: {
      type: "object",
      properties: {
        knowledgeId: {
          type: "string",
          description: "被使用的知識項目 UUID"
        },
        sessionId: {
          type: "string",
          description: "對話 session ID"
        },
        feedbackType: {
          type: "string",
          enum: ["helpful", "not_helpful", "partially_helpful", "outdated", "incorrect"],
          description: "反饋類型"
        },
        context: {
          type: "string",
          description: "使用時的對話上下文"
        },
        followUpQuestions: {
          type: "array",
          items: { type: "string" },
          description: "用戶的後續問題（表示知識不完整）"
        },
        notes: {
          type: "string",
          description: "額外備註"
        }
      },
      required: ["knowledgeId", "feedbackType"]
    }
  }
];

export default tools;
