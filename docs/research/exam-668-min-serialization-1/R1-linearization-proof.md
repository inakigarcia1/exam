# R1 — Linearization Proof：候选机制 A/B 的正确性等价论证

基线 `master = 158dc38d`。裁决对象：Mechanism A（Candidate Exam Read = FOR UPDATE，canonical）与 Mechanism B（Candidate deadline-decision Exam Read = FOR SHARE；Exam Writer 及 S/O/restore 保持 FOR UPDATE）。

## 0. 待满足的 #558 契约（正确性义务）

1. INV-A：不存在以 stale `closeAt` 为权威的持久冻结/放行决策。
2. INV-B：writer-first 交错中，candidate 必须在产生任何冻结写之前 abort/retry，重试后按新权威决策。
3. INV-C：candidate-first 交错中，冲突的 Exam 写必须等 candidate 事务提交或回滚后才能完成。
4. INV-D：正确性来自显式设计的锁与事务边界，不依赖外键 RI 的偶然 `FOR KEY SHARE`/迟到 40001。
5. INV-E：锁序保持无环（Enrollment → Attempt → Exam，无反向边）。
6. INV-F：`executeInTransaction` 的整事务重试语义在两种机制下同样有效（重放可见新权威；`40001` 不被当作自动成功）。

## 1. PostgreSQL 语义前提（PG 18.4，官方文档 + R3 实测）

- P1（冲突表 13.3）：`FOR SHARE` 与 `FOR UPDATE`、`FOR NO KEY UPDATE` 互斥；`FOR SHARE` 与 `FOR SHARE` 兼容。非键列 UPDATE 取 `FOR NO KEY UPDATE`（`exams` 的可变列 closeAt/status/resultsPublishedAt 均非唯一键列）。
- P2（RR 锁定读）：RR/SERIALIZABLE 事务对"自快照以来已被并发事务修改的行"执行锁定读（任一 FOR 模式）时抛 serialization_failure。
- P3（锁队列公平）：冲突请求按到达序排队；后到的兼容请求不越过已排队的冲突请求。
- P4（锁持有期）：行锁持有至 COMMIT/ROLLBACK；同一事务对已持行的同模式重入请求是 no-op。

## 2. 机制形式化

C 类事务（take/save/submit/restore）的动作序列：
`E→A→X?→decide→(freeze→grade)?→commit`，其中 `X?` 为 Exam 锁获取。
- A：`X? = LOCK_EXAM(exam, FOR_UPDATE)`
- B：`X? = LOCK_EXAM(exam, FOR_SHARE)`

W 事务：`X=LOCK_EXAM(exam, FOR_UPDATE); write(closeAt|status|…); commit`。

PostgreSQL 实现层面 `LOCK_EXAM(row, m)` 是"快照校验 + 行锁获取"的原子操作：行版本属于快照且无未提交写 → 授锁；行被快照后提交的事务改过 → 40001（P2）；行被未提交事务锁着且模式冲突 → 等待（P1/P3）。

## 3. 逐条证明

### R1-A（writer-first → INV-B）

场景：W 已提交 `closeAt` 变更；C 的快照在此之前建立（快照由 EA seam locator 读固定）；C 随后执行 `X?`。

- A：行 xmax 为 W 的已提交 xid > 快照 → 40001（P2）→ `executeInTransaction` 重放 → 新快照读到新 closeAt → INV-B。**#560 T2/T3 已在产品上证明。**
- B：`FOR SHARE` 同属锁定读，P2 不区分共享/排他模式 → 同样 40001 → 同样重放。机制路径与 A 完全同构，仅模式参数不同。
- "带旧权威提交"要求 `X?` 之后不再有任何对 Exam 行版本变化的检测点——不成立：`X?` 本身就是检测点，且它先于一切冻结写（`deadlineReconciliation.ts:211` 位于 `isAttemptDeadlineExpired` 与 `submitAttempt` 之前；引擎单元测试已钉住该顺序）。

### R1-B（candidate-first → INV-C）

场景：C 已通过 `X?` 持有 Exam 行锁；W 请求 FOR UPDATE。

- A：EXCLUSIVE vs EXCLUSIVE → W 等待至 C COMMIT/ROLLBACK。
- B：SHARED vs UPDATE → 冲突（P1）→ W 同样等待至 C 终结。
- 两者中 C 的决策/冻结/评分窗口都不受 W 干扰（W 的写不可见、不可并发提交），candidate-wins 线性化保持。差异仅在于：B 下另一个 C（不同 attempt）可同时进入——由 R1-C 证明无碍。

### R1-C（reader/reader）

见 `R1-lock-conflict-matrix.md` §3 证明。要点复述：C/C 写集交集为空，Exam 行对 C 只读单抄本，故 C/C 并行可串行化；互斥是机制选择引入的成本，不是正确性必需。

