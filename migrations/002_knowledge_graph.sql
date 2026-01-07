-- ============================================================
-- EKMS 知識圖譜系統 - 資料庫遷移腳本
-- Migration: 002_knowledge_graph
-- 建立知識關聯圖譜表結構
-- 注意：適配現有 knowledge_items 表（id 為 INTEGER）
-- ============================================================

-- 1. 知識關聯表
-- 定義知識項目之間的關係
CREATE TABLE IF NOT EXISTS knowledge_relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 關係的兩端（使用 INTEGER 對應現有表結構）
    source_id INTEGER NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
    target_id INTEGER NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,

    -- 關係類型
    relation_type VARCHAR(50) NOT NULL,
    -- requires: 前置知識（理解 A 需要先了解 B）
    -- extends: 延伸知識（A 是 B 的進階說明）
    -- contradicts: 衝突（A 與 B 有矛盾，需要解決）
    -- supersedes: 取代（A 取代了 B，B 已過時）
    -- example_of: 實例（A 是 B 的具體案例）
    -- part_of: 組成（A 是 B 的一部分）
    -- related: 相關（一般性相關）
    -- see_also: 參考（延伸閱讀）
    -- answers: 回答（A 回答了 B 提出的問題）

    -- 關係屬性
    weight FLOAT DEFAULT 1.0,                   -- 關係強度（0-1）
    confidence FLOAT DEFAULT 1.0,               -- AI 判斷的信心度（0-1）
    bidirectional BOOLEAN DEFAULT FALSE,        -- 是否雙向關係

    -- 來源追蹤
    created_by VARCHAR(50) NOT NULL DEFAULT 'human',
    -- human: 人工建立
    -- ai_inferred: AI 自動推斷
    -- ai_verified: AI 推斷後人工確認
    -- system: 系統自動（如同一客戶的知識）

    reasoning TEXT,                             -- AI 推斷的原因說明
    verified_by VARCHAR(255),                   -- 人工確認者
    verified_at TIMESTAMPTZ,                    -- 確認時間

    -- 時效性
    valid_from TIMESTAMPTZ DEFAULT NOW(),
    valid_until TIMESTAMPTZ,                    -- 關係可能有時效性

    -- 元資料
    metadata JSONB,                             -- 額外資訊

    -- 時間戳
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- 防止重複關係
    UNIQUE(source_id, target_id, relation_type)
);

-- 檢查不能自我關聯
ALTER TABLE knowledge_relations
    DROP CONSTRAINT IF EXISTS check_no_self_relation;
ALTER TABLE knowledge_relations
    ADD CONSTRAINT check_no_self_relation
    CHECK (source_id != target_id);

-- 索引
CREATE INDEX IF NOT EXISTS idx_relations_source ON knowledge_relations(source_id);
CREATE INDEX IF NOT EXISTS idx_relations_target ON knowledge_relations(target_id);
CREATE INDEX IF NOT EXISTS idx_relations_type ON knowledge_relations(relation_type);
CREATE INDEX IF NOT EXISTS idx_relations_confidence ON knowledge_relations(confidence);
CREATE INDEX IF NOT EXISTS idx_relations_created_by ON knowledge_relations(created_by);
CREATE INDEX IF NOT EXISTS idx_relations_valid ON knowledge_relations(valid_from, valid_until);


