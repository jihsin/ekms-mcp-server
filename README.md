# EKMS MCP Server

Enterprise Knowledge Management System 的 Model Context Protocol (MCP) 伺服器。

讓 Claude Code 能夠直接查詢和操作企業知識庫。

## 功能

- `search_knowledge` - 搜尋知識庫（支援混合/語意/關鍵字搜尋）
- `recommend_knowledge` - 根據上下文和客戶特徵推薦知識
- `get_knowledge_item` - 取得特定知識項目完整內容
- `list_knowledge_types` - 列出所有知識類型
- `list_customers` - 列出所有客戶
- `get_knowledge_graph` - 取得知識關聯圖譜
- `record_knowledge_feedback` - 記錄知識使用反饋

## 安裝

```bash
cd ekms-mcp-server
npm install
```

## 配置

複製環境變數範本：

```bash
cp .env.example .env
```

編輯 `.env` 設定 EKMS API 位址：

```env
EKMS_API_URL=http://your-ekms-api-server:3000
EKMS_API_KEY=your-api-key
```

## 使用方式

### 方式一：本地開發

1. 啟動伺服器測試：
```bash
npm start
```

2. 在 Claude Code 配置中加入：
```json
{
  "mcpServers": {
    "ekms": {
      "command": "node",
      "args": ["/path/to/ekms-mcp-server/src/index.js"],
      "env": {
        "EKMS_API_URL": "http://localhost:3000"
      }
    }
  }
}
```

### 方式二：使用 Claude CLI

```bash
claude mcp add ekms node /path/to/ekms-mcp-server/src/index.js
```

## 開發

```bash
# 開發模式（自動重載）
npm run dev

# 執行測試
npm test
```

## 架構

```
ekms-mcp-server/
├── src/
│   ├── index.js              # MCP 伺服器入口
│   ├── tools/
│   │   └── definitions.js    # 工具定義
│   ├── handlers/
│   │   └── knowledge-handlers.js  # 工具處理邏輯
│   └── utils/
│       └── api-client.js     # EKMS API 客戶端
├── config/
├── migrations/               # 資料庫遷移腳本
└── package.json
```

## License

MIT
