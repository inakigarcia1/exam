# R0 — Current Reality Audit: Candidate Submit 真实调用链

研究基线：`master = 158dc38de5032f601ac4bc3daa68fbeb71c9be53`（工作树干净，无未提交修改）。
本文档只描述 as-built 行为，全部结论来自对当前 master 生产代码的逐行阅读；行号可点击核对。

## 0. 角色与锁记号

| 记号 | 角色 | 生产入口 |
| --- | --- | --- |
| C | Candidate deadline reader（take/save/submit/restore） | `apps/api/src/routes/attempts.candidate.ts` |
| S | Deadline scanner | `apps/api/src/plugins/deadlineScanner.ts` |
| O | Operator time grant | `apps/api/src/orchestrators/operatorGrantExecution.ts` → `packages/exam-engine/src/operatorGrant.ts` |
| W | Exam authority writer（admin transition / extend / publish results / lazy reconcile） | `apps/api/src/routes/exam.ts`、`apps/api/src/routes/examTransitionExecutor.ts`、`apps/api/src/routes/reconciliation.ts` |
| A | Attempt mutation 不持 Exam 锁的路径（force submit / misconduct void / manual grading） | `apps/api/src/orchestrators/forceSubmitExecution.ts`、`misconductMarkExecution.ts`、`apps/api/src/routes/gradingQueue.ts` |
| G | Grading / finalization（总是内联在 C/S/A 事务中，非独立事务） | `packages/exam-engine/src/grading.ts` |

事务基础设施：`packages/db/src/types.ts:161` `executeInTransaction` —— 默认 **REPEATABLE READ**，捕获 `40001`/`40P01` 整事务重试，最多 3 次，退避 20/40/80ms。例外：`/start` 路由使用 `"read committed"`（`attempts.candidate.ts:726`，双击幂等需要看见并发 INSERT）。

## 1. Exam 行锁（`exams` 行 FOR UPDATE）的全部获取点

| # | 获取点 | 角色 | 锁后持有期间做什么 |
| --- | --- | --- | --- |
| 1 | `deadlineReconciliation.ts:211`（`ensureAttemptDeadlineReconciled`） | C（take/save/submit）、restore 内部 | deadline 决策；若过期 → submitAttempt 冻结 + workset 物化 + finalizeGrading（**全程持锁**） |
| 2 | `deadlineReconciliation.ts:375`（`prepareReconciledAttemptMutation`） | C（save） | effective deadline 读取（同事务二次锁，no-op） |
| 3 | `restoreInterruption.ts:228` | C（restore / start-restore） | closeAt 边界检查 + 补偿决策 + reconciliation（复用 #1） |
| 4 | `operatorGrant.ts:205` | O | bounded grant 以 closeAt 封顶 |
| 5 | `deadlineScanner.ts:194`（`autoSubmitAndGrade`） | S | deadline 决策 + 冻结 + 评分（**全程持锁**） |
| 6 | `examTransitionExecutor.ts:63`（admin close/unpublish/extend/cancel/archive） | W | reconcile + 状态/closeAt 变更 + audit |
| 7 | `exam.ts:979`（exam.update，published 仅允许改 openAt/closeAt） | W | closeAt 变更 |
| 8 | `exam.ts:1938`（exam.delete，仅 draft） | W | 删除 |
| 9 | `reconciliation.ts:66`（`reconcileExamForRead`，被 candidate exam list/detail/`/start` 前置调用） | W（惰性 open/close） | 短事务：无迁移时也持锁读完即提交 |
| 10 | `examCommands.ts:562`（`publishResults`） | W | resultsPublishedAt 单赢家写 |

**不持 Exam 锁的 attempt 变更路径**：`forceSubmitExecution`（Enrollment→Attempt 后 submitAttempt+grade，无 exam 锁）、`misconductMarkExecution`（attempt 锁）、manual `gradeQuestion`（`gradingQueue.ts:351`，Enrollment→Attempt；exam 在事务外预读 `gradingQueue.ts:341`）、heartbeat（`refreshLastActivityIfInProgress` 原子 CAS）、scanner 的 `markDisrupted`（attempt-only，R12）。

