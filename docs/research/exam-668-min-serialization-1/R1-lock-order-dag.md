# R1 — Lock-Order DAG：exam 相关事务锁序全图与环检测

基线 `master = 158dc38d`。节点为**行族**（同一行标识的所有行）：`Exam`、`Enrollment`、`Attempt`、`Episode`（interruption 父行）、`Workset`、`Adjustment`、`Audit`、`Receipt`、`Admission`。边为"事务内行锁获取顺序"（含隐式写锁）。`FU`=FOR UPDATE，`FS`=FOR SHARE，`W`=隐式写锁，`r`=普通读（无行锁）。

## 1. 各事务锁序（as-built）

```text
TX-SUBMIT / TX-TAKE / TX-SAVE（C 类）:
  Attempt(r: locator) → Enrollment FU → Attempt FU → Exam FU|FS → Attempt r|FU
    → [Episode FU → Episode W: events]（disrupted 时）
    → Attempt W(freeze) → Workset W → Attempt r → Workset r → Attempt W(graded) → Enrollment W → Audit W

TX-RESTORE（C 类）:
  Attempt FU → Exam FU → Episode FU → Adjustment r/W → Exam(重入 no-op) → Attempt W → events W → Enrollment(评分时 W)

TX-SCAN（S）:
  Attempt(r: discovery 无锁) → [每 attempt 独立事务] Attempt(r: locator) → Enrollment FU → Attempt FU → Exam FU
    → Attempt W(freeze) → Workset W → Attempt W(graded) → Enrollment W

TX-GRANT（O）:
  Attempt(r: locator) → Enrollment FU → Attempt FU → Exam FU → Incident r → Adjustment W → Attempt W(deadlineAt) → events W

TX-FORCE（A）:
  Attempt(r: locator) → Enrollment FU → Attempt FU → Receipt W → Attempt W(freeze) → Workset W → Attempt W(graded) → Enrollment W
  （无 Exam 节点）

TX-GQ（manual grading，A）:
  Attempt(r 预检, 事务外) + Exam r(事务外) → Enrollment FU → Attempt FU → Workset W → Attempt W(graded) → Enrollment W
  （无 Exam 节点）

TX-HEARTBEAT: Attempt W（原子 CAS，单行）

TX-MARKDISRUPTED（S 的 disrupt 半部）: Attempt FU → Episode W → events W → Attempt W（attempt-only，R12）

TX-RECON（reconcileExamForRead，W）: Exam FU → [迁移时 Exam W]

TX-ADMIN（W）: Exam FU → Exam W(reconcile/命令) → [Attempt r: countUnresolved 非 locking] → Audit W

TX-PUBRES（W）: Exam FU → Exam W

TX-START（RC）: Exam r(事务外 reconcile 独立短事务: Exam FU→Exam W?) → Attempt(r locator) → Enrollment FU
    → Attempt r → Admission r/W → Attempt W(create) → Enrollment W
    （restore 分支改走 TX-RESTORE 锁序）
```

## 2. DAG 与环检测

取所有边的方向并集（含 A 机制与 B 机制——B 仅把 C 类的 `Exam FU` 边替换为 `Exam FS`，**不产生新边也不改变方向**）：

```text
Enrollment → Attempt → Exam
Attempt → Episode → events
Attempt → Workset
Attempt → Adjustment
Attempt/Episode/Adjustment/Enrollment/Exam → Audit（各事务内 audit 最后）
Enrollment → Admission（仅 TX-START）
Attempt → Receipt（TX-FORCE）
```

关键的"反向边"排查（可能成环的 Exam→Attempt / Exam→Enrollment 路径）：

- TX-ADMIN 在持 Exam 锁后对 attempts 只做 `countUnresolvedByExam` **普通读**（exam.ts:1666）——普通读不取行锁，无边。
- TX-RECON / TX-PUBRES 只触 Exam 行。
- TX-GQ 的 Exam 读在**事务外**预读（gradingQueue.ts:341）——不在事务内，无边。
- TX-SCAN/TX-GRANT/TX-RESTORE 的 Exam 获取都在 Enrollment→Attempt 之后（scanner 注释明示 "NOT promoted to a global invariant" 的 audited 顺序）。
- RI 边（INSERT attempt → Exam FOR KEY SHARE）：发生在 TX-START 的 `Attempt W(create)` 处 → 形成候选路径 `Enrollment → Attempt → Exam(KEY SHARE)`——与全局方向**一致**（Exam 最后），无环。

**环检测结论：CYCLE_FOUND = NO**（与 #558 审计结论一致，B 机制下亦然：模式替换不改变 DAG 拓扑）。

## 3. 等待关系示例（非环）

W(admin extend) 持 Exam；C(submit) 持 Enrollment+Attempt 等 Exam：W 的后续需求集 = {Exam W, Audit W}，不含 C 持有的 Enrollment/Attempt → 无环，C 等 W 提交（writer-first）或 W 等 C（candidate-first），单向阻塞。

S 扫描同 exam 多 attempt：S 事务之间无共享行（各自 attempt），但都取同一 Exam FU → S 自身逐事务串行；B 下不变（S 保持 FU）。

## 4. B 机制下的新等待形态（预测，供 R3 验证）

- C∥C（异 attempt，同 exam）：A 下串行 → B 下并行。pg_blocking_pids 应为空。
- C(持 FS, grading 中) vs 第二个 C：并行（新收益）。
- C(持 FS) vs W/S/O：互斥不变（等待方向与 A 相同）。
- 混合队列：FS 请求排在已排队的 FU 请求之后（P3 公平性）——可观测为"S tick 期间 C 偶发排队"，正确性无碍。
