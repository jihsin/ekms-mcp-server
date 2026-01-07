/**
 * Knowledge Relation Discovery Service
 * 使用 Gemini AI 自動發現知識之間的關聯
 */

import { createApiClient } from '../utils/api-client.js';

export class RelationDiscoveryService {
  constructor(config) {
    this.api = createApiClient(config);
    this.config = config;
    this.geminiApiKey = config.geminiApiKey || process.env.GEMINI_API_KEY;
    this.geminiModel = config.geminiModel || 'gemini-1.5-flash';
  }

  /**
   * 為新知識發現關聯
   */
  async discoverRelationsForKnowledge(knowledgeId) {
    try {
      // 1. 取得目標知識
      const targetKnowledge = await this.getKnowledge(knowledgeId);
      if (!targetKnowledge) {
        throw new Error(`Knowledge not found: ${knowledgeId}`);
      }

      // 2. 找出潛在相關的知識（使用語意搜尋）
      const candidates = await this.findCandidates(targetKnowledge);

      // 3. 使用 Gemini 分析關係
      const discoveredRelations = [];

      for (const candidate of candidates) {
        if (candidate.id === knowledgeId) continue;

        const relation = await this.analyzeRelation(targetKnowledge, candidate);
        if (relation && relation.confidence >= 0.5) {
          discoveredRelations.push(relation);
        }
      }

      // 4. 儲存候選關係
      const savedRelations = await this.saveRelationCandidates(
        knowledgeId,
        discoveredRelations
      );

      return {
        knowledgeId,
        candidatesAnalyzed: candidates.length,
        relationsFound: discoveredRelations.length,
        relationsSaved: savedRelations.length
      };
    } catch (error) {
      console.error('[RelationDiscovery] Error:', error);
      throw error;
    }
  }

