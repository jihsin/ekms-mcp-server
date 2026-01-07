/**
 * Knowledge Handlers
 * 處理所有知識相關的 MCP tool 調用
 */

import { createApiClient } from '../utils/api-client.js';

export class KnowledgeHandlers {
  constructor(config) {
    this.api = createApiClient(config);
    this.config = config;
  }

  /**
   * 搜尋知識庫
   */
  async searchKnowledge({ query, searchType = 'hybrid', knowledgeTypes, customerName, limit = 10, includeRelated = false }) {
    try {
      const response = await this.api.post('/api/v4/knowledge/search', {
        query,
        searchType,
        filters: {
          knowledge_type: knowledgeTypes,
          customer_name: customerName
        },
        limit,
        include_related: includeRelated
      });

      const results = response.data.results || [];

      if (results.length === 0) {
        return this.formatResponse(`找不到與「${query}」相關的知識。建議：\n1. 嘗試不同的關鍵字\n2. 使用更通用的搜尋詞\n3. 檢查是否有拼寫錯誤`);
      }

      return this.formatResponse(this.formatSearchResults(results, query));
    } catch (error) {
      return this.formatError('搜尋知識', error);
    }
  }

  /**
   * 推薦知識
   */
  async recommendKnowledge({ context, customerName, personalityScores, healthScore, limit = 5 }) {
    try {
      const endpoint = personalityScores || healthScore
        ? '/api/v4/knowledge/recommend/strategic'
        : '/api/v4/knowledge/recommend';

      const response = await this.api.post(endpoint, {
        context,
        customer_name: customerName,
        personality_scores: personalityScores,
        health_score: healthScore,
        limit
      });

      const recommendations = response.data.recommendations || response.data.results || [];

      if (recommendations.length === 0) {
        return this.formatResponse('目前沒有適合的知識推薦。');
      }

      return this.formatResponse(this.formatRecommendations(recommendations, context));
    } catch (error) {
      return this.formatError('推薦知識', error);
    }
  }

  /**
   * 取得特定知識項目
   */
  async getKnowledgeItem({ id, includeRelations = true }) {
    try {
      const response = await this.api.get(`/api/v4/knowledge/${id}`, {
        params: { include_relations: includeRelations }
      });

      // API 回傳格式：{ success, item }
      const item = response.data.item || response.data;

      if (!item || !item.id) {
        return this.formatResponse(`找不到 ID 為 ${id} 的知識項目。`);
      }

      return this.formatResponse(this.formatKnowledgeItem(item));
    } catch (error) {
      if (error.response?.status === 404) {
        return this.formatResponse(`找不到 ID 為 ${id} 的知識項目。請確認 ID 是否正確。`);
      }
      return this.formatError('取得知識項目', error);
    }
  }

  /**
   * 列出知識類型
   */
  async listKnowledgeTypes() {
    try {
      const response = await this.api.get('/api/v4/knowledge/types');
      const types = response.data.types || [];

      // 適配 API 回傳格式
      const formattedTypes = types.map(t => ({
        type: t.id || t.type,
        label: t.name_zh || t.label || t.name,
        description: t.description,
        count: t.count
      }));

      return this.formatResponse(this.formatKnowledgeTypes(formattedTypes));
    } catch (error) {
      // 如果 API 不可用，返回預設類型
      const defaultTypes = [
        { type: 'product_info', label: '產品資訊', description: '產品功能、規格、使用方式' },
        { type: 'faq', label: '常見問題', description: '經常被問到的問題和解答' },
        { type: 'policy', label: '政策規定', description: '公司政策、規章制度' },
        { type: 'announcement', label: '公告', description: '重要通知、更新資訊' },
        { type: 'tutorial', label: '教學', description: '操作指南、使用教學' },
        { type: 'troubleshooting', label: '故障排除', description: '問題診斷和解決方案' },
        { type: 'best_practice', label: '最佳實踐', description: '建議做法、經驗分享' },
        { type: 'case_study', label: '案例研究', description: '實際案例分析' },
        { type: 'glossary', label: '術語', description: '專業術語定義' },
        { type: 'other', label: '其他', description: '未分類知識' }
      ];

      return this.formatResponse(this.formatKnowledgeTypes(defaultTypes));
    }
  }