### R1-D（Shared Lock Upgrade）

问题：事务先持 `FOR SHARE` 再请求 `FOR UPDATE`（同事务同行）时的行为与生产路径是否存在该形态。

- 语义：同事务升级请求在 PG 中需等待**其他**持有者释放共享锁。若另一事务也持 FOR SHARE 并同时升级 → 两者互等 → 40P01（P3 + 冲突）。若它是唯一持有者 → 升级成功（no deadlock）。
- 生产路径穷举（当前 master + B 机制范围）：C 类事务在 `X?`（SHARE）之后访问 Exam 行的调用仅有 `readGradingSnapshot`→`examRepo.findById`（普通读）与 finalizeGrading 内普通读——**不存在同事务后续 FOR UPDATE 请求**。W/S/O/restore 事务保持 FOR UPDATE，从不先 SHARE。restore 是反方向：先 FOR UPDATE（restoreInterruption:228）后到达 SHARE 站点（reconciliation）——同事务已持更强锁，请求为 no-op（P4），非升级。
- 结论：**当前代码在 B 下不存在升级路径**；升级死锁是需要防御的未来形态（工程对策见 §5）。

### R1-E（FK/RI Non-Authority）

证明正确性不依赖 RI 偶然行为：

1. C 类事务对 attempt/enrollment 的写均为**非键列** UPDATE/INSERT 到子表——RI 触发器仅在引用键列变化或子行 INSERT/DELETE 时在**被引用行**上取 `FOR KEY SHARE`（attempt INSERT → exams 行 KEY SHARE）。C 类事务不 INSERT attempt（submit 不建 attempt），故其 Exam 轴互斥**完全**来自显式 `X?`。
2. `FOR KEY SHARE` 与 `FOR SHARE` 兼容且与 `FOR NO KEY UPDATE` 冲突（P1）——即便某路径意外触发 RI 检查，它与 W 的冲突也只提供"迟到 40001"这种顺序依赖的偶然 abort（#558 审计判定该形态非 authority）。B 机制下 `X?` 先于一切冻结写，检测点在设计位置而非碰巧位置。
3. 验证义务：R3 探针以"显式锁被移除即失败"的反事实（none 模式）证明锁是必要条件；以 40001 观测点位于 `X?`（passCount 重入 + 冻结未发生）证明充分条件在设计锁上成立。

### R1-F（重试语义）

`executeInTransaction` 对 40001/40P01 的整 callback 重放不含任何锁模式假设：重放重建 repo、重入 seam、重取锁。B 只改变锁模式参数，不触碰重试器。重放有效性依赖"重入后读到新权威"= P2 在重试事务新快照下不再触发 → 两机制相同。R3 探针以"整个 callback 重放（passCount≥2）且观测到更新后 closeAt"为判据，不把 40001 本身当成功。

## 4. 等价性定理

**定理**：在 (a) #667 机制范围（仅 C 类 deadline 决策读换 FOR SHARE），(b) RR 隔离，(c) 当前代码调用图下，Mechanism B 与 Mechanism A 满足相同的 #558 契约实例（INV-A…F），且 B 严格允许 A 所禁止的 C/C 并行（该并行已证明可串行化）。

证明 = §3 各条 + R1-C 命题。∎

## 5. 工程护栏（等价性成立的长期条件）

等价性依赖三个"不变式维持"义务，缺一不可：

1. **站点分类不变式**：`exams` 行的锁模式按调用方类别二分——R 类读者（deadline 决策）= SHARE，W 类写者 + S/O = UPDATE。任何新增 Exam 访问点必须归入其一。
2. **无同事务升级**：持 SHARE 的事务在同事务内不得请求该行 FOR UPDATE（今日为真；需要结构性守卫防回归）。
3. **锁序不变**：Enrollment → Attempt → Exam 方向不因模式改变（模式不是锁序的一部分）。

对应可执行护栏：#667 形态的结构 pin 测试（正则钉住 `findByIdForShare` 于两个站点 + 禁止回退 plain read）+ R3 的升级死锁检测探针作为失败模式见证。

## 6.残余风险登记（进入 R5）

| 风险 | 等级 | 说明 |
| --- | --- | --- |
| 未来代码在 C 类事务内写 Exam 行 | P2 | 命题失效条件明确（写集交集非空），触发即需重审计 |
| S/O/restore 范围不对称造成的吞吐反直觉 | P3 | 正确性无碍；扫描 tick 形成短暂 writer barrier，方向待测 |
| 双锁模式维护成本 | P2 | 长期认知成本真实存在（AGENTS.md §3）；护栏可执行化后可控 |
| 结构 pin 对重构形态敏感 | P3 | 正则护栏可能需随重构更新（#667 已演示形态） |
