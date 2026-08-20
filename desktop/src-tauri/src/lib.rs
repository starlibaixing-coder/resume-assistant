use std::sync::atomic::{AtomicBool, Ordering};
use tauri::Manager;
use tauri_plugin_sql::{Builder as SqlBuilder, Migration, MigrationKind};

// SQLite schema 初始化 + 演进。
// - 官方题库走 questions.json 只读;questions 表只存"我的库"(ADR-3 双库)
// - review_state 跨官方+我的库,按 id 全局唯一(ADR-9)
// - profile 单行,求职目标档案(ADR-4 中枢)
// - questions.status 草稿/已审(ADR-10 质量闸)
// - secrets 应用密钥(API key;2026-08-20 起 key 存此,原 keyring 已移除)
fn db_migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create_initial_tables",
            sql: include_str!("../migrations/001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "add_questions_source_id",
            sql: include_str!("../migrations/002_add_source_id.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "create_secrets_table",
            sql: include_str!("../migrations/003_secrets.sql"),
            kind: MigrationKind::Up,
        },
    ]
}

// ===== 真机冒烟模式(SMOKE=1 或 --smoke)=====
// e2e 是 web 层回归(mock IPC),驱动 feature/ACL/磁盘这类真机故障只有这里能抓:
// 前端跑五步自检(smoke.ts,走真 SQLite smoke.db),每步经 smoke_report 打到 stdout,
// 结束 smoke_finish 以 0/1 退出。scripts/smoke.py 负责拉起并汇总报告。
static SMOKE: AtomicBool = AtomicBool::new(false);

fn is_smoke_launch() -> bool {
    std::env::args().any(|a| a == "--smoke") || std::env::var("SMOKE").ok().as_deref() == Some("1")
}

#[tauri::command]
fn is_smoke_mode() -> bool {
    SMOKE.load(Ordering::Relaxed)
}

#[tauri::command]
fn smoke_report(step: String, pass: bool, detail: String) {
    log::info!("[smoke] {}  {:<18} {}", if pass { "PASS" } else { "FAIL" }, step, detail);
}

#[tauri::command]
fn smoke_finish(app: tauri::AppHandle, passed: bool) {
    log::info!("[smoke] RESULT {}", if passed { "all-passed" } else { "FAILED" });
    app.exit(passed as i32);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    SMOKE.store(is_smoke_launch(), Ordering::Relaxed);
    tauri::Builder::default()
        .plugin(
            SqlBuilder::default()
                .add_migrations("sqlite:resume.db", db_migrations())
                // 冒烟库:同一套迁移,隔离于用户真实数据(resume.db 不被冒烟触碰)
                .add_migrations("sqlite:smoke.db", db_migrations())
                .build(),
        )
        .invoke_handler(tauri::generate_handler![is_smoke_mode, smoke_report, smoke_finish])
        .setup(|app| {
            // 冒烟每次从干净库跑:删旧 smoke.db,全新迁移(迁移演进也被覆盖)
            if SMOKE.load(Ordering::Relaxed) {
                if let Ok(dir) = app.path().app_config_dir() {
                    let _ = std::fs::remove_file(dir.join("smoke.db"));
                }
            }
            // 日志:stdout + 文件(app_log_dir/app.log,用户报障查这里)+ 回显 webview 控制台。
            // 全构建启用——release 出问题同样要有迹可循。
            app.handle().plugin(
                tauri_plugin_log::Builder::default()
                    .level(log::LevelFilter::Info)
                    .targets([
                        tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                        tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                            file_name: Some("app".into()),
                        }),
                        tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Webview),
                    ])
                    .build(),
            )?;
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

    // 幂等性只适用于 001(全部 IF NOT EXISTS);002 的 ALTER ADD COLUMN 由版本号保证只跑一次
    #[test]
    fn migration_001_is_idempotent() {
        let conn = Connection::open_in_memory().unwrap();
        let sql = &db_migrations()[0].sql;
        conn.execute_batch(sql).unwrap();
        conn.execute_batch(sql).unwrap();
    }

    // 002:source_id 加入后旧行为 NULL,新行可写入读取
    #[test]
    fn source_id_column_nullable_and_writable() {
        let conn = migrated_db();
        conn.execute(
            "INSERT INTO questions(id,category,module,module_name,index_real,difficulty,title,answer,followups,tags,status,created_at,updated_at) \
             VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
            rusqlite::params![
                "my-t.01.1", "t", 0, "官方题副本", 1.0, "中", "标题", "[]", "[]", "[]", "approved", 0, 0
            ],
        )
        .unwrap();
        let legacy: Option<String> = conn
            .query_row("SELECT source_id FROM questions WHERE id='my-t.01.1'", [], |r| r.get(0))
            .unwrap();
        assert!(legacy.is_none(), "旧行 source_id 应为 NULL");

        conn.execute(
            "UPDATE questions SET source_id='fe.01.1' WHERE id='my-t.01.1'",
            [],
        )
        .unwrap();
        let src: Option<String> = conn
            .query_row("SELECT source_id FROM questions WHERE id='my-t.01.1'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(src.as_deref(), Some("fe.01.1"));
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

    // 003:secrets 表可 UPSERT(key 存取的落点)
    #[test]
    fn secrets_upsert() {
        let conn = migrated_db();
        conn.execute(
            "INSERT INTO secrets(name, value) VALUES('llm-api-key','sk-1') ON CONFLICT(name) DO UPDATE SET value='sk-1'",
            [],
        )
        .unwrap();
        let v: String = conn
            .query_row("SELECT value FROM secrets WHERE name='llm-api-key'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(v, "sk-1");
        conn.execute(
            "INSERT INTO secrets(name, value) VALUES('llm-api-key','sk-2') ON CONFLICT(name) DO UPDATE SET value='sk-2'",
            [],
        )
        .unwrap();
        let v2: String = conn
            .query_row("SELECT value FROM secrets WHERE name='llm-api-key'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(v2, "sk-2", "UPSERT 未覆盖旧值");
    }
}