  /**
   * 列出客戶
   */
  async listCustomers({ includeStats = false }) {
    try {
      const response = await this.api.get('/api/v4/knowledge/customers', {
        params: { include_stats: includeStats }
      });

      // API 回傳格式：{ success, customers: [{ customer_name, count }] }
      const customers = response.data.customers || [];

      if (customers.length === 0) {
        return this.formatResponse('知識庫中目前沒有特定客戶的知識。');
      }

      return this.formatResponse(this.formatCustomers(customers, includeStats));
    } catch (error) {
      return this.formatError('列出客戶', error);
    }
  }

  /**
   * 取得知識圖譜
   */
  async getKnowledgeGraph({ knowledgeId, depth = 1, relationTypes }) {
    try {
      const response = await this.api.get(`/api/v4/knowledge/${knowledgeId}/graph`, {
        params: {
          depth,
          relation_types: relationTypes?.join(',')
        }
      });

      const graph = response.data;

      return this.formatResponse(this.formatKnowledgeGraph(graph));
    } catch (error) {
      return this.formatError('取得知識圖譜', error);
    }
  }

  /**
   * 記錄知識反饋
   */
  async recordKnowledgeFeedback({ knowledgeId, sessionId, feedbackType, context, followUpQuestions, notes }) {
    try {
      await this.api.post('/api/v4/knowledge/feedback', {
        knowledge_id: knowledgeId,
        session_id: sessionId,
        feedback_type: feedbackType,
        context,
        follow_up_questions: followUpQuestions,
        notes
      });

      return this.formatResponse(`已記錄對知識 ${knowledgeId} 的反饋：${feedbackType}`);
    } catch (error) {
      // 反饋記錄失敗不應該影響主流程
      console.error('Failed to record feedback:', error);
      return this.formatResponse('反饋已接收（記錄可能有延遲）');
    }
  }

  // ============ 格式化方法 ============

  formatSearchResults(results, query) {
    let output = `## 搜尋結果：「${query}」\n\n`;
    output += `找到 ${results.length} 筆相關知識\n\n`;

    results.forEach((item, index) => {
      output += `### ${index + 1}. ${item.title}\n`;
      output += `- **類型**：${item.type_name || item.type || '未分類'}\n`;
      // 計算相關度分數
      const score = item.relevance_score || item.combined_score || item.score || 0;
      output += `- **相關度**：${(score * 100).toFixed(1)}%\n`;
      if (item.customer_name) {
        output += `- **客戶**：${item.customer_name}\n`;
      }
      output += `- **ID**：\`${item.id}\`\n`;
      output += `\n${this.truncateContent(item.content, 300)}\n\n`;
      output += `---\n\n`;
    });

    output += `\n> 使用 \`get_knowledge_item\` 取得完整內容`;

    return output;
  }

  formatRecommendations(recommendations, context) {
    let output = `## 推薦知識\n\n`;
    output += `根據上下文：「${this.truncateContent(context, 100)}」\n\n`;

    recommendations.forEach((item, index) => {
      output += `### ${index + 1}. ${item.title}\n`;
      output += `- **推薦原因**：${item.reason || '語意相關'}\n`;
      output += `- **類型**：${item.knowledge_type_label || item.knowledge_type}\n`;
      output += `- **ID**：\`${item.id}\`\n`;
      output += `\n${this.truncateContent(item.content, 200)}\n\n`;
    });

    return output;
  }