SQL 证据：`packages/db/src/repository/examRepo.ts:222` `findByIdForUpdate` = `SELECT … FOR UPDATE`（tenant-scoped）。attempt/enrollment 同型（`attemptRepo.ts:357,412`、`enrollmentRepo.ts:28,74`）。

## 2. Candidate HTTP Submit 真实调用链（修正后的研究起点图）

`POST /attempts/:attemptId/submit`（`attempts.candidate.ts` submit 路由 → `submitAndGradeAttempt`，`orchestrators/submitAndGradeAttempt.ts:54`）：

```text
HTTP Submit
  → authenticate / requireOwnAttempt(AttemptSubmit)        [无 DB 锁；预读 ownership projection]
  → candidateProfile lookup                                [事务外普通读]
  → executeInTransaction(REPEATABLE READ) ──────────────── 事务开始（RR 快照在第一条语句建立）
    → createExamEngineRepos(tx)                            [tx-bound repo 三件套（一次性构建，亲和性靠对象同一性）]
    → lockEnrollmentAndAttempt (lockSeam.ts:68)            [锁 1: locator 普通读（不可变身份列）
                                                            锁 2: Enrollment FOR UPDATE（按 examId+candidateId）
                                                            锁 3: Attempt FOR UPDATE]
    → attempts.findById → ownership check                   [同事务普通读]
    → 分支 status：
       graded      → return alreadyGraded=true              [无 exam 锁！幂等返回]
       submitted   → 跳过 reconciliation（无 exam 锁，crash-recovery）
                     → postSubmit 检查 pending_manual → 否则 readGradingSnapshot + finalizeGrading
       in_progress/disrupted:
         → ensureAttemptDeadlineReconciled (deadlineReconciliation.ts:168)
             → assertCapabilityFor                          [repo 亲和性机械断言]
             → attempt 普通读；submitted/graded 幂等返回；非 in-flight 状态返回
             → 【锁 4: Exam FOR UPDATE】(deadlineReconciliation.ts:211)   ← C/W 序列化点
             → isAttemptDeadlineExpired(exam, attempt, now)  [纯函数：min(closeAt, deadlineAt)]
             ├── 未过期 → return attempt
             └── 已过期 → submitAttempt(submissionReason='deadline')
                             → Attempt FOR UPDATE（同事务 no-op）
                             → interruption terminalization（episode/event 校验+插入）
                             → workset 预置检查（存在即 fail-closed）
                             → buildSubmittedAnswersSnapshot（纯计算）
                             → attempt UPDATE（status=submitted、submitted_answers、gradingStatus）
                             → materializeGradingWorkset（批量 INSERT）
                           → readGradingSnapshot（exam/enrollment 普通读）
                           → finalizeGrading → finalizeTerminalGrading (grading.ts:212)
                             → workset 读 + aggregateGradingEntries（终态前置校验）
                             → attempt UPDATE（status=graded、score、gradingResult）
                             → enrollment 普通读 + UPDATE（finalScore/finalPassed/finalAttemptId/status）
                           → return alreadyGraded=true（HTTP 仍 2xx）
         → 未被 reconciliation 冻结时：
             → submitAttempt(source='candidate')             [冻结屏障，同上，submittedAt=now]
             → recordAtomicHttpAudit（同事务 audit INSERT）
             → attempts.findByIdForUpdate（同事务 no-op 重读）
             → pending_manual → return false（保持 submitted，manual queue 接管）
             → readGradingSnapshot + finalizeGrading          [客观题 → graded；主观题上游已拦截]
  → COMMIT（或 40001/40P01 → 整事务重试 ≤3 次）
  → 事务外：attemptRepo.findById 投影 HTTP 响应（exam 普通读补 closeAt/timingMode）
```

