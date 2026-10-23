# R5 — EXAM-668 最终研究报告：Candidate Take/Save/Submit/Deadline Reconciliation 的最小事务串行化关系

状态：COMPLETE（研究，未实施）。基线 master `158dc38d`。本文是 Issue #668 研究任务的统一裁决报告；全部证据可按 `rig/README.md` 重放。

## 0. 裁决块

```text
BEGIN_EXAM_668_RESEARCH_VERDICT
BASE_SHA=158dc38d
RESEARCH_STATUS=COMPLETE
CURRENT_AUTHORITY=FOR_UPDATE
MIN_SERIALIZATION=R_VS_W_MUTUAL_EXCLUSION_ON_EXAM_ROW_ONLY
READER_READER_REQUIRED=NO
READER_WRITER_REQUIRED=YES
LOCK_ORDER=ENROLLMENT_TO_ATTEMPT_TO_EXAM_UNCHANGED
SHARE_UPGRADE_RISK=NONE_IN_CURRENT_CODE
TRANSACTION_BOUNDARY=TRANSACTION_BOUNDARY_MINIMAL
CORRECTNESS_EQUIVALENCE=PROVEN
PERFORMANCE_VALUE=INCONCLUSIVE
FINAL_DISPOSITION=DEFER_WITH_SPECIFIC_MISSING_EVIDENCE
PRODUCTION_CHANGE=NONE
POOL_CHANGE=NONE
PR_CREATED=NO
COMMIT_PUSH=NONE
OWNER_DECISION_REQUIRED=YES
END_EXAM_668_RESEARCH_VERDICT
```

## 1. 一句话结论

**Candidate reader（take/save/submit 的 deadline 决策）之间在 Exam 行上的互斥，是现行机制选择额外引入的成本，不是 #558 正确性义务；FOR SHARE 以两处 seam 读点的锁模式变更即可在完全保留全部 C/W 义务的前提下消除这份互斥（等价性已证明并经三臂确定性实验验证），但其产品级收益在允许的证据环境上无法正式测量 —— 因此正确裁决是 DEFER（附具体缺失证据清单），而不是替换，也不是无条件保留。**

## 2. 七个问题的回答

| # | 问题 | 裁决 | 证据 |
| --- | --- | --- | --- |
| Q1 | Candidate Readers 是否需要互斥 | **不需要**。C 类写集两两不相交（各自 attempt/enrollment 行；exam 行只读单拷贝），互斥是机制选择引入的成本 | R1-C 证明 + R3 记录 1（share 臂 reader/reader 并行被直接见证，结果仍逐点正确） |
| Q2 | Reader ↔ Exam Authority Writer 是否需要互斥 | **需要，且这是唯一必要的 Exam 行冲突关系**。#558 INV-A/B/C 全部依赖它 | R1 证明 + R3 none 臂负控制（无锁时陈旧冻结真实发生，仅被偶然的 FK-RI 40001 救回） |
| Q3 | FOR SHARE 能否构造所需冲突关系 | **能**。FOR SHARE 与 W 的冲突语义（FOR UPDATE / FOR NO KEY UPDATE）和 FOR UPDATE 自身作为 writer 时完全一致（PG 18 Table 13.3）；对 R/R 则兼容 | R1-A/B + R3 share 臂 8/8 + T8 SQL 见证 |
| Q4 | FOR SHARE 的升级/隐藏死锁/非法快照风险 | **现码风险为零，边界已刻画**：无任何同事务"持 share 后 UPDATE exams"路径（审计核实的 9 处 exams UPDATE 全部带 FOR UPDATE 前缀或属无 reader 相交的 publish 例外）；RR 40001 语义与模式无关；T8 实证 shared-holder 升级竞态 = 40P01，而现码不存在该形态 | R1-D + 审计报告 §2 + T8 |
| Q5 | Submit 事务是否持锁过久 / 什么必须留在原子事务内 | **TRANSACTION_BOUNDARY_MINIMAL：现有边界即最小**。决策↔冻结（#558）、冻结↔评分（ADR-008）、评分↔enrollment 投影（#324）被受纳契约绑定为单事务；PG 行锁持有到 COMMIT，无早释放机制；异步评分已被 #586 明确否决。持锁窗内全部写在 attempt/enrollment/workset/audit/answer_receipts 上，无 exams 写 | R2 + R0-transaction-boundaries |
| Q6 | PR #667 的收益可否在当前代码复现 | **机制已复现，数量 INCONCLUSIVE**。同 rig 下：update 臂 submit 突发 exams 行锁等待均值 7.5–8.3/10 连接（#586 形态复现），share 臂恒为 0；S=200 makespan 方向性比 2.9×，与 #667 的 2.6–2.8×（Fedora）同级。但 A/A 方差门槛失败（p99 相对差 82% > 25%），按预注册协议本轮不产生延迟结论 | R4-ab-results + R4-causal-analysis |
| Q7 | 替换机制是否比 FOR UPDATE 更可维护 | **不是简单的"更可维护"**。变更面极小（seam 两处读点的锁模式 + repository 一个新方法），语义由 PG 冲突表背书；但引入一个新不变量："deadline reader 决不允许对 exams 获得写锁"（升级 = 40P01 暴露面），该不变量目前只能靠约定与测试守护，类型系统不可表达。这正是需要 Owner 权衡的点，不是研究可以单方面宣布的 | R1-D + R1 线性化证明 §工程守则 |