  formatKnowledgeItem(item) {
    let output = `## ${item.title}\n\n`;
    output += `| 屬性 | 值 |\n`;
    output += `|------|----|\n`;
    output += `| ID | \`${item.id}\` |\n`;
    output += `| 類型 | ${item.type_name || item.type || '未分類'} |\n`;
    if (item.category) {
      output += `| 分類 | ${item.category} |\n`;
    }
    if (item.customer_name) {
      output += `| 客戶 | ${item.customer_name} |\n`;
    }
    if (item.status) {
      output += `| 狀態 | ${item.status} |\n`;
    }
    output += `| 建立時間 | ${new Date(item.created_at).toLocaleString('zh-TW')} |\n`;
    output += `| 更新時間 | ${new Date(item.updated_at).toLocaleString('zh-TW')} |\n`;

    if (item.summary) {
      output += `\n### 摘要\n\n${item.summary}\n`;
    }

    output += `\n### 內容\n\n${item.content}\n`;

    if (item.tags?.length > 0) {
      output += `\n### 標籤\n${item.tags.map(t => `\`${t}\``).join(' ')}\n`;
    }

    if (item.relations?.length > 0) {
      output += `\n### 相關知識\n`;
      item.relations.forEach(rel => {
        output += `- [${rel.relation_type}] ${rel.title} (\`${rel.id}\`)\n`;
      });
    }

    return output;
  }

  formatKnowledgeTypes(types) {
    let output = `## 知識類型\n\n`;
    output += `| 類型代碼 | 名稱 | 說明 | 數量 |\n`;
    output += `|----------|------|------|------|\n`;

    types.forEach(t => {
      output += `| ${t.type} | ${t.label} | ${t.description || '-'} | ${t.count || '-'} |\n`;
    });

    return output;
  }

  formatCustomers(customers, includeStats) {
    let output = `## 客戶列表\n\n`;

    output += `| 客戶名稱 | 知識數量 |\n`;
    output += `|----------|----------|\n`;
    customers.forEach(c => {
      const name = c.customer_name || c.name || c;
      const count = c.count || '-';
      output += `| ${name} | ${count} |\n`;
    });

    return output;
  }

  formatKnowledgeGraph(graph) {
    if (!graph || !graph.nodes || graph.nodes.length === 0) {
      return '此知識項目目前沒有建立關聯。';
    }

    let output = `## 知識圖譜\n\n`;
    output += `### 中心節點\n`;
    output += `**${graph.center.title}** (\`${graph.center.id}\`)\n\n`;

    if (graph.edges?.length > 0) {
      output += `### 關聯關係\n\n`;

      const grouped = {};
      graph.edges.forEach(edge => {
        if (!grouped[edge.relation_type]) {
          grouped[edge.relation_type] = [];
        }
        grouped[edge.relation_type].push(edge);
      });

      Object.entries(grouped).forEach(([relType, edges]) => {
        output += `#### ${this.getRelationLabel(relType)}\n`;
        edges.forEach(edge => {
          const target = graph.nodes.find(n => n.id === edge.target_id);
          if (target) {
            output += `- ${target.title} (\`${target.id}\`)\n`;
          }
        });
        output += '\n';
      });
    }

    return output;
  }

  getRelationLabel(relType) {
    const labels = {
      'requires': '前置知識',
      'extends': '延伸閱讀',
      'contradicts': '衝突知識（需注意）',
      'supersedes': '已取代',
      'example_of': '實例',
      'part_of': '屬於',
      'related': '相關'
    };
    return labels[relType] || relType;
  }

  truncateContent(content, maxLength) {
    if (!content) return '';
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  }

  formatResponse(text) {
    return {
      content: [{
        type: "text",
        text
      }]
    };
  }

  formatError(operation, error) {
    const message = error.response?.data?.message || error.message || '未知錯誤';
    return {
      content: [{
        type: "text",
        text: `**錯誤**：${operation}失敗\n\n原因：${message}\n\n請確認 EKMS API 服務是否正常運作。`
      }],
      isError: true
    };
  }
}

export default KnowledgeHandlers;
