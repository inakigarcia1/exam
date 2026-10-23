# R0 — Transaction Boundaries: 提交链路事务边界清单

基线 `master = 158dc38d`。本文档枚举与 Candidate Take / Save / Submit / Deadline Reconciliation 相关的全部事务边界，标注隔离级别、锁集合、原子性承诺与崩溃窗口。

## 1. 事务清单

| ID | 事务 | 隔离级别 | 锁序列（→ 表获取顺序） | 原子性承诺（要么全有要么全无） | 崩溃窗口 |
| --- | --- | --- | --- | --- | --- |
| TX-SUBMIT | `submitAndGradeAttempt` | RR + 40001/40P01 整 tx 重试 | Enrollment FU → Attempt FU → Exam FU（经 reconciliation）→ attempt/workset/enrollment/audit 写 | deadline 决策 + 冻结 + workset + 评分 + 终态投影 + audit 单点提交；提交后响应才可见 | 无"submitted 未评分"持久窗口（`submitted` 中间态仅存在于未提交事务；真崩溃则整 tx 回滚，attempt 仍 in_progress） |
| TX-TAKE | take 路由 reconciliation | RR | 同上前三锁；通常无写 | 过期则"决策+冻结+评分"原子；未过期纯读 | 无 |
| TX-SAVE | save 路由 | RR | Enrollment FU → Attempt FU → Exam FU（preparation seam）→ answers+receipt 写 | deadline 前置 + 答案接受 + replay receipt 一个协议提交（`answerProtocol.ts:471-485`） | 无 |
| TX-RESTORE | restore 路由 / start-restore | RR | Enrollment FU → Attempt FU → Exam FU（restoreInterruption:228）→ 补偿/事件/reconciliation 写 | 补偿决策+adjustment+deadline 修改+生命周期翻转+事件账本原子 | 无 |
| TX-START | /start（新建或恢复） | **READ COMMITTED** | Enrollment FU → Attempt FU（新建路径无 Exam 锁；restore 分支经 TX-RESTORE 语义加 Exam FU） | admission 消耗 + attempt 创建 + enrollment 计数 同事务（#292） | 双击竞态由 RC + Attempt 定位解决（types.ts:141 注释） |
| TX-SCAN | `autoSubmitAndGrade`（每 attempt 一个事务） | RR | Enrollment FU → Attempt FU → Exam FU → 冻结+评分写 | 同 TX-SUBMIT（deadline 版） | 无 |
| TX-GRANT | operator grant | RR | Enrollment FU → Attempt FU → Exam FU（operatorGrant:205）→ adjustment/deadline/事件写 | grant+ledger+deadline 修改原子 | 无 |
| TX-FORCE | force submit | RR | Enrollment FU → Attempt FU（**无 Exam 锁**）→ receipt+冻结+评分写 | receipt（操作幂等仲裁）+ submit + grade 原子 | 无（23505 幂等重放） |
| TX-GQ | manual gradeQuestion | RR | Enrollment FU → Attempt FU（**无 Exam 锁**；exam 事务外预读）→ 条目完成+终态投影写 | 条目完成+attempt/enrollment 终态原子 | 无 |
| TX-RECON | `reconcileExamForRead`（candidate list/detail/start 前置） | RR | Exam FU（短事务，无迁移时也持锁） | 惰性 open/close 迁移原子 | 无 |
| TX-ADMIN | admin exam transition（close/extend/…） | RR | Exam FU → reconcile 写 → 命令写 → audit | 状态/closeAt 变更+audit 原子 | 无 |
| TX-PUBRES | publishResults | RR | Exam FU | resultsPublishedAt 单赢家 | 无 |
| TX-HEARTBEAT | heartbeat | 单语句 | attempt 行原子 UPDATE（status 限定谓词） | 单语句 | 无 |
| TX-PUBLISH | publishExam（draft→published） | RR | **无 Exam 锁**：`findById` 后直接 `repo.update`（examCommands.ts:159/:313，审计补记） | 状态写+audit 原子 | 无 Exam 锁下的 exams UPDATE 是 as-built 例外：draft 态无 deadline reader 相交；与惰性 reconcile 的互斥缺失属 publish 路径自身弱点（follow-up，非 #668 范围） |

## 2. 关键边界事实

1. **快照固定点**：RR 事务的快照在其第一条语句建立（EA seam 的 locator 普通读）。此后任何对已变更行的锁定读（FOR UPDATE/FOR SHARE）都会以 40001 失败 → `executeInTransaction` 整事务重试，重试建立新快照。这是 #558 "no stale closeAt decision durable" 的机制载体。
2. **Exam 锁覆盖窗**（TX-SUBMIT 未过期路径）：从 reconciliation 的 Exam FU 起，至 COMMIT。窗口内全部写都落在 attempt/enrollment/workset/audit/answer_receipts 行上，**无任何 Exam 行写**。已过期路径同窗。
3. **评审点（#668 核心问题）**：deadline 决策只在窗口起点需要 Exam 权威；窗口其余部分对 Exam 行只做普通读（且 RR 下读自身快照）。因此"决策正确性所需的互斥"与"评分执行期的互斥"在机制上可分离——这是 R1（冲突关系）与 R2（临界区分解）的出发点。
4. **同事务二次 Exam 锁**：save 路径 reconciliation（#1 锁）+ preparation seam（`deadlineReconciliation.ts:375`）同模式重入，no-op；restore 路径 restoreInterruption 先锁、reconciliation 再锁，同模式 no-op。**当前不存在同事务内对 Exam 行的异模式请求**（R1-D 证据）。
5. **跨事务原子性边界（有意不合并的）**：
   - submit 事务与 HTTP 响应投影分离（纯读，无决策）；
   - `reconcileExamForRead` 与后续 start 事务分离（两段各自原子；#558 留档缺口：start 新建路径对 closeAt 用 RC 已提交读）；
   - scanner 的发现查询与逐 attempt 的事务分离（发现是过近似，权威在锁内重检）。
6. **audit 原子性**：`recordAtomicHttpAudit` 与业务同事务（TX-SUBMIT 内 audit 在 freeze 后、grading 前；TX-ADMIN/TX-GQ 内在命令后）。回滚时 audit 一并回滚——audit 不是跨事务的。
7. **重试语义的完整重放**：40001 重试重入整个 callback（repo 重建、seam 重入、幂等守卫重评）。`finalizeTerminalGrading` 的 `graded → grade` 非法转移守卫 + 上游幂等分支保证重试永不观察半提交态（`grading.ts:198-207`）。

## 3. 保存点/早释放不可能性（as-built 约束）

PostgreSQL 行锁持有至 COMMIT/ROLLBACK；SAVEPOINT RELEASE 不释放行锁。因此"缩短 Exam 锁持有时间"在单事务内不可实现，只有两条结构路径：
- **改变锁模式**（FOR SHARE）缩短他人等待（不缩短自身持有）→ R1/R3；
- **拆分事务**（决策事务与冻结/评分事务分离，或评分异步化）→ 改变 #558/ADR-008 的单事务原子性承诺，属产品/架构契约变更，须 Owner 门禁（R2 结论）。

## 4. 池占用推论（接 #586）

TX-SUBMIT 的持锁窗口即连接占用窗口：同 exam 的第 k+1 个 candidate 事务必须等第 k 个提交。pool=10 下并发等待者上限 9，等待时间 = 前序事务完整时长（含评分）。#586 裁决 KEEP_POOL_10 的机理（加池加深 convoy 而非减少尾延迟）与本边界清单一致：瓶颈是行上的串行窗，不是连接数。
