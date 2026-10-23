# R2 — Submit Critical Section Decomposition

基线 `master = 158dc38d`。本阶段独立于 FOR SHARE 问题，回答：提交事务中每段工作需要什么原子性、依赖什么冻结事实、需要哪些行锁、去掉/缩短/拆分会制造什么反例。判据是 #558/#543/ADR-008 已接受的不变量（不改写评分生命周期）。

## 1. 逐责任段分析

责任段编号沿用研究合同 §4。每段给出行：原子性需求 / 冻结事实依赖 / 所需行锁 / 是否必须同事务 / 拆分反例 / 事务外可提前计算。

### 1. Actor authorization / ownership

- **原子性**：无（纯授权判定）。
- **依赖**：attempt 归属（candidateId）；与锁内重读一致。
- **锁**：无。route 预检（`requireOwnAttempt`）+ 锁内重验（`submitAndGradeAttempt.ts:87`）。
- **反例**：仅信预检 → TOCTOU 换 attempt 攻击面；现状已双查。
- **事务外提前**：可（已如此）；结论不受 #668 影响。

### 2. Enrollment / Attempt identity 与锁定

- **原子性**：locator 读（不可变身份列）与锁定读分离是安全的（身份列不可变）；status 判定必须在锁下重读（seam 契约）。
- **锁**：Enrollment FU → Attempt FU（顺序固定，防 A/A 死锁与 enrollment 计数竞态）。
- **拆分反例**：去掉 Enrollment FU → 并发 finalize（写 enrollment final facts）与 start（读 attemptCount/finalPassed 决策 retake）交错 → #324 描述的 pass/fail oracle 泄漏；去掉 Attempt FU → save/submit/scanner 三方 RMW 竞态（0/100 摆动，orchestrator 注释明示）。
- **结论**：必需，双机制相同。

### 3. Exam Deadline Authority

- **原子性**：**决策与后续冻结必须同一事务**（决策本身是纯读，但其输出的消费——冻结或放行——必须与决策读到的权威值绑定提交）。
- **依赖**：`closeAt`（唯一与并发相关的字段）+ attempt.deadlineAt + now。
- **锁**：Exam FU（A）/ FS（B）——**这是 Exam 行在提交链路中的唯一必需互斥点**。
- **拆分反例**：决策与冻结拆成两个事务 → 中间窗口内 extendExam 提交 → 冻结以旧权威落库（#558 修复前的 durable stale freeze，审计实测存在该交错）。锁下读后继续持锁至提交是 PG 唯一能提供的绑定方式。
- **事务外提前**：不可（stale read 即 #558 缺陷本体）。
- **持有期是否可缩短**：PG 无早释放；见 §3。

### 4. Submit Freeze（状态翻转 + submitted_answers）

- **原子性**：冻结 UPDATE 必须与 (a) 决策（段 3）、(b) workset 物化（段 6）、(c) audit（段 10）同事务。
- **依赖**：锁下的 draft answers（Attempt FU 保证读改写窗口封闭）；冻结快照是评分的唯一事实源（ADR-008）。
- **锁**：Attempt FU（已由 seam 持有，重入 no-op）。
- **拆分反例**：冻结独立提交 → 崩溃留下"submitted 无 workset"或"freeze 后 save 仍被接受"的窗口；`submitted` 中间态只在未提交事务内存在的性质（R0 §2 表）被破坏。
- **与锁模式的关系**：**不依赖 Exam 锁**——冻结只需 Attempt 锁。Exam 锁在此段的存在是"与决策同事务"的传递结果，不是冻结自身需求。

### 5. Submitted Answers Snapshot（buildSubmittedAnswersSnapshot）

- **纯计算**（引擎函数，无 IO）：可视为段 4 的一部分；无独立边界需求。可在事务内任意时刻执行，也可在拿到锁下 draft answers 后于事务外计算——但结果必须回到同事务提交，无收益。**事务外提前无意义**（输入是锁下状态）。

### 6. Grading Workset materialization

- **原子性**：与冻结同事务（"freeze barrier 是唯一 workset 创建权威"，预置条目 fail-closed）。
- **反例**：拆分 → 崩溃窗口留下部分条目或零条目的 submitted attempt，`aggregateGradingEntries` 终态前置被永久破坏（无自动修复路径，需数据修复工具）。
- **锁**：Workset 行 INSERT 隐式锁；唯一性由"同事务+Attempt 锁"保证，不依赖 Exam 锁。

### 7. Manual grading pending decision

- **原子性**：分类（requiresManualGrading）必须基于冻结快照、与冻结同事务持久化（gradingStatus 字段）。
- **反例**：分类晚于提交 → 题库/快照漂移可能改变分类输入；现状从冻结快照派生，SAFE_BY_FREEZE。
- **锁**：无额外（Attempt 已锁）。

### 8. Automatic grading / finalization

