#!/usr/bin/env node

/**
 * Migration Runner
 * 執行資料庫遷移腳本
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 資料庫配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'ekms',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
};

async function runMigrations() {
  const client = new pg.Client(dbConfig);

  try {
    console.log('Connecting to database...');
    await client.connect();

    // 建立 migrations 追蹤表
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // 取得已執行的遷移
    const { rows: executed } = await client.query('SELECT name FROM _migrations');
    const executedNames = new Set(executed.map(r => r.name));

    // 取得所有遷移檔案
    const migrationFiles = fs.readdirSync(__dirname)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`Found ${migrationFiles.length} migration files`);

    // 執行未執行的遷移
    for (const file of migrationFiles) {
      if (executedNames.has(file)) {
        console.log(`  ✓ ${file} (already executed)`);
        continue;
      }

      console.log(`  → Executing ${file}...`);

      const sql = fs.readFileSync(path.join(__dirname, file), 'utf-8');

      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`    ✓ ${file} completed`);
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`    ✗ ${file} failed:`, error.message);
        throw error;
      }
    }

    console.log('\nAll migrations completed successfully!');
  } catch (error) {
    console.error('\nMigration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// 執行
runMigrations();