## 3. 最小串行化关系（契约表述）

Candidate Take/Save/Submit/Deadline Reconciliation 的正确性仅要求：

1. **R 类 ↔ W 互斥**（exams 行）：deadline 决策的读-判-写序列与任何 exams 行写者（extend/close/…）互斥 —— FOR SHARE 与 FOR UPDATE 对此等价；
2. **R 类相互独立**：无任何 exams 行冲突需求；attempt 归属冲突由 EA 锁族（Enrollment→Attempt）解决；
3. **A 类（forceSubmit/misconduct/gradeQuestion/heartbeat）本就不读 Exam 权威行**，与锁模式无关；
4. **跨 exam 天然独立**。

现行 FOR UPDATE 机制用一把"写型锁"同时实现了 (1) 和（不必要的）(2)。FOR SHARE 是在同一 seam 上只实现 (1) 的最小变更。

## 4. 证据清单

| 文档/装置 | 内容 |
| --- | --- |
| `R0-current-callgraph.md` / `R0-transaction-boundaries.md` | as-built 提交调用图（10 处 Exam FU 获取点表）、13 类事务边界 |
| `R1-lock-conflict-matrix.md` / `R1-linearization-proof.md` / `R1-lock-order-dag.md` | 冲突矩阵、INV-A..F 证明、无环锁序 |
| `R2-submit-critical-section.md` | 11 段职责分解与保护关系表 |
| `R3-correctness-evidence.md` / `R3-counterfactual-ledger.md` | 三臂结果矩阵（update 8/8，share 8/8，none 6/8 恰红在 writer-first 义务探针）+ 六条反事实记录 |
| `R4-protocol.md` / `R4-ab-results.md` / `R4-causal-analysis.md` | 预注册协议（A/A 门槛失败如实记录）、锁级机制见证、因果对照 |
| `rig/` | 补丁 + T1–T8 探针 + 突发实验 + 6 份原始结果 + RI-CONTEXT 日志证据 + 重放 README |
| 独立审计 | 7 项核查 6 项 VERIFIED；5 处发现（无出处数字、publish 无锁写遗漏、锁点归属笔误、乱码、计数）已全部修复并回写 R0/R1/R3/R4 |

关键反事实事实（none 臂，插桩 + PG 语句日志）：无锁时陈旧冻结**确实发生**（pass 1 终结写 `submitted_at`=陈旧 effectiveDeadline），结果被偶然的 FK-RI 锁读 40001 + 重试救回 —— 这正是 #558 注释禁止依赖的"偶然 FK/RI 行为"，使负控制比预期更有力。

## 5. Owner 决策项

1. **是否投入原生确认实验**（DEFER 的核心问题）：按 R4-protocol 在 Native Linux / 生产拓扑重跑三臂突发 + A/A 方差门槛。WSL 数字（含 2.9× 方向性比）不具正式证据地位，仅证明机制与排序。
2. **MATERIALITY 阈值批准**：R4-protocol §4.4 的 30%/一致性/噪声带判据是 PROPOSAL，需 Owner 批准后才成为替换决策的验收标准。
3. **若 GO，接受两处产品变更面**：`ExamRepository.findByIdForShare` 成为永久接口方法（contracts/domain 包签名变更）+ 移除 `EXAM_668_LOCK_MODE` 环境开关（替换完成后删除旧实现，无双轨）。
4. **不变量守护方案**（若 GO）："deadline reader 不得升级锁"需要 lint/arch 级或测试级守护，防未来回归出 40P01 暴露面。
5. **范围外 follow-up（审计发现）**：publish（draft→published）对 exams 的无锁 UPDATE 与惰性 reconcile 无互斥 —— as-built 既有弱点，与 #668 结论无关，建议另立 Issue。

## 6. 工作树与产物状态（未提交、未推送）

- Owner 工作树（`/home/hoo/Source/exam`）：**零 tracked 修改**；仅新增 untracked 目录 `docs/research/exam-668-min-serialization-1/`（本研究全部交付物）。
- 研究工作树（`/tmp/exam-668-research`）：detached HEAD `158dc38d` + 未提交 rig（4 文件补丁 + 2 探针文件）， Owner 可直接复用或 `git worktree remove --force /tmp/exam-668-research` 清理；rig 持久副本在交付目录 `rig/` 内，/tmp 丢失不影响重放。
- 未执行任何 commit / push / PR / merge；未触碰生产分支；数据库操作全部在 `APP_MODE=test` 自建测试库（docs/standards/testing.md §2），实验后已还原语句日志设置。

## 7. 裁决逻辑

- RECOMMEND_OWNER_GO 要求 CORRECTNESS_EQUIVALENCE=PROVED **且** PERFORMANCE_VALUE=MATERIAL。前者成立，后者在允许证据环境下不可判定 → 不 GO。
- KEEP_FOR_UPDATE 要求替换机制无可证收益或等价性存疑。两者都不成立（机制收益在锁级被开关式确认；等价性 8/8）→ 不适用。
- 因此 **DEFER_WITH_SPECIFIC_MISSING_EVIDENCE**：缺失的是 §5.1/§5.2 两项，且已有可重放装置把补证成本降到一次原生实验。
