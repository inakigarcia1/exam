# R3 — 正确性实验证据（EXAM #668）

状态：EVIDENCE-COMPLETE（三臂全部运行，装置 rig 见 `rig/`，可按 README 重放）
基线：master `158dc38d` + rig 补丁（`rig/exam-668-min-serialization.patch`）
环境：WSL2 / PostgreSQL 18.4（docker `postgres:18.4-bookworm`）/ 仓库 dev compose / `APP_MODE=test` worker 槽库（docs/standards/testing.md §2 契约）

## 0. 实验设计回顾

同一探针套件（`rig/exam-668-serialization.research.test.ts`，T1–T8）在三把 Exam 权威锁模式下运行，`EXAM_668_LOCK_MODE` 切换：

- `update`（canonical，现行机制）：seam 处 `findByIdForUpdate`；
- `share`（#667 候选机制）：仅 deadline reader 两处改 `findByIdForShare`，writer/scanner/operator/restore 保留 FOR UPDATE；
- `none`（反事实负控制）：普通 MVCC 读，即 pre-#558 缺陷形态。

调度控制全部继承 #560/#543 套件纪律：deferred park 点 + enrollment 行锁 barrier（pg_locks txid 等待者谓词）+ `pg_blocking_pids` 有硬截止的活跃性观察；无任何以 sleep 换同步的断言。

装置有效性判据（R4-protocol §3）：A 臂全绿；B 臂全绿；C 臂至少一红。

## 1. 结果矩阵

| 探针 | update（canonical） | share（候选） | none（负控制） |
| --- | --- | --- | --- |
| T1 reader/reader 模式判定 | ✓ 互斥被见证 | ✓ 并行被见证¹ | ✓ 并行 |
| T2 submit writer-first（扩展先于冻结） | ✓ | ✓ | ✗（见 §3） |
| T3 take writer-first（陈旧 pass 在锁上中止） | ✓ | ✓ | ✗（见 §3） |
| T4 candidate-first（writer 排队） | ✓ | ✓ | ✓² |
| T5 save vs submit EA 锁族串行 + 最新草稿冻结 | ✓ | ✓ | ✓ |
| T6 submit vs scanner（canonical recheck no-op） | ✓ | ✓ | ✓ |
| T7 不同 exam 负控制 | ✓ | ✓ | ✓ |
| T8 SQL 见证（share/share 共存；升级竞态 40P01） | ✓ | ✓ | ✓ |

计数：update 8/8，share 8/8，none 6/8（恰好红在两个 writer-first 义务探针上）。

¹ share 臂 counterfactual 记录：`{"note":"second reader completed while first reader parked"}` —— reader/reader 并行被直接见证（R1-C 的正面行为证据）。
² none 臂 T4 有模式分支：candidate 不再持 Exam 锁，writer 不排队（`"extend committed while candidate parked (no designed lock)"`）—— 这本身就是锁缺席的见证，不是缺陷。

## 2. update 臂（rig 校验）

8/8 通过 = canonical 行为被忠实复现：T1 观察到 reader/reader 互斥（`pg_blocking_pids` 命中持有者）；T2/T3 的陈旧 pass 在设计的 Exam 锁读上以 40001 中止、整事务重试后落在新权威上（passCount≥2，observedStatuses=["in_progress"]）；T4 writer 在 candidate 锁后排队；T5/T6 证明 EA 锁族与 scanner 轴的串行语义；T8 是纯 SQL 见证（share 共存 / 升级竞态 40P01，与模式无关）。

装置调试中发现并修复的两个 rig 自身问题（不影响产品代码，diff 已含在 rig 补丁中）：

1. fixture 必须复用 harness 的 org —— admin token 的租户边界决定 enroll 路由能否看到 exam（首版 404 根因）；
2. `createPostgresDatabase` 带 schemaName 时固定 `max:1` 单连接 —— park 中的事务独占其连接句柄，竞争事务必须使用独立连接，否则等待的是连接池而非行锁（首版 T1/T5/T6/T7 "waiters seen: []" 根因）。

## 3. none 臂（反事实）—— 证据比预测更强