对研究起点图的三处 **修正**：

1. **Enrollment/Attempt 锁在 deadline reconciliation 之前**（seam 先行），不是之后；Exam 锁由 reconciliation seam 自己持有，调用者不得自行锁 Exam（`deadlineReconciliation.ts:157-163` 契约）。
2. **`graded` 幂等返回与 `submitted` crash-recovery 路径完全不取 Exam 锁**（`submitAndGradeAttempt.ts:93-95` 提前 return；`status==="submitted"` 跳过 reconciliation）。#558 closure 也把 crash-recovery 的 plain exam read 列为留档 sibling 缺口。
3. **自动评分（G）确实在 Exam 锁持有期内**：未过期 submit 路径的 Exam 锁从 `deadlineReconciliation.ts:211` 起持有直到 COMMIT，跨越 submitAttempt 冻结、workset 物化、`readGradingSnapshot`、`finalizeTerminalGrading` 的 attempt+enrollment 写与 audit INSERT。已过期路径同样全程持锁（冻结+评分都在 reconciliation 内完成）。

## 3. 各阶段性质表（Submit 主路径，in_progress → graded）

| 阶段 | 访问行 | 锁 | 写持久状态 | 依赖同快照 | 不可逆业务决策 | 可移出事务 | 必须原子提交的对象 | 生命周期 Owner |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Authentication/ownership 预检 | users/candidateProfiles | 无 | 否 | 否 | 否（post-lock 重验） | 已在事务外 | — | route |
| EA seam（locator+Enrollment+Attempt 锁） | examAttempts/examEnrollments | locator 普通读；Enrollment FU；Attempt FU | 否 | 是（RR 快照在此固定） | 否 | 否 | 与后续决策同一事务 | `lockSeam.ts` |
| deadline 决策 | exams（FU）+ attempt | Exam FU | 否 | 是（对 closeAt 必须最新已提交权威） | **是**（冻结与否） | 否 | 决策+冻结必须原子 | `ensureAttemptDeadlineReconciled` |
| Submit 冻结屏障 | attempt FU → UPDATE | Attempt FU（已持） | 是（submitted_answers、status、gradingStatus） | 是 | 是 | 否 | 冻结+workset+audit 一个事务 | `submitAttempt` |
| Workset 物化 | attempt_grading_entries INSERT | 隐式写锁 | 是 | 是 | 条目全集=冻结真相 | 否 | 与冻结同事务 | `submitAttempt` |
| 自动评分聚合 | workset 读 + attempt/enrollment UPDATE | Attempt/Enrollment（已持/隐式写锁） | 是（score、graded、finalScore） | 是 | 是 | 否（否则 0/100 摆动窗口，见 orchestrator 注释） | 与冻结同事务 | `finalizeTerminalGrading` |
| Audit | audit_logs INSERT | 隐式写锁 | 是 | 是 | 否（合规记录） | 否（recordAtomicHttpAudit 与业务同事务） | 与业务同事务 | route/orchestrator |
| COMMIT + 响应投影 | attempt/exam 普通读 | 无 | 否 | 否（纯投影） | 否 | 已在事务外 | — | orchestrator |

## 4. 按状态的分支行为

- **in_progress**（主线）：见 §2。Exam 锁全程持有。
- **disrupted**：同主线；`resolution.mode=active_interruption`，submit 前先 `resolveActiveInterruptionOnTerminalization` 校验 episode/event 身份并插入 terminalized 事件（`restoreInterruption.ts:93`）。restore 路由则先在 `restoreInterruption.ts:228` 取 Exam 锁做补偿/封顶，再复用 reconciliation。
- **submitted 恢复（crash-recovery）**：不取 Exam 锁、不重冻结；`readGradingSnapshot` 用普通读（grading-authority 读，非 deadline-authority），直接 finalizeGrading 幂等收尾。#558 closeout 明确留档此 sibling 缺口。
- **graded 幂等返回**：`submitAndGradeAttempt.ts:93` 无锁返回 `alreadyGraded=true`。
- **pending_manual**：冻结屏障按冻结快照分类（`requiresManualGrading`）；自动路径 fail-closed 拒绝推进（`grading.ts:381`）；只有 `gradeQuestion` 完成最后一个 manual 条目后经同一 `finalizeTerminalGrading` 收敛（此时**无 Exam 锁**）。
- **纯客观题自动终态**：同一事务内 submitted→graded，对 candidate 单次 HTTP 呈现终态；主观题存在时停在 submitted。