- **原子性需求**：与冻结同事务是**当前产品契约**（ADR-008 + orchestrator 注释：拆分将打开"并发 save 改变评分输入"或"submitted 未评分"窗口）。评分聚合读取的 exam 字段（passingScore/scoreStrategy）publish 后不可变 → **评分执行本身对 Exam 行无并发依赖**。
- **锁**：Attempt（已持）+ Enrollment 隐式写锁 + Workset 读。**不需要 Exam 锁**——需要的是"与冻结同事务"。
- **反例（移出事务）**：
  - 移出但保持同步（提交后立即第二事务）→ 崩溃窗口产生持久 `submitted` 行；retry 可幂等收敛（gradeAttemptIdempotent 已具备），但"无 submitted-not-graded 持久窗口"契约被放弃，且 candidate HTTP 语义从"终态一次成型"变为"两相"——**契约变更**。
  - 异步队列（#586 已裁决 ADOPT_POSTGRES_DURABLE_GRADING_JOB_QUEUE = NOT adopted）→ 同上且引入新基础设施（#668 非目标）。
- **结论**：在不改契约前提下必须留在当前事务；其"较长"不是 Exam 锁的内在需求，而是同事务原则的传递成本。

### 9. Result aggregation / Enrollment final facts

- **原子性**：attempt 终态与 enrollment finalScore/finalPassed/finalAttemptId/status 必须**同一事务**（#324：start 的 retake 决策在同一 Enrollment 锁边界读取它们；拆分 → oracle 泄漏）。
- **锁**：Enrollment 已由 seam 持有；UPDATE 隐式锁。不依赖 Exam 锁。

### 10. Atomic Audit

- **原子性**：与业务同事务（auditAtomicity 契约）；业务回滚则 audit 回滚。
- **锁**：Audit 行 INSERT。不依赖 Exam 锁。

### 11. Commit / response projection

- 投影已在事务外（普通读提交后状态）；无边界需求。

## 2. 必须保护的对立关系核验

| 关系 | 保护机制 | 是否依赖 Exam 锁 |
| --- | --- | --- |
| saveAnswer vs submit | Attempt FU + 冻结后 `ATTEMPT_ALREADY_SUBMITTED` 协议拒绝 | 否 |
| submit vs deadline scanner | 同 Attempt：Attempt FU；异 Attempt 同 exam：仅 A 下 Exam 锁互斥（B 下 S 保持 FU 仍互斥）；deadline 幂等屏障 | 仅跨 attempt 的排队效果 |
| submit vs forceSubmit | Attempt FU + receipt 幂等（forceSubmit 不取 Exam 锁——现状即与 Exam 锁无关） | 否 |
| submit vs extendExam | Exam 锁（A/B 同）+ 40001 重试 | **是（核心）** |
| submit vs manual grading | gradingStatus 分类 + finalizeGrading pending_manual fail-closed + gradeQuestion 单收敛点 | 否 |
| submit vs crash recovery | 单事务原子提交；submitted 持久态即 crash-recovery 入口（幂等） | 否 |
| submit vs retry | 40001/40P01 整 callback 重放 + 幂等守卫（graded→grade 拒绝、already-submitted 返回） | 模式无关 |

## 3. "缩短 Exam 锁持有时间"的结构可能性

1. **单事务内早释放**：PG 不支持（R0 §3）。任何"锁后只保留决策、释放后评分"的方案在 PG 中不存在。
2. **机制替换（不缩短持有，缩短他人等待）**：FOR SHARE 把同 exam 其他 candidate 的等待消除（R1）；W/S/O 等待不变。这是不改契约下唯一被证明正确的并行化手段。
3. **拆分事务**：按 §1 段 8/9 的反例，任何把 决策+冻结 或 冻结+评分+终态 拆开的方案都破坏一个已接受的不变量：
   - 拆"决策|冻结"→ stale freeze 复活（#558 本体）；
   - 拆"冻结|评分"→ submitted-not-graded 持久窗口 + save 输入竞态复活（ADR-008 本体）；
   - 拆"评分|enrollment 终态"→ #324 oracle 泄漏复活。
4. **不可早算的纯计算**：检查提交事务体——buildSubmittedAnswersSnapshot、aggregateGradingEntries、gradeAnswers 都是毫秒级纯函数，输入全部是锁下/冻结状态；`readGradingSnapshot` 的三次普通读已在 RR 快照上。**不存在"移出去就更快"的实质计算负载**（对比 #666：txHold p99 443ms @S200 pool=10，主体是锁等待排队而非 CPU 计算——93.8% 等待是 exams tuple wait，即"等待别人持锁"，换共享锁正中要害）。

## 4. 裁决

```text
TRANSACTION_BOUNDARY = TRANSACTION_BOUNDARY_MINIMAL
```

理由：在不改写已接受的 #558（决策↔冻结同事务）、ADR-008（冻结↔评分同事务）、#324（评分↔enrollment 终态同事务）三个契约的前提下，TX-SUBMIT 的责任段集合中每一段都必须留在当前事务内；Exam 锁的唯一必需职责是段 3 的决策序列化，其在评分段的持续持有是"同事务原则 + PG 无早释放"的传递结果，而非独立需求。因此：

- Mechanism C（第三种边界方案）**NOT_JUSTIFIED**：不存在既不改契约又能进一步缩短临界区的结构选项（§3.3 的每个拆分都命中一个被否决的反例；异步评分已被 #586 显式 NOT adopted）。
- 并行化收益的全部空间在**锁模式**（R1/R3/R4），不在**事务边界**。
- 若 Owner 愿意重新开放"submitted-not-graded 持久窗口 + 异步评分"契约，那是独立的产品决策（#586 边界：需独立 issue+授权），不属于 #668。