-- 2. 關係類型定義表
-- 定義和描述所有可用的關係類型
CREATE TABLE IF NOT EXISTS knowledge_relation_types (
    type_code VARCHAR(50) PRIMARY KEY,
    label VARCHAR(100) NOT NULL,
    description TEXT,
    inverse_type VARCHAR(50),                   -- 反向關係類型
    is_bidirectional BOOLEAN DEFAULT FALSE,
    priority INTEGER DEFAULT 100,               -- 顯示優先級
    color VARCHAR(20),                          -- UI 顯示顏色
    icon VARCHAR(50),                           -- UI 顯示圖標
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 預設關係類型
INSERT INTO knowledge_relation_types (type_code, label, description, inverse_type, is_bidirectional, priority, color) VALUES
    ('requires', '前置知識', '理解此知識需要先了解目標知識', 'required_by', FALSE, 10, '#FF6B6B'),
    ('required_by', '被需要', '此知識是理解目標知識的前置條件', 'requires', FALSE, 11, '#FF6B6B'),
    ('extends', '延伸知識', '此知識是目標知識的進階說明', 'extended_by', FALSE, 20, '#4ECDC4'),
    ('extended_by', '被延伸', '目標知識延伸說明了此知識', 'extends', FALSE, 21, '#4ECDC4'),
    ('contradicts', '衝突', '此知識與目標知識有矛盾（需要解決）', 'contradicts', TRUE, 5, '#E74C3C'),
    ('supersedes', '取代', '此知識取代了目標知識', 'superseded_by', FALSE, 15, '#F39C12'),
    ('superseded_by', '被取代', '此知識已被目標知識取代', 'supersedes', FALSE, 16, '#F39C12'),
    ('example_of', '是...的實例', '此知識是目標知識的具體案例', 'has_example', FALSE, 30, '#9B59B6'),
    ('has_example', '有實例', '目標知識是此知識的具體案例', 'example_of', FALSE, 31, '#9B59B6'),
    ('part_of', '屬於', '此知識是目標知識的一部分', 'has_part', FALSE, 40, '#3498DB'),
    ('has_part', '包含', '目標知識是此知識的一部分', 'part_of', FALSE, 41, '#3498DB'),
    ('related', '相關', '與目標知識相關', 'related', TRUE, 50, '#95A5A6'),
    ('see_also', '參考', '延伸閱讀', 'see_also', TRUE, 60, '#1ABC9C'),
    ('answers', '回答', '此知識回答了目標知識提出的問題', 'answered_by', FALSE, 25, '#2ECC71'),
    ('answered_by', '被回答', '目標知識回答了此知識', 'answers', FALSE, 26, '#2ECC71')
ON CONFLICT (type_code) DO NOTHING;


-- 3. AI 關係推斷任務表
-- 追蹤 AI 自動發現關係的任務
CREATE TABLE IF NOT EXISTS knowledge_relation_discovery_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 任務資訊
    knowledge_id INTEGER NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
    task_type VARCHAR(50) NOT NULL,             -- new_item/periodic/manual
    status VARCHAR(50) DEFAULT 'pending',       -- pending/processing/completed/failed

    -- 執行結果
    relations_found INTEGER DEFAULT 0,
    relations_created INTEGER DEFAULT 0,
    processing_time_ms INTEGER,
    error_message TEXT,

    -- 時間
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discovery_status ON knowledge_relation_discovery_tasks(status);
CREATE INDEX IF NOT EXISTS idx_discovery_knowledge ON knowledge_relation_discovery_tasks(knowledge_id);


-- 4. 關係推斷候選表
-- 儲存 AI 推斷但尚未確認的關係
CREATE TABLE IF NOT EXISTS knowledge_relation_candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    source_id INTEGER NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
    target_id INTEGER NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
    relation_type VARCHAR(50) NOT NULL,

    -- AI 判斷結果
    confidence FLOAT NOT NULL,                  -- 信心度
    reasoning TEXT NOT NULL,                    -- 推斷原因
    evidence JSONB,                             -- 支持證據（如相似句子）

    -- 狀態
    status VARCHAR(50) DEFAULT 'pending',       -- pending/approved/rejected/auto_approved
    reviewed_by VARCHAR(255),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,

    -- 自動處理規則
    auto_approve_threshold FLOAT DEFAULT 0.9,   -- 超過此信心度自動批准

    -- 時間
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(source_id, target_id, relation_type)
);

CREATE INDEX IF NOT EXISTS idx_candidates_status ON knowledge_relation_candidates(status);
CREATE INDEX IF NOT EXISTS idx_candidates_confidence ON knowledge_relation_candidates(confidence);


-- ============================================================
-- 觸發器：自動更新時間戳
-- ============================================================

CREATE OR REPLACE FUNCTION update_relations_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_relations_updated ON knowledge_relations;
CREATE TRIGGER trigger_relations_updated
    BEFORE UPDATE ON knowledge_relations
    FOR EACH ROW
    EXECUTE FUNCTION update_relations_timestamp();


-- ============================================================
-- 觸發器：新知識時通知 AI 發現關係
-- ============================================================

CREATE OR REPLACE FUNCTION notify_relation_discovery()
RETURNS TRIGGER AS $$
BEGIN
    -- 插入發現任務
    INSERT INTO knowledge_relation_discovery_tasks (knowledge_id, task_type)
    VALUES (NEW.id, 'new_item');

    -- 發送通知（可選，用於觸發外部處理）
    PERFORM pg_notify('knowledge_relation_discovery', json_build_object(
        'knowledge_id', NEW.id,
        'title', NEW.title,
        'task_type', 'new_item'
    )::text);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 在 knowledge_items 表上建立觸發器（如果尚未存在）
DROP TRIGGER IF EXISTS trigger_discover_relations_on_insert ON knowledge_items;
CREATE TRIGGER trigger_discover_relations_on_insert
    AFTER INSERT ON knowledge_items
    FOR EACH ROW
    EXECUTE FUNCTION notify_relation_discovery();


-- ============================================================
-- 函數：取得知識圖譜
-- ============================================================

