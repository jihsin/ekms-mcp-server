-- ============================================================
-- EKMS 知識反饋系統 - 資料庫遷移腳本
-- Migration: 001_knowledge_feedback
-- 建立知識使用反饋追蹤表結構
-- 注意：適配現有 knowledge_items 表（id 為 INTEGER）
-- ============================================================

-- 1. 知識使用記錄表
-- 記錄每次知識被檢索和使用的情況
CREATE TABLE IF NOT EXISTS knowledge_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 關聯（使用 INTEGER 對應現有表結構）
    knowledge_id INTEGER NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
    session_id VARCHAR(255),                    -- 對話 session ID
    customer_name VARCHAR(255),                 -- 使用時的客戶名稱

    -- 使用情境
    query_text TEXT,                            -- 原始查詢文字
    search_type VARCHAR(50),                    -- 搜尋類型: hybrid/semantic/keyword
    result_rank INTEGER,                        -- 在搜尋結果中的排名
    similarity_score FLOAT,                     -- 相似度分數

    -- 使用來源
    source VARCHAR(50) DEFAULT 'mcp',           -- mcp/api/dashboard/chat
    user_agent TEXT,                            -- 調用者資訊

    -- 時間
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_usage_logs_knowledge_id ON knowledge_usage_logs(knowledge_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_session_id ON knowledge_usage_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON knowledge_usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_usage_logs_customer ON knowledge_usage_logs(customer_name);


-- 2. 知識反饋表
-- 記錄知識使用後的效果反饋
CREATE TABLE IF NOT EXISTS knowledge_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 關聯
    knowledge_id INTEGER NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
    usage_log_id UUID REFERENCES knowledge_usage_logs(id) ON DELETE SET NULL,
    session_id VARCHAR(255),

    -- 反饋類型
    feedback_type VARCHAR(50) NOT NULL,
    -- helpful: 有幫助
    -- not_helpful: 沒幫助
    -- partially_helpful: 部分有幫助
    -- outdated: 資訊過時
    -- incorrect: 資訊錯誤
    -- incomplete: 資訊不完整

    -- 反饋來源
    feedback_source VARCHAR(50) DEFAULT 'implicit',
    -- explicit: 用戶明確給的反饋
    -- implicit: 從對話行為推斷的反饋
    -- agent: AI agent 的判斷

    -- 詳細資訊
    context TEXT,                               -- 使用時的對話上下文
    follow_up_questions JSONB,                  -- 用戶的後續問題（表示知識不完整）
    notes TEXT,                                 -- 額外備註

    -- 信心度（用於 implicit 反饋）
    confidence FLOAT DEFAULT 1.0,

    -- 時間
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_feedback_knowledge_id ON knowledge_feedback(knowledge_id);
CREATE INDEX IF NOT EXISTS idx_feedback_type ON knowledge_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON knowledge_feedback(created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_session ON knowledge_feedback(session_id);


-- 3. 知識效能統計表（聚合）
-- 定期聚合的知識效能指標
CREATE TABLE IF NOT EXISTS knowledge_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    knowledge_id INTEGER NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,

    -- 時間範圍
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    period_type VARCHAR(20) NOT NULL,           -- daily/weekly/monthly

    -- 使用指標
    total_views INTEGER DEFAULT 0,              -- 總查看次數
    unique_sessions INTEGER DEFAULT 0,          -- 獨立 session 數
    avg_result_rank FLOAT,                      -- 平均搜尋排名
    avg_similarity_score FLOAT,                 -- 平均相似度分數

    -- 反饋指標
    helpful_count INTEGER DEFAULT 0,
    not_helpful_count INTEGER DEFAULT 0,
    partially_helpful_count INTEGER DEFAULT 0,
    outdated_count INTEGER DEFAULT 0,
    incorrect_count INTEGER DEFAULT 0,
    incomplete_count INTEGER DEFAULT 0,

    -- 計算指標
    helpfulness_rate FLOAT,                     -- 有幫助率
    effectiveness_score FLOAT,                  -- 綜合效能分數

    -- 時間
    calculated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(knowledge_id, period_start, period_type)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_metrics_knowledge_id ON knowledge_metrics(knowledge_id);
CREATE INDEX IF NOT EXISTS idx_metrics_period ON knowledge_metrics(period_start, period_type);


-- 4. 知識健康度表
-- 追蹤每個知識項目的整體健康狀態
CREATE TABLE IF NOT EXISTS knowledge_health (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    knowledge_id INTEGER NOT NULL UNIQUE REFERENCES knowledge_items(id) ON DELETE CASCADE,

    -- 健康度分數（0-1）
    overall_score FLOAT DEFAULT 1.0,

    -- 各維度分數
    recency_score FLOAT DEFAULT 1.0,            -- 時效性
    usage_score FLOAT DEFAULT 0.5,              -- 使用率
    effectiveness_score FLOAT DEFAULT 0.5,      -- 效果
    consistency_score FLOAT DEFAULT 1.0,        -- 與其他知識的一致性
    completeness_score FLOAT DEFAULT 1.0,       -- 完整度

    -- 狀態標記
    needs_review BOOLEAN DEFAULT FALSE,         -- 需要人工審核
    review_reason TEXT,                         -- 審核原因

    -- 自動建議
    suggested_actions JSONB,                    -- AI 建議的改進動作

    -- 時間
    last_calculated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_health_needs_review ON knowledge_health(needs_review) WHERE needs_review = TRUE;
CREATE INDEX IF NOT EXISTS idx_health_overall_score ON knowledge_health(overall_score);


-- 5. 知識改進建議表
-- 記錄 AI 或人工提出的知識改進建議
CREATE TABLE IF NOT EXISTS knowledge_improvement_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    knowledge_id INTEGER NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,

    -- 建議類型
    suggestion_type VARCHAR(50) NOT NULL,
    -- update_content: 更新內容
    -- add_information: 補充資訊
    -- fix_error: 修正錯誤
    -- merge: 與其他知識合併
    -- split: 拆分為多個知識
    -- deprecate: 標記為過時
    -- link_related: 建立關聯

    -- 建議內容
    title VARCHAR(500) NOT NULL,
    description TEXT,
    suggested_changes JSONB,                    -- 具體的修改建議

    -- 來源
    source VARCHAR(50) DEFAULT 'ai',            -- ai/human/system
    source_details JSONB,                       -- 來源詳細資訊（如哪個反饋觸發）

    -- 狀態
    status VARCHAR(50) DEFAULT 'pending',       -- pending/approved/rejected/implemented
    priority VARCHAR(20) DEFAULT 'medium',      -- low/medium/high/critical

    -- 審核
    reviewed_by VARCHAR(255),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,

    -- 時間
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_suggestions_knowledge_id ON knowledge_improvement_suggestions(knowledge_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_status ON knowledge_improvement_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_suggestions_priority ON knowledge_improvement_suggestions(priority);


-- ============================================================
-- 觸發器：自動更新時間戳
-- ============================================================

CREATE OR REPLACE FUNCTION update_knowledge_health_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_knowledge_health_updated ON knowledge_health;
CREATE TRIGGER trigger_knowledge_health_updated
    BEFORE UPDATE ON knowledge_health
    FOR EACH ROW
    EXECUTE FUNCTION update_knowledge_health_timestamp();


-- ============================================================
-- 輔助函數：計算知識健康度
-- ============================================================

CREATE OR REPLACE FUNCTION calculate_knowledge_health(p_knowledge_id INTEGER)
RETURNS FLOAT AS $$
DECLARE
    v_recency FLOAT;
    v_usage FLOAT;
    v_effectiveness FLOAT;
    v_item RECORD;
    v_usage_count INTEGER;
    v_helpful_rate FLOAT;
    v_days_since_update INTEGER;
BEGIN
    -- 取得知識項目
    SELECT * INTO v_item FROM knowledge_items WHERE id = p_knowledge_id;
    IF NOT FOUND THEN
        RETURN 0;
    END IF;

    -- 計算時效性分數（基於最後更新時間）
    v_days_since_update := EXTRACT(DAY FROM NOW() - v_item.updated_at);
    v_recency := GREATEST(0, 1 - (v_days_since_update::FLOAT / 365));

    -- 計算使用率分數（過去30天）
    SELECT COUNT(*) INTO v_usage_count
    FROM knowledge_usage_logs
    WHERE knowledge_id = p_knowledge_id
      AND created_at > NOW() - INTERVAL '30 days';
    v_usage := LEAST(1, v_usage_count::FLOAT / 10);  -- 10次使用 = 滿分

    -- 計算效果分數
    SELECT
        CASE WHEN COUNT(*) > 0
             THEN SUM(CASE WHEN feedback_type IN ('helpful', 'partially_helpful') THEN 1 ELSE 0 END)::FLOAT / COUNT(*)
             ELSE 0.5  -- 沒有反饋時給中等分數
        END
    INTO v_helpful_rate
    FROM knowledge_feedback
    WHERE knowledge_id = p_knowledge_id
      AND created_at > NOW() - INTERVAL '90 days';
    v_effectiveness := v_helpful_rate;

    -- 更新或插入健康度記錄
    INSERT INTO knowledge_health (
        knowledge_id,
        overall_score,
        recency_score,
        usage_score,
        effectiveness_score,
        last_calculated
    ) VALUES (
        p_knowledge_id,
        (v_recency * 0.3 + v_usage * 0.3 + v_effectiveness * 0.4),
        v_recency,
        v_usage,
        v_effectiveness,
        NOW()
    )
    ON CONFLICT (knowledge_id) DO UPDATE SET
        overall_score = (EXCLUDED.recency_score * 0.3 + EXCLUDED.usage_score * 0.3 + EXCLUDED.effectiveness_score * 0.4),
        recency_score = EXCLUDED.recency_score,
        usage_score = EXCLUDED.usage_score,
        effectiveness_score = EXCLUDED.effectiveness_score,
        last_calculated = NOW(),
        updated_at = NOW();

    RETURN (v_recency * 0.3 + v_usage * 0.3 + v_effectiveness * 0.4);
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- 檢視：知識健康度儀表板
-- ============================================================

CREATE OR REPLACE VIEW v_knowledge_health_dashboard AS
SELECT
    ki.id,
    ki.title,
    ki.type AS knowledge_type,
    ki.customer_name,
    ki.created_at,
    ki.updated_at,
    kh.overall_score,
    kh.recency_score,
    kh.usage_score,
    kh.effectiveness_score,
    kh.needs_review,
    kh.review_reason,
    kh.last_calculated,
    (SELECT COUNT(*) FROM knowledge_usage_logs WHERE knowledge_id = ki.id AND created_at > NOW() - INTERVAL '30 days') AS recent_usage,
    (SELECT COUNT(*) FROM knowledge_feedback WHERE knowledge_id = ki.id AND created_at > NOW() - INTERVAL '30 days') AS recent_feedback,
    (SELECT COUNT(*) FROM knowledge_improvement_suggestions WHERE knowledge_id = ki.id AND status = 'pending') AS pending_suggestions
FROM knowledge_items ki
LEFT JOIN knowledge_health kh ON ki.id = kh.knowledge_id
ORDER BY kh.overall_score ASC NULLS FIRST;


-- ============================================================
-- 說明
-- ============================================================
COMMENT ON TABLE knowledge_usage_logs IS '知識使用記錄 - 追蹤每次知識被檢索和使用的情況';
COMMENT ON TABLE knowledge_feedback IS '知識反饋 - 記錄知識使用後的效果反饋';
COMMENT ON TABLE knowledge_metrics IS '知識效能統計 - 定期聚合的知識效能指標';
COMMENT ON TABLE knowledge_health IS '知識健康度 - 追蹤每個知識項目的整體健康狀態';
COMMENT ON TABLE knowledge_improvement_suggestions IS '知識改進建議 - 記錄 AI 或人工提出的知識改進建議';
