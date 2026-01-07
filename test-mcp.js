#!/usr/bin/env node

/**
 * EKMS MCP Server 測試腳本
 */

import 'dotenv/config';
import { KnowledgeHandlers } from './src/handlers/knowledge-handlers.js';

const config = {
  apiUrl: process.env.EKMS_API_URL || 'http://localhost:3004',
  apiKey: process.env.EKMS_API_KEY,
  debug: true
};

const handlers = new KnowledgeHandlers(config);

async function runTests() {
  console.log('🧪 EKMS MCP Server 測試\n');
  console.log(`API URL: ${config.apiUrl}\n`);
  console.log('─'.repeat(50));

  // Test 1: 列出知識類型
  console.log('\n📋 測試 1: list_knowledge_types');
  try {
    const result = await handlers.listKnowledgeTypes();
    console.log('✅ 成功');
    console.log(result.content[0].text.substring(0, 500) + '...\n');
  } catch (error) {
    console.log('❌ 失敗:', error.message);
  }

  // Test 2: 搜尋知識
  console.log('─'.repeat(50));
  console.log('\n🔍 測試 2: search_knowledge');
  try {
    const result = await handlers.searchKnowledge({
      query: '產品優勢',
      searchType: 'hybrid',
      limit: 3
    });
    console.log('✅ 成功');
    console.log(result.content[0].text.substring(0, 800) + '...\n');
  } catch (error) {
    console.log('❌ 失敗:', error.message);
  }

  // Test 3: 列出客戶
  console.log('─'.repeat(50));
  console.log('\n👥 測試 3: list_customers');
  try {
    const result = await handlers.listCustomers({ includeStats: false });
    console.log('✅ 成功');
    console.log(result.content[0].text.substring(0, 500) + '...\n');
  } catch (error) {
    console.log('❌ 失敗:', error.message);
  }

  // Test 4: 取得特定知識項目
  console.log('─'.repeat(50));
  console.log('\n📄 測試 4: get_knowledge_item (id=1)');
  try {
    const result = await handlers.getKnowledgeItem({ id: '1', includeRelations: false });
    console.log('✅ 成功');
    console.log(result.content[0].text.substring(0, 600) + '...\n');
  } catch (error) {
    console.log('❌ 失敗:', error.message);
  }

  // Test 5: 推薦知識
  console.log('─'.repeat(50));
  console.log('\n💡 測試 5: recommend_knowledge');
  try {
    const result = await handlers.recommendKnowledge({
      context: '客戶詢問產品價格和優惠方案',
      limit: 3
    });
    console.log('✅ 成功');
    console.log(result.content[0].text.substring(0, 600) + '...\n');
  } catch (error) {
    console.log('❌ 失敗:', error.message);
  }

  console.log('─'.repeat(50));
  console.log('\n🎉 測試完成！\n');
}

runTests().catch(console.error);
