use tauri_plugin_sql::{Builder as SqlBuilder, Migration, MigrationKind};

// SQLite schema 初始化(四表)。
// - 官方题库走 questions.json 只读;questions 表只存"我的库"(ADR-3 双库)
// - review_state 跨官方+我的库,按 id 全局唯一(ADR-9)
// - profile 单行,求职目标档案(ADR-4 中枢)
// - questions.status 草稿/已审(ADR-10 质量闸)
fn db_migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "create_initial_tables",
        sql: include_str!("../migrations/001_init.sql"),
        kind: MigrationKind::Up,
    }]
}

// ===== LLM API key 安全存储(keyring → OS 钥匙串,ADR-8。不用 Stronghold) =====
const KEYRING_SERVICE: &str = "resume-assistant";
const KEYRING_USER: &str = "llm-api-key";

fn keyring_entry() -> Result<keyring::Entry, keyring::Error> {
    keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER)
}

/// 读取 LLM API key。无 key 返回 None(首次使用);其他错误返回 Err。
#[tauri::command]
fn get_api_key() -> Result<Option<String>, String> {
    match keyring_entry().and_then(|e| e.get_password()) {
        Ok(p) => Ok(Some(p)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// 保存 LLM API key 到 OS 钥匙串。
#[tauri::command]
fn set_api_key(key: String) -> Result<(), String> {
    keyring_entry()
        .and_then(|e| e.set_password(&key))
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            SqlBuilder::default()
                .add_migrations("sqlite:resume.db", db_migrations())
                .build(),
        )
        .invoke_handler(tauri::generate_handler![get_api_key, set_api_key])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    // 在内存 SQLite 上跑全部 migration(每个测试独立内存库)
    fn migrated_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        for m in db_migrations() {
            conn.execute_batch(&m.sql).unwrap();
        }
        conn
    }

    #[test]
    fn creates_all_four_tables() {
        let conn = migrated_db();
        for table in ["questions", "review_state", "notes", "profile"] {
            let n: i64 = conn
                .query_row(
                    &format!(
                        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='{table}'"
                    ),
                    [],
                    |r| r.get(0),
                )
                .unwrap();
            assert_eq!(n, 1, "表 {table} 未创建");
        }
    }

    #[test]
    fn migration_is_idempotent() {
        let conn = Connection::open_in_memory().unwrap();
        let sql = &db_migrations()[0].sql;
        conn.execute_batch(sql).unwrap();
        conn.execute_batch(sql).unwrap();
    }

    #[test]
    fn questions_rejects_invalid_difficulty() {
        let conn = migrated_db();
        conn.execute(
            "INSERT INTO questions(id,category,module,module_name,index_real,difficulty,title,answer,followups,tags,status,created_at,updated_at) \
             VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
            rusqlite::params![
                "my-t.01.1", "t", 1, "m", 1.0, "中", "标题", "[]", "[]", "[]", "approved", 0, 0
            ],
        )
        .unwrap();
        let bad = conn.execute(
            "INSERT INTO questions(id,category,module,module_name,index_real,difficulty,title,answer,followups,tags,status,created_at,updated_at) \
             VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
            rusqlite::params![
                "my-t.01.2", "t", 1, "m", 2.0, "简单", "标题", "[]", "[]", "[]", "approved", 0, 0
            ],
        );
        assert!(bad.is_err(), "difficulty CHECK 约束未生效");
    }

    #[test]
    fn profile_enforces_single_row() {
        let conn = migrated_db();
        conn.execute("INSERT INTO profile(id) VALUES(1)", []).unwrap();
        let bad = conn.execute("INSERT INTO profile(id) VALUES(2)", []);
        assert!(bad.is_err(), "profile 单行约束未生效");
    }

    // keyring: 实际 OS 钥匙串存取有副作用 + 环境依赖,留运行时验证。
    // 这里只测纯常量(keyring target 标识),确保改名时测试报红。
    #[test]
    fn keyring_target_constants() {
        assert_eq!(KEYRING_SERVICE, "resume-assistant");
        assert_eq!(KEYRING_USER, "llm-api-key");
    }
}
