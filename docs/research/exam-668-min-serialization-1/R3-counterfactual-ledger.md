# R3 — 反事实台账（EXAM #668）

状态：COMPLETE。本文档是"如果没有设计的锁会发生什么"的完整台账：每条反事实记录对照组（canonical）与实验组（counterfactual）的可观察差异，以及该差异由哪条义务（#558 INV-A..F）承载。

## 记录 1 — C/C 互斥是机制选择引入的成本，不是正确性义务

- **canonical**（update）：T1 中第二个 candidate 的 submit 在第一个 candidate 的 Exam FOR UPDATE 上排队（`pg_blocking_pids` 见证），直到持有者提交。
- **counterfactual**（share）：第二个 reader 在第一个 reader park 期间完整提交并评分（`{"note":"second reader completed while first reader parked"}`，最终状态 `graded`）。
- **正确性后果**：无。两次提交写不同的 attempt/enrollment 行，exam 行在 C 路径是只读单拷贝；线性化点各自独立成立（R1-C 证明）。
- **承载义务**：无 —— 这条互斥是现行机制选择额外引入的成本。**这是全研究的核心事实。**

## 记录 2 — C/W 互斥是正确性义务，锁模式不改变其强度

- **canonical**（update）：T2/T3 中，陈旧 pass 在 seam 的锁读上 40001 中止 → 整事务重试 → 落在新权威（passCount≥2，attempt 保持 `in_progress`）；T4 中 writer（operator extend）在 candidate 锁后排队。
- **counterfactual**（share）：行为逐点相同（40001 中止、重试、writer 排队）。FOR SHARE 与 writer 的 FOR UPDATE/FOR NO KEY UPDATE 冲突关系和 FOR UPDATE 自己作为 writer 时的冲突关系完全一致（PG 18 Table 13.3）。
- **承载义务**：INV-A（决策-扩展序）、INV-B（决策-冻结原子性）、INV-C（writer-first 线性化）。

## 记录 3 — 无锁时陈旧冻结真实发生，但被偶然机制救回（负控制的关键细节）

- **counterfactual**（none）：T3 pass 1 的终结写**确实**用陈旧权威落了语句（`submitted_at` = 陈旧 effectiveDeadline，`submission_reason='deadline'`），但同事务随后的评分写触发 FK RI 内部锁读（`SELECT 1 FROM exams ... FOR KEY SHARE`），命中快照后已变更的 exams 行 → 40001 → 整事务回滚重试 → 正确结果。T2 同机制。
- **canonical**：同样的调度下，40001 在**设计的锁读**上发生（seam 处，冻结写之前）—— 第一道也是唯一一道防线，位置由契约指定。
- **含义**：none 模式"看起来也对"完全依赖 (a) 冻结路径恰好写 exams 的子表行、(b) RI 触发器恰好在该写上执行锁读、(c) 重试预算未耗尽。三者无一属于产品契约；`deadlineReconciliation.ts` 的 558 注释明确禁止依赖这种偶然行为。
- **证据**：`rig/evidence-none-arm-T3-40001-context.log`（PostgreSQL 语句日志 + ERROR CONTEXT）。

## 记录 4 — candidate-first 义务在 reader 持 SHARE 锁时依然成立

- **canonical**（update）：candidate 持 Exam 锁 park，operator extend 排队，release 后 extend 才提交。
- **counterfactual**（share）：逐点相同（T4 全绿）—— FOR UPDATE writer 与 FOR SHARE holder 冲突，队列公平性保证 writer 等待而非抢跑。
- **承载义务**：INV-C（candidate-wins 线性化：candidate 先到先得）。

## 记录 5 — 不同 exam 永不互相阻塞（轴正确性）

- 三臂 T7 全绿：exam 1 上 park 的 candidate 从不阻塞 exam 2 上的 submit。行级锁的天然性质，任何模式都不引入跨 exam 耦合。

## 记录 6 — SQL 层见证（与模式无关的机制事实）

T8（原始 SQL，两条专用连接）：

1. 同一行两个 FOR SHARE（不同事务）成功共存 —— PG 18.4 Table 13.3 的 share/share 兼容性直接见证；
2. 两个已持 FOR SHARE 的事务并发升级为 FOR UPDATE —— 恰好一方获得、另一方 40P01 deadlock（shared-holder 升级竞态）。**含义**：share 模式的安全性边界 = 现码不存在同事务持 share 后升级的路径（R1-D；独立审计核实的清单：examRepo 的 exams SQL 站点 13 处 = 9 显式 + baseRepo 泛型 CRUD 4，exams FOR UPDATE 生产调用点 9 处，exams UPDATE 调用点 9 处 —— 全部经 `executeAdminExamTransition`/`examTransitionExecutor.ts:63` 的 FOR UPDATE 前缀或 `checkAndUpdateExamStatus` 的 FOR UPDATE 事务到达；唯一例外是 draft 态 publish 的无锁 UPDATE exams，见 R1 矩阵审计补记，无 share 前缀、无 deadline reader，不构成升级路径）。

## 台账汇总

| 义务/成本 | update | share | none |
| --- | --- | --- | --- |
| C/C 不互斥（性能收益面） | ✗ 互斥 | ✓ 并行 | ✓ 并行 |
| C/W 互斥（正确性义务） | ✓ | ✓ | ✗ 偶然救回 |
| writer 排队于 reader（candidate-wins） | ✓ | ✓ | ✗ |
| 冻结最新已接受草稿（INV-D） | ✓ | ✓ | ✓（与锁无关，EA 锁族保证） |
| 跨 exam 独立 | ✓ | ✓ | ✓ |
| 升级死锁暴露面 | n/a | 无同事务升级路径（R1-D） | n/a |

结论指向：**最小必要串行化关系 = C/W 互斥（保持）+ C/C 不互斥（现行机制额外支付的成本）**。FOR SHARE 是在单一机制内同时表达这两条关系的最小变更（仅 seam 两处读点换模式）。