  /**
   * 取得知識項目
   */
  async getKnowledge(id) {
    try {
      const response = await this.api.get(`/api/v4/knowledge/${id}`);
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) return null;
      throw error;
    }
  }

  /**
   * 找出潛在相關的知識候選
   */
  async findCandidates(targetKnowledge, limit = 20) {
    // 使用語意搜尋找相關知識
    const response = await this.api.post('/api/v4/knowledge/search', {
      query: `${targetKnowledge.title} ${targetKnowledge.content.substring(0, 500)}`,
      searchType: 'semantic',
      limit,
      filters: {
        // 排除自己
        exclude_ids: [targetKnowledge.id]
      }
    });

    return response.data.results || [];
  }

  /**
   * 使用 Gemini 分析兩個知識之間的關係
   */
  async analyzeRelation(sourceKnowledge, targetKnowledge) {
    const prompt = this.buildAnalysisPrompt(sourceKnowledge, targetKnowledge);

    try {
      const response = await this.callGemini(prompt);
      return this.parseGeminiResponse(response, sourceKnowledge.id, targetKnowledge.id);
    } catch (error) {
      console.error('[RelationDiscovery] Gemini analysis failed:', error);
      return null;
    }
  }

  /**
   * 建立 Gemini 分析 Prompt
   */
  buildAnalysisPrompt(source, target) {
    return `你是一個知識圖譜分析專家。請分析以下兩個知識項目之間的關係。

## 知識 A
標題：${source.title}
類型：${source.knowledge_type}
內容：
${source.content.substring(0, 1000)}${source.content.length > 1000 ? '...(截斷)' : ''}

## 知識 B
標題：${target.title}
類型：${target.knowledge_type}
內容：
${target.content.substring(0, 1000)}${target.content.length > 1000 ? '...(截斷)' : ''}

## 可能的關係類型
- requires: A 需要先理解 B（B 是 A 的前置知識）
- extends: A 是 B 的延伸或進階說明
- contradicts: A 與 B 有矛盾或衝突
- supersedes: A 取代了 B（B 已過時）
- example_of: A 是 B 的具體實例
- part_of: A 是 B 的一部分
- related: A 與 B 相關但無特定關係
- answers: A 回答了 B 提出的問題
- none: 沒有明顯關係

## 請回答
請以 JSON 格式回答，包含：
1. relation_type: 最合適的關係類型（從上述選項中選擇）
2. confidence: 信心度（0-1 之間的數字）
3. reasoning: 簡短說明為什麼是這個關係（50字以內）
4. bidirectional: 這個關係是否雙向（boolean）

只輸出 JSON，不要其他文字：
{"relation_type": "...", "confidence": 0.X, "reasoning": "...", "bidirectional": true/false}`;
  }

  /**
   * 呼叫 Gemini API
   */
  async callGemini(prompt) {
    if (!this.geminiApiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent?key=${this.geminiApiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.1,  // 低溫度以獲得一致結果
          maxOutputTokens: 200
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${error}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  /**
   * 解析 Gemini 回應
   */
  parseGeminiResponse(response, sourceId, targetId) {
    try {
      // 嘗試提取 JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('[RelationDiscovery] Could not extract JSON from response');
        return null;
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // 驗證必要欄位
      if (!parsed.relation_type || parsed.confidence === undefined) {
        console.warn('[RelationDiscovery] Missing required fields in response');
        return null;
      }

      // 如果是 "none"，返回 null
      if (parsed.relation_type === 'none') {
        return null;
      }

      return {
        source_id: sourceId,
        target_id: targetId,
        relation_type: parsed.relation_type,
        confidence: Math.min(1, Math.max(0, parsed.confidence)),
        reasoning: parsed.reasoning || '',
        bidirectional: parsed.bidirectional || false
      };
    } catch (error) {
      console.error('[RelationDiscovery] Failed to parse response:', error, response);
      return null;
    }
  }

  /**
   * 儲存候選關係
   */
  async saveRelationCandidates(sourceKnowledgeId, relations) {
    const saved = [];

    for (const relation of relations) {
      try {
        // 高信心度自動批准
        if (relation.confidence >= 0.9) {
          await this.api.post('/api/v4/knowledge/relations', {
            source_id: relation.source_id,
            target_id: relation.target_id,
            relation_type: relation.relation_type,
            confidence: relation.confidence,
            created_by: 'ai_inferred',
            reasoning: relation.reasoning
          });
        } else {
          // 低信心度存為候選
          await this.api.post('/api/v4/knowledge/relation-candidates', {
            source_id: relation.source_id,
            target_id: relation.target_id,
            relation_type: relation.relation_type,
            confidence: relation.confidence,
            reasoning: relation.reasoning,
            status: 'pending'
          });
        }

        saved.push(relation);
      } catch (error) {
        // 忽略重複的關係錯誤
        if (!error.message?.includes('duplicate') && !error.message?.includes('unique')) {
          console.error('[RelationDiscovery] Failed to save relation:', error);
        }
      }
    }

    return saved;
  }

  /**
   * 批次處理待發現的知識
   */
  async processPendingDiscoveryTasks(limit = 10) {
    const response = await this.api.get('/api/v4/knowledge/relation-discovery-tasks', {
      params: {
        status: 'pending',
        limit
      }
    });

    const tasks = response.data.tasks || [];
    const results = [];

    for (const task of tasks) {
      try {
        // 更新任務狀態
        await this.api.put(`/api/v4/knowledge/relation-discovery-tasks/${task.id}`, {
          status: 'processing',
          started_at: new Date().toISOString()
        });

        const startTime = Date.now();
        const result = await this.discoverRelationsForKnowledge(task.knowledge_id);

        // 完成任務
        await this.api.put(`/api/v4/knowledge/relation-discovery-tasks/${task.id}`, {
          status: 'completed',
          completed_at: new Date().toISOString(),
          relations_found: result.relationsFound,
          relations_created: result.relationsSaved,
          processing_time_ms: Date.now() - startTime
        });

        results.push({ task_id: task.id, ...result });
      } catch (error) {
        await this.api.put(`/api/v4/knowledge/relation-discovery-tasks/${task.id}`, {
          status: 'failed',
          error_message: error.message
        });

        results.push({ task_id: task.id, error: error.message });
      }
    }

    return results;
  }
}

export default RelationDiscoveryService;
