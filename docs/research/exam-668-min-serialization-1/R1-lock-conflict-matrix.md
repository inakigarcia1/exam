# R1 — Lock Conflict Matrix（最小序列化关系）

基线 `master = 158dc38d`；PostgreSQL 18.4（`postgres:18.4-bookworm`，docker-compose.dev.yml:6）。
PG 官方语义引用：Row-Level Locks（Table 13.3）——`FOR SHARE` 与 `FOR SHARE`、`FOR KEY SHARE` 兼容；与 `FOR NO KEY UPDATE`、`FOR UPDATE` 冲突。非键列 `UPDATE` 取 `FOR NO KEY UPDATE`；RR 下锁定读遇到"快照后已提交变更的行"抛 serialization_failure（40001）。

## 0. 冲突类别判定：谁真正"写"Exam 行？

Exam 行（`exams` 单行）上的参与方按**是否写该行**分为两类：

- **Exam Writer（W）**——在事务中 UPDATE/DELETE `exams` 行：
  `extendExam`（closeAt）、exam.update（openAt/closeAt，published）、close/unpublish/cancel/archive（status）、`checkAndUpdateExamStatus`（惰性 open/close，经 `reconcileExamForRead` 与 TX-ADMIN）、`publishResults`（resultsPublishedAt）、exam.delete（draft）、timed_sync sitting start（`syncStartedAt` 写；当前 API 不可达——publish 拒绝 timed_sync，Phase 1）。
- **Exam Reader-Decision（R 类）**——只在 deadline 决策中读该行，**从不写**：
  C（take/save/submit 的 reconciliation seam、restore）、S（scanner `autoSubmitAndGrade`）、O（operator grant）。其全部持久写落在 attempt/enrollment/workset/audit/adjustment/事件账本行上。

注意 S/O 在 as-built 中同时是"R 类读者"与"Attempt 写者"两个身份；它们与 C 的互斥需求来自 attempt 归属（同 attempt 由 Attempt 锁解决），**不来自 Exam 行**（R1-C 证明）。#558 的要求精确化为：**R 类与 W 必须在 Exam 行上互斥；R 类相互之间在 Exam 行上无需互斥**。

### 审计补记（R5 阶段独立审计发现，2026-10-23）

W 类枚举初版遗漏 **publish（draft→published）**：`examCommands.ts` 的 `publishExam`（:159 `findById` + :313 `repo.update`）在**不持有 exams FOR UPDATE** 的情况下 UPDATE exams 行 —— 它不在 `executeAdminExamTransition` 的 7 条经锁路径中。as-built 修正：exams UPDATE 调用点共 9 处，其中 8 处带 FOR UPDATE 前缀，publish 是唯一无锁写点。

对 #668 结论的影响：**无**。(a) draft 态 exam 尚无任何 deadline reader（candidate 不可开始 attempt），R 类与该写点天然不相交；(b) share 候选机制不给任何 writer 加 share 前缀，该路径与升级风险（R1-D）无关；(c) 它是既有的 as-built 弱点（publish 与惰性 reconcile 之间同样无互斥），属于 publish 路径自身的问题，记录为 follow-up，不在本研究范围内修复。

## 1. 完整冲突矩阵

冲突语义分轴：**行轴**（哪一行成为互斥介质：Exam / Attempt / Enrollment / 无）与 **机制轴**（A=FOR UPDATE 现行；B=FOR SHARE 候选）。"必需"指若解除该互斥是否存在可证明的错误交错。

| 关系 | 冲突介质 | A（FOR UPDATE） | B（FOR SHARE） | 互斥是否必需 | 依据 |
| --- | --- | --- | --- | --- | --- |
| **C / C**（同 Exam，不同 Attempt） | Exam 行 | 互斥 | **并行** | **否** | 决策输入=（closeAt, 自身 attempt.deadlineAt, now），输出只写自身行族；无共享 RMW 状态（R1-C 证明） |
| **C / C**（同 Exam，同 Attempt） | Attempt 行 | 互斥 | 互斥（不变） | 是 | EA seam Attempt FU；与 Exam 锁模式无关 |
| **C / W**（reader-first：C 持锁，W 后至） | Exam 行 | W 排队至 C 提交 | W 排队至 C 提交（SHARE 与 UPDATE 冲突，Table 13.3） | **是**（candidate-wins linearization） | #558 契约 |
| **W / C**（writer-first：W 先提交，C 后锁） | Exam 行 | C 侧 40001→整 tx 重试 | C 侧 40001→整 tx 重试（RR 锁定读同规则） | **是**（no stale closeAt durable） | #558 契约 |
| **C / S**（同 Attempt） | Attempt 行 | 互斥 | 互斥（不变） | 是 | 冻结唯一性；submitAttempt 幂等屏障 |
| **C / S**（同 Exam，不同 Attempt） | Exam 行（S 保持 FOR UPDATE） | 互斥 | 互斥（S 是 UPDATE 请求，与 SHARE 冲突） | 非必需（同 attempt 互不相干；保留因 #667 范围 S 不换锁） | 见 §2 注记 |
| **S / C**（S 先持锁，C 后至） | Exam 行 | C 排队/40001 | C 排队/40001（S 的 UPDATE 请求） | 同上 | 同上 |
| **C / O**、**O / C** | Exam 行（O 保持 FOR UPDATE）+ Attempt 行 | 互斥 | 同 attempt 互斥不变；异 attempt 仅 Exam 轴互斥 | 同 attempt：是（deadline 幂等）；异 attempt：否 | grant 写 attempt.deadlineAt，仅影响自身 attempt |
| **A / A**（同 Attempt；forceSubmit/misconduct/gradeQuestion/heartbeat/markDisrupted 互间或与 C 互间） | Attempt 行 | 互斥 | 互斥（不变） | 是 | Attempt FU / 原子 CAS |
| **A / A**（不同 Attempt） | 无共享行（各自 attempt/enrollment/audit） | 并行 | 并行 | 否 | 无共享 RMW；audit 仅追加 |
| **A / W**（forceSubmit 等 vs Exam writer） | Exam 行（A 不取） | 无互斥 | 无互斥（不变） | 否 | forceSubmit 决策不读 closeAt（已锁定考试仍可被 force submit，属产品语义） |
| **G / A**、**G / W** | G 非独立事务，内联于 C/S/A 事务 | — | — | — | G 的互斥即宿主事务的互斥 |
| **W / W**（admin 互间、W 与 reconcileExamForRead） | Exam 行 | 互斥 | 互斥（W 全部保持 FOR UPDATE） | 是 | 单赢家语义（resultsPublishedAt、状态迁移） |
| **不同 Exam**（任意组合） | 无共享行 | 并行 | 并行 | 否 | 每行锁皆按行标识 |