CREATE OR REPLACE FUNCTION get_knowledge_graph(
    p_knowledge_id INTEGER,
    p_depth INTEGER DEFAULT 1,
    p_relation_types TEXT[] DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
    v_nodes JSONB;
    v_edges JSONB;
    v_center JSONB;
BEGIN
    -- 取得中心節點
    SELECT jsonb_build_object(
        'id', id,
        'title', title,
        'knowledge_type', type,
        'customer_name', customer_name
    ) INTO v_center
    FROM knowledge_items
    WHERE id = p_knowledge_id;

    IF v_center IS NULL THEN
        RETURN NULL;
    END IF;

    -- 取得相關節點和邊（遞迴到指定深度）
    WITH RECURSIVE graph AS (
        -- 起始節點
        SELECT
            p_knowledge_id AS node_id,
            NULL::INTEGER AS from_id,
            NULL::VARCHAR AS relation_type,
            0 AS depth

        UNION ALL

        -- 遞迴查詢關聯
        SELECT
            CASE
                WHEN kr.source_id = g.node_id THEN kr.target_id
                ELSE kr.source_id
            END AS node_id,
            g.node_id AS from_id,
            kr.relation_type,
            g.depth + 1 AS depth
        FROM graph g
        JOIN knowledge_relations kr ON (
            (kr.source_id = g.node_id OR kr.target_id = g.node_id)
            AND (p_relation_types IS NULL OR kr.relation_type = ANY(p_relation_types))
            AND (kr.valid_until IS NULL OR kr.valid_until > NOW())
        )
        WHERE g.depth < p_depth
    )
    SELECT
        jsonb_agg(DISTINCT jsonb_build_object(
            'id', ki.id,
            'title', ki.title,
            'knowledge_type', ki.type,
            'customer_name', ki.customer_name
        )),
        jsonb_agg(DISTINCT jsonb_build_object(
            'source_id', g.from_id,
            'target_id', g.node_id,
            'relation_type', g.relation_type
        )) FILTER (WHERE g.from_id IS NOT NULL)
    INTO v_nodes, v_edges
    FROM graph g
    JOIN knowledge_items ki ON ki.id = g.node_id;

    RETURN jsonb_build_object(
        'center', v_center,
        'nodes', COALESCE(v_nodes, '[]'::jsonb),
        'edges', COALESCE(v_edges, '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- 函數：自動批准高信心度候選關係
-- ============================================================

CREATE OR REPLACE FUNCTION auto_approve_relation_candidates()
RETURNS INTEGER AS $$
DECLARE
    v_approved_count INTEGER := 0;
    v_candidate RECORD;
BEGIN
    FOR v_candidate IN
        SELECT * FROM knowledge_relation_candidates
        WHERE status = 'pending'
          AND confidence >= auto_approve_threshold
    LOOP
        -- 建立實際關係
        INSERT INTO knowledge_relations (
            source_id, target_id, relation_type,
            confidence, created_by, reasoning
        ) VALUES (
            v_candidate.source_id,
            v_candidate.target_id,
            v_candidate.relation_type,
            v_candidate.confidence,
            'ai_inferred',
            v_candidate.reasoning
        )
        ON CONFLICT (source_id, target_id, relation_type) DO NOTHING;

        -- 更新候選狀態
        UPDATE knowledge_relation_candidates
        SET status = 'auto_approved',
            reviewed_at = NOW()
        WHERE id = v_candidate.id;

        v_approved_count := v_approved_count + 1;
    END LOOP;

    RETURN v_approved_count;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- 檢視：知識關係總覽
-- ============================================================

CREATE OR REPLACE VIEW v_knowledge_relations_overview AS
SELECT
    kr.id,
    kr.relation_type,
    krt.label AS relation_label,
    ks.id AS source_id,
    ks.title AS source_title,
    ks.type AS source_type,
    kt.id AS target_id,
    kt.title AS target_title,
    kt.type AS target_type,
    kr.weight,
    kr.confidence,
    kr.created_by,
    kr.created_at
FROM knowledge_relations kr
JOIN knowledge_items ks ON kr.source_id = ks.id
JOIN knowledge_items kt ON kr.target_id = kt.id
LEFT JOIN knowledge_relation_types krt ON kr.relation_type = krt.type_code
WHERE kr.valid_until IS NULL OR kr.valid_until > NOW();


-- ============================================================
-- 說明
-- ============================================================
COMMENT ON TABLE knowledge_relations IS '知識關聯 - 定義知識項目之間的關係';
COMMENT ON TABLE knowledge_relation_types IS '關係類型定義 - 定義和描述所有可用的關係類型';
COMMENT ON TABLE knowledge_relation_discovery_tasks IS 'AI 關係推斷任務 - 追蹤 AI 自動發現關係的任務';
COMMENT ON TABLE knowledge_relation_candidates IS '關係推斷候選 - 儲存 AI 推斷但尚未確認的關係';
COMMENT ON FUNCTION get_knowledge_graph IS '取得以指定知識為中心的關聯圖譜';
COMMENT ON FUNCTION auto_approve_relation_candidates IS '自動批准高信心度的候選關係';
