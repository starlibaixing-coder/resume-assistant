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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            SqlBuilder::default()
                .add_migrations("sqlite:resume.db", db_migrations())
                .build(),
        )
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

    // 在内存 SQLite 上跑全部 migration(每个测试独立内存库,互不污染)
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
        // plugin-sql 用 IF NOT EXISTS + 版本跟踪;同一 SQL 连跑两次应不报错
        let conn = Connection::open_in_memory().unwrap();
        let sql = &db_migrations()[0].sql;
        conn.execute_batch(sql).unwrap();
        conn.execute_batch(sql).unwrap();
    }

    #[test]
    fn questions_rejects_invalid_difficulty() {
        let conn = migrated_db();
        // 合法 difficulty
        conn.execute(
            "INSERT INTO questions(id,category,module,module_name,index_real,difficulty,title,answer,followups,tags,status,created_at,updated_at) \
             VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
            rusqlite::params![
                "my-t.01.1", "t", 1, "m", 1.0, "中", "标题", "[]", "[]", "[]", "approved", 0, 0
            ],
        )
        .unwrap();
        // 非法 difficulty 应被 CHECK 拒绝
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
        // id=2 应被 CHECK(id=1) 拒绝
        let bad = conn.execute("INSERT INTO profile(id) VALUES(2)", []);
        assert!(bad.is_err(), "profile 单行约束未生效");
    }
}