**矩阵结论**：B 与 A 的唯一行为差异是第一行（C/C 异 Attempt 在 Exam 轴并行化）与它的传递效应（C 不再阻塞其他 C 的队列位置）。所有标"是"的关系在 B 下逐一保持。

## 2. 范围注记：S/O/restore 的锁模式选择

候选机制 B（#667 原型范围）只把 `deadlineReconciliation.ts` 两处读换为 FOR SHARE；scanner、operator grant、restore 的 Exam FOR UPDATE **有意保留**。保留的正确性后果：

- S/O/restore（异 attempt）与 C 仍在 Exam 轴互斥——保守但正确（它们本就无需与 C 互斥，保留只是放弃了部分并行收益）；
- 锁队列公平性：PG 中已排队的 FOR UPDATE 请求会阻塞其后兼容的 FOR SHARE 请求（防 writer 饥饿）。S 扫描 tick 期间（每到期 attempt 一个短事务）同 exam 的 C 提交会在该窗口排队——与 A 行为相同或更好；
- 升级风险：无（见 R1-D）。

扩大范围（S/O/restore 也换 SHARE）在正确性上同样可行（同为 R 类读者），但属机制范围决策，非正确性必要条件；本文按 #667 保守范围分析，并注明扩大范围是被允许的后续选项。

## 3. Reader/Reader 互斥解除的正确性证明（R1-C）

**命题**：同一 Exam 下两个不同 Attempt 的 C 类事务（deadline 决策 + 冻结 + 评分 + 终态投影）在 Exam 轴上并行执行，不产生任何不可串行化的结果。

**证明**（归纳于 C 类事务的全部读写）：

1. **读集**：`exams` 行（只读：closeAt、passingScore、scoreStrategy、retakePolicy——后三者 publish 后经 exam.update 的状态守卫不可变，exam.ts:996-1006 仅允许 published 改 openAt/closeAt）；自身 `exam_enrollments` 行；自身 `exam_attempts` 行；自身 workset/receipt/事件行。两个不同 Attempt 的 C 事务读集交集 = `exams` 行。
2. **写集**：各自 attempt 行、各自 enrollment 行、各自 workset/audit/事件行。交集 = ∅（audit 为纯追加，无读改写）。
3. Exam 行对 C 类事务是**只读单抄本**：C 的所有行为可建模为函数 `decide(closeAt, deadlineAt, now) → {freeze | proceed}`。两次并行决策的结果只依赖于各自读到的 closeAt 值，与另一事务的决策结果及提交顺序无关。
4. 因此任意交错都等价于某个串行顺序：先排列两个 C 事务（两者无相互依赖，顺序任取），再按 W 的实际提交时间把每个 C 的"读取 closeAt"事件定位于 W 写操作之间。B 机制保证每个 C 读到的 closeAt 要么是"其锁获取时刻前最近已提交值"，要么该事务 40001 终止（RR 锁定读规则）——即每个决策事件可被线性化于 closeAt 写序列上。
5. 串行等价性由此成立。∎

**反向必要性（为什么 A 的 C/C 互斥不是正确性所需）**：若 C/C 互斥被移除后存在错误，则必存在一个交错使得某事务的读集观测到另一 C 事务的写——由 (2) 写集交集为空，该前提取不到实例。故互斥非必需。

**边界条件**：
- 同 Attempt 的并发请求不在此命题内（Attempt 轴互斥独立保证，两机制相同）；
- 命题依赖"closeAt 是 C 唯一关注的 Exam 可变字段"：`shouldEnrollmentComplete`（grading.ts:81）也读 closeAt——同一只读事实，同样被 R/W 互斥覆盖；
- 若未来 C 类路径开始写 Exam 行（当前不存在），命题失效，须重新进入本审计。

## 4. 不能证明的关系（UNPROVEN 清单）

- `R / R` 在**扩大范围**（S/O/restore 全部换 SHARE）下与批处理扫描吞吐的相互作用：正确性可证，吞吐方向未测（R4 范围）。
- timed_sync sitting start（syncStartedAt 写）与 C 的关系：W/C 关系覆盖其正确性，但该路径当前不可达，无法建立行为证据（仅静态论证）。
- SERIALIZABLE 隔离级别下的行为：产品固定 RR/RC，未研究 SSI 谓词锁交互。