预测（R1）：无锁读取会用陈旧 closeAt 冻结（stale freeze），单 pass 落盘。
实际（插桩 + PostgreSQL 语句日志证据，`rig/evidence-none-arm-T3-40001-context.log`）：

时间线（T3，模式 none）：

1. pass 1 快照先于扩展提交；seam 普通读 → **陈旧权威** → 判定过期；
2. `04:28:23.491` 终结写落盘语句发出：`status='submitted'`, `submitted_at=05:28:23.133+08`（**= 陈旧 effectiveDeadline**）, `submission_reason='deadline'` —— 陈旧冻结在事务内成立；
3. `04:28:23.471` 扩展（`update exams set close_at`）已在更早提交；
4. `04:28:23.510` 评分写触发 FK RI 内部锁读 `SELECT 1 FROM exams ... FOR KEY SHARE` → 命中"快照后已变更的行" → **40001 could not serialize access due to concurrent update**；
5. `executeInTransaction` 整事务重试，pass 2 新快照看到扩展 → 未过期 → `in_progress`。

即：**设计锁缺席时，陈旧冻结确实发生了（pass 1 的终结写就是证据），最终结果被"偶然的第二道防线"（FK RI 锁读 + RR 40001 + 重试）救回**。T2 同机制（救回后 `submissionReason='manual'`, `submittedAt=arrivalNow`）。

这正是 `deadlineReconciliation.ts` 558 不变量注释中"Correctness must not rest on incidental FK/RI behavior"的活体演示。该救援不可依赖：

- RI 锁读仅在冻结路径恰好写子表行时触发；冻结路径的写集合改变（或 RI 触发规则变化）即失效；
- 依赖 `MAX_RETRIES=3` 未耗尽；
- 依赖触发时序细节（本例中终结写未触发、评分写触发 —— RI 触发器的列级规则属偶然保护面，不是契约）。

## 4. share 臂（等价性正面证据）

8/8 通过，且通过路径与 update 臂语义相同：

- T2/T3：陈旧 pass 仍在 seam 的 FOR SHARE 锁读上以 40001 中止（FOR SHARE 与已提交的非键更新冲突；RR 锁读命中快照后变更行即 40001，与锁模式无关）→ 整事务重试 → 新权威；
- T4：operator extend（FOR UPDATE）与持 FOR SHARE 的 candidate 冲突 → writer 排队（candidate-wins 线性化保持）；
- T5/T6：save/submit/scanner 的 EA 锁族与 canonical recheck 语义不变；
- T1：唯一行为差异 = reader/reader 从互斥变为并行（这正是提议的收益，见 R1 证明 C/C 写集不相交，无需互斥）。

## 5. 对七个研究问题的回答映射

| 问题 | 证据位置 |
| --- | --- |
| Q1 reader/reader 是否需要互斥 | R1 证明（写集不相交）+ T1 share 臂并行见证 |
| Q2 reader↔writer 是否需要互斥 | R1 证明 + T2/T3/T4 三臂对照（none 臂失败形态） |
| Q3 FOR SHARE 能否构造所需冲突关系 | T2/T3/T4/T6 share 臂全绿 + T8 SQL 见证 |
| Q4 升级/隐藏死锁/非法快照风险 | T8（40P01 见证）+ R1-D（现码无同事务升级路径）+ T2/T3 重试语义不变 |
| Q5 Submit 事务边界 | R2（TRANSACTION_BOUNDARY_MINIMAL）；T5 冻结最新已接受草稿 |
| Q6 #667 收益可否复现 | R4（WSL 方向性实验，非正式证据） |
| Q7 可维护性 | R5 最终报告 |

## 6. 局限

- 单环境（WSL2 + PG 18.4）；结论中的行为语义（锁冲突矩阵、RR 40001、锁队列公平性）由 PostgreSQL 版本语义背书，不依赖宿主拓扑；R4 的性能数字另有环境限制声明。
- 探针覆盖 take/save/submit/scanner/extend 轴；未覆盖 force-submit/misconduct/gradingQueue（A 类，不读 Exam 权威行，见 R0 调用图）与 restore（downgrade no-op）—— R1 已静态论证其不构成 share 模式升级风险。