## 5. 原始 Exam Lock 在自动评分期间持续持有的 as-built 判定

**判定：持有（除 crash-recovery/graded 幂等分支外），且当前代码路径上不可早释放。**

- 获取点唯一：`deadlineReconciliation.ts:211`（C 路径）；PostgreSQL 行锁持有到事务结束，无 mid-tx 释放机制（SAVEPOINT 不释放行锁）。
- 持有期内的工作：冻结写、workset 批量 INSERT、评分聚合、attempt 终态 UPDATE、enrollment 终态 UPDATE、audit INSERT——全部是**自身 attempt/enrollment/audit 行**上的读写；对 Exam 行本身只读（`readGradingSnapshot` 的 exam 读是普通读）。
- 该持有是否必要 → R1/R2 的核心问题：**C/W 冲突需要 Exam 序列化点是确定的（#558 契约）；C 读到权威后直到 COMMIT 是否仍需排斥其他 C 与 W，是需要证明的部分**。as-built 事实是：机制（FOR UPDATE）使持有期排斥所有同 exam 的 C/S/O/其他 reconcile，无论其后是否再读 Exam。
- 量化参考（历史证据，非当前权威）：#666 测得 93.8% 采样锁等待为 `exams` 单行 tuple wait，S200 pool=10 submit p99≈6.6s（Fedora）；#586 冻结 WSL S200 p99≈5.2s。当前 master 是否复现属 R4 范围。

## 6. 与 Exam 行并发但不受其串行化的路径（完整性）

- `/start` 新建 attempt：事务外 `reconcileExamForRead`（短事务 W 锁）+ 主事务 `"read committed"` 隔离、仅 Enrollment→Attempt（`attemptCommands.ts:239` exam 为普通读）。start 与 extendExam 之间无 Exam 行互斥（新 attempt 的 deadlineAt 由 start 时刻权威计算；RC 隔离下读到当时已提交值）。#558 closeout 将其列为留档缺口。
- heartbeat：attempt 行原子 CAS，无 Exam 锁。
- force submit / misconduct void / manual grading：Enrollment→Attempt，无 Exam 锁（force submit 的评分也无需 closeAt）。
- scanner 发现查询 `listDeadlineCandidates`：普通读，非权威（权威决策在 `autoSubmitAndGrade` 锁内重检）。

## 7. 结论（R0）

1. 研究起点图中"Enrollment lock → Attempt lock → Deadline reconciliation → Exam authority lock → Submit/answer freeze → Grading workset → Grading/finalization → Audit → COMMIT"的顺序**与 as-built 一致**，但需补充：graded/submitted 幂等分支不经过 Exam 锁；audit 在 submit 主路径的 freeze 之后、grading 之前（非末尾）；COMMIT 后还有事务外响应投影。
2. Exam 行锁是同 exam 所有 candidate 事务（take/save/submit/restore + list/detail/start 的 reconcile 短事务 + scanner + operator grant）的**单一互斥点**，且在 submit 主路径持有期覆盖整个冻结+评分区间。
3. 评分所需全部事实（冻结答案、workset、passingScore/scoreStrategy——publish 后不可变）不依赖 Exam 行上的并发状态；对 Exam 行的**唯一**序列化需求来自 deadline 决策对 closeAt 的权威读取（#558）。该分离是 R1/R2 的分析基础。
