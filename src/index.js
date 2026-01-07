#!/usr/bin/env node

/**
 * EKMS MCP Server
 * Enterprise Knowledge Management System - Model Context Protocol Server
 *
 * 讓 Claude 能夠直接查詢和操作企業知識庫
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { tools } from './tools/definitions.js';
import { KnowledgeHandlers } from './handlers/knowledge-handlers.js';

// 載入環境變數
import 'dotenv/config';

// 配置
const config = {
  apiUrl: process.env.EKMS_API_URL || 'http://localhost:3000',
  apiKey: process.env.EKMS_API_KEY,
  debug: process.env.DEBUG === 'true'
};

// 初始化 handlers
const knowledgeHandlers = new KnowledgeHandlers(config);

// 建立 MCP Server
const server = new Server(
  {
    name: "ekms-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 處理列出工具請求
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// 處理工具調用請求
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (config.debug) {
    console.error(`[EKMS-MCP] Tool called: ${name}`, JSON.stringify(args, null, 2));
  }

  try {
    switch (name) {
      case "search_knowledge":
        return await knowledgeHandlers.searchKnowledge(args);

      case "recommend_knowledge":
        return await knowledgeHandlers.recommendKnowledge(args);

      case "get_knowledge_item":
        return await knowledgeHandlers.getKnowledgeItem(args);

      case "list_knowledge_types":
        return await knowledgeHandlers.listKnowledgeTypes();

      case "list_customers":
        return await knowledgeHandlers.listCustomers(args);

      case "get_knowledge_graph":
        return await knowledgeHandlers.getKnowledgeGraph(args);

      case "record_knowledge_feedback":
        return await knowledgeHandlers.recordKnowledgeFeedback(args);

      default:
        return {
          content: [{
            type: "text",
            text: `未知的工具：${name}`
          }],
          isError: true
        };
    }
  } catch (error) {
    console.error(`[EKMS-MCP] Error in ${name}:`, error);
    return {
      content: [{
        type: "text",
        text: `執行 ${name} 時發生錯誤：${error.message}`
      }],
      isError: true
    };
  }
});

// 啟動伺服器
async function main() {
  const transport = new StdioServerTransport();

  console.error("[EKMS-MCP] Starting server...");
  console.error(`[EKMS-MCP] API URL: ${config.apiUrl}`);
  console.error(`[EKMS-MCP] Debug mode: ${config.debug}`);

  await server.connect(transport);

  console.error("[EKMS-MCP] Server connected and ready");
}

main().catch((error) => {
  console.error("[EKMS-MCP] Fatal error:", error);
  process.exit(1);
});
