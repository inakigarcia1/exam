# Test Evidence Adequacy — #719 研究收束报告

```ini
STUDY = EXAM_719_TEST_EVIDENCE_ADEQUACY_CLOSEOUT
MODE = EVIDENCE_RECONCILIATION_AND_INDEPENDENT_REVIEW
BASE_SHA = f8c7ae031eb4b2de3073bf6ca087c6f02d89aebf (origin/master, 2026-10-14)
ISSUE_719_STATE_AT_CLOSEOUT = OPEN
DOC_STATUS = RESEARCH SYNTHESIS — 非新强制性测试标准、非测试元数据 Schema、非产品语义权威
```

本文档是对 [jnhu76/exam#719](https://github.com/jnhu76/exam/issues/719)（Test Evidence
Adequacy 研究）的收束性研究综合。它回答一个问题：

> Exam 已完成的测试治理实践（#706 owner-layer 收敛、#718 PostgreSQL proof-integrity
> 审计、#721/#722 两次修复战役），是否足以支持一套明确、可反证、低维护成本的
> Test Evidence Adequacy 方法论？

权威边界：本文件引用的所有测试规范权威仍是
[`docs/standards/testing.md`](../standards/testing.md)、
[`docs/standards/test-flakes.md`](../standards/test-flakes.md) 与
[`docs/standards/code-quality.md`](../standards/code-quality.md)；
本文件只综合研究结论与证据链，不新增运行时要求。

---

## 1. 研究问题与适用边界

#719 的核心问题不是"删多少测试"，而是"什么证据足以支持一个 behavioural /
correctness claim"。其工作定义（#719 §4）是一个**工程假设**，不是任何单篇论文
的直接结论：

> 一个值得长期保留的测试，应在相关边界和前提下，把 intended behaviour 与至少
> 一种 realistic incorrect system 区分开。

适用边界：

- 本报告的校准数据全部来自真实已执行的研究战役（#718/#721/#722）与其 as-built
  代码状态；不包含未执行的全仓审计声明。
- "audited scope" 是范围限定的：#718 裁定了 201 个 real-PG 文件，#722 审计了
  9 个证据域的 material 表面。这些是**已审计范围内的结论**，不外推为"9 个领域
  所有可能行为已完整验证"。
- 所有文献结论按其自身证据强度引用；论文的统计相关性不扩大为普遍因果律。

---

## 2. 文献证据图（D1）

#719 列出的八篇代表性研究已于 2026-10-14 全部经一手来源核验
（5 篇经 Semantic Scholar 元数据 API、1 篇经 Springer 出版方页面，
2 篇经 arXiv 摘要页一手抓取）。题名、作者、年份、venue 与 DOI 与 #719 的
引用一致。

| # | 文献 | 证据类别 | 核验状态 |
| --- | --- | --- | --- |
| 1 | Barr, Harman, McMinn, Shahbaz, Yoo — *The Oracle Problem in Software Testing: A Survey*, IEEE TSE 41(5), 2015, DOI 10.1109/TSE.2014.2372785 | PEER_REVIEWED_EMPIRICAL_EVIDENCE（survey） | 元数据一手核验；FULL_TEXT_NOT_VERIFIED（本轮） |
| 2 | Inozemtseva & Holmes — *Coverage Is Not Strongly Correlated with Test Suite Effectiveness*, ICSE 2014, DOI 10.1145/2568225.2568271 | PEER_REVIEWED_EMPIRICAL_EVIDENCE | 元数据一手核验；FULL_TEXT_NOT_VERIFIED |
| 3 | Just, Jalali, Inozemtseva, Ernst, Holmes, Fraser — *Are Mutants a Valid Substitute for Real Faults in Software Testing?*, FSE 2014, DOI 10.1145/2635868.2635929 | PEER_REVIEWED_EMPIRICAL_EVIDENCE | 元数据一手核验；FULL_TEXT_NOT_VERIFIED |
| 4 | Petrović, Ivanković, Fraser, Just — *Practical Mutation Testing at Scale: A View from Google*, arXiv:2102.11378 (2021) | INDUSTRIAL_EVIDENCE | arXiv 一手核验（含摘要）；#719 所记 IEEE TSE 期刊版本轮次本轮未一手核验 |
| 5 | Paul & Holmes — *Beyond Coverage and Kill Scores: Empirically Measuring Test Suite Behavioural Gaps*, arXiv:2606.10417 (2026-06) | RECENT_PREPRINT | arXiv 一手核验（含摘要）；按 #719 non-goals 不作为正式标准 |
| 6 | Rothermel, Harrold, von Ronne, Hong — *Empirical Studies of Test-Suite Reduction*, STVR 12(4), 2002, DOI 10.1002/stvr.256 | PEER_REVIEWED_EMPIRICAL_EVIDENCE | 元数据一手核验；FULL_TEXT_NOT_VERIFIED |
| 7 | Panichella, Panichella, Fraser, Sawant, Hellendoorn — *Test Smells 20 Years Later: Detectability, Validity, and Reliability*, EMSE 27:170, 2022, DOI 10.1007/s10664-022-10207-5 | PEER_REVIEWED_EMPIRICAL_EVIDENCE | 一手核验（Springer 页面） |
| 8 | Freedman — *Testability of Software Components*, IEEE TSE 17(6), 1991, DOI 10.1109/32.87281 | PEER_REVIEWED_EMPIRICAL_EVIDENCE | 元数据一手核验 |

### 逐篇结论边界

| 文献 | CLAIM / 方法 | 支持的结论 | 局限（不得外推） | 对 Exam 的意义 | 需要修改 #719 吗 |
| --- | --- | --- | --- | --- | --- |
| Barr 2015 | 对 test oracle 问题的系统综述 | 执行输入不等于证明正确；oracle 决定"执行过"能否转化为"证明过" | 综述不给出可执行的 oracle 度量 | assertion 数量不是关键；oracle 必须能拒绝一个具体、合理的错误实现 | NO |
| Inozemtseva & Holmes 2014 | 控制套件规模后测 coverage 与 fault-detection 的相关（多开源项目，mutation 评分） | coverage 与 effectiveness 仅低-中相关；更强 coverage 形式无显著增益 | 相关≠因果；不证明 coverage 无价值——它仍指示 reachability/under-tested | coverage 可作 reachability 证据，不可作 correctness ownership，不可据其安全删测试 | NO |
| Just 2014 | 357 个真实缺陷、5 大型系统、developer/generate suites 的 mutant–real fault 相关性 | mutant detection 与 real-fault detection 统计显著相关（控制 coverage 后仍成立） | 只覆盖 mutation operator 可表达的 fault model；kill mutant ≠ 捕获一切真实故障 | mutation 是定向反事实探针，用于 disputed owner 的裁决 | NO |
| Petrović 2021 | Google 工业实践：只对 changed code 增量 mutation、过滤低价值 mutant、限额、按历史 operator 表现筛选 | 大规模工业可行的是 targeted/incremental mutation，不是全仓 mutation-score KPI | 单一公司实践；工具生态特定 | 与 Exam"targeted adjudication only"的定位一致 | NO |
| Paul & Holmes 2026 | 从文档/代码抽取 expected behaviours 并映射测试（10 个 Java 库、8,922 方法、20,729 行为、93.1% 精度） | ≥17.5% expected behaviours 无测试验证（behavioural gap）；多数 gap 在高行覆盖、过半在高 kill-score 的方法中 | preprint、Java 生态、抽取精度 93% 非全对；保守估计 | `implementation exercised != expected behaviour validated`——审计必须 behavior-first（contract → fault model → owner?），与 #722 实际采用的方向一致 | NO |
| Rothermel 2002 | test-suite reduction 对 fault-detection capability 影响的实证 | 某些 reduction 技术严重损害故障检测；`redundant coverage != redundant evidence` | 特定 reduction 技术与年代工具；不反对一切精简 | 删除测试前必须回答 deletion counterfactual（见 §3） | NO |
| Panichella 2022 | 重检 test-smell 词汇表与检测器的 detectability/validity/reliability | smell 检测器存在大量 FP/FN；smell 与真实测试问题错位 | 不否认 smell 的候选价值 | **Smell is a candidate generator, not a verdict**——不能由 smell 直接推出 DELETE | NO |
| Freedman 1991 | 组件 testability 的 controllability/observability 框架 | 可控性/可观察性决定目标状态/故障是否可被建立与观测 | 1991 年组件级框架，非并发/分布式语义 | concurrency/time/restart 测试需要 barrier/gate（可控）+ `pg_locks`/SQLSTATE/pid/durable state（可观察）；`Promise.all`、sleep、repeat 本身不构成控制或观察 | NO |

### D1 验收回答

**现有文献是否足以支持以 fault-model discrimination 而非 coverage/test count
作为测试证据充分性的主要判断方法？**

- 文献支持的部分：oracle 决定证据（Barr）；coverage 不是 effectiveness 的充分
  统计（Inozemtseva & Holmes）；mutation 与真实故障检测相关且是更强的反事实
  探针（Just）；工业实践支持 targeted mutation 而非全仓 KPI（Petrović）；
  reduction 不得只维持 coverage（Rothermel）；smell 只是候选生成器
  （Panichella）；可控/可观察性决定 claimed schedule 是否真的被测试（Freedman）。
- Exam 实践校准的部分：fault-model discrimination 的**具体分类学与两个反事实
  问题**是 Exam 自己的工程假设，其判别力由 #718/#721 的真实校准验证（§4），
  不是文献直接给出。
- 尚属工程假设的部分：八字段作为**审计思维框架**的完备性（允许 UNKNOWN，
  见 §3）；workflow 层面的效率比较（§6）。

八篇文献均**不需要修改 #719**；#719 的文献引用与外推边界经核验没有把相关性
写成普遍因果律。

---

## 3. 最小 Test Evidence Model（D2）

### 3.1 冻结的八字段（Research Model）

| 字段 | 必须回答的问题 |
| --- | --- |
| Contract | 需要保护的真实行为或不变量是什么？ |
| Fault Model | 哪一种合理错误实现会破坏它？ |
| Trigger | 测试是否真正建立暴露该错误所需的条件（可控性）？ |
| Oracle | 什么观测能区分正确与错误（可观察性）？ |
| Boundary | 为什么需要当前测试层和物理资源？ |
| Counterfactual | 故障注入、mutation 或受控调度能否让该测试失败？ |
| Owner | 该性质由哪个最低成本且充分的测试负责？ |
| Cost | 这份证据付出多少执行、fixture、flake 与维护成本？ |

### 3.2 两个反事实问题（模型的核心判断规则）

- **Q1 Deletion counterfactual**：删除这个测试，哪个真实错误失去可信的检测者？
  → 主要行使 `Owner` + `Cost`。
- **Q2 Fault counterfactual**：如果那个错误真的出现，这个测试会可靠变红吗？
  → 主要行使 `Trigger` + `Oracle` + `Counterfactual`。

### 3.3 层次约束（防 framework creep）

- **Research Model**：八字段是审计与争议裁决的思维框架，用于 campaign ledger
  与收束论证（#722 已按此模型执行，见 §5）。
- **Permanent Test Requirement**：**不**要求普通测试携带八个 metadata 字段、
  JSON DSL、per-test manifest、test registry、per-PR mutation 或全仓
  mutation-score gate。#719 §11 non-goals 明确排除；本收束维持该排除。
- 任何字段可为 `UNKNOWN` / `NOT_IDENTIFIABLE`；**单一字段缺失不自动推出
  DELETE**。DELETE 只在 Q1 无答案**且**该证据被更便宜且同强或更强的 owner
  支配时成立（与 #706 的 semantic-dominance 门一致）。

### 3.4 判别力检验结果

按 §4 的六个校准案例检验，八字段能区分五类情形：

| 情形 | 案例 | 模型如何区分 |
| --- | --- | --- |
| 应当保留的昂贵测试 | C4 / C5 | Boundary 字段给出具体的 `WHY_REAL_PG_REQUIRED`；Trigger/Oracle 有机器证明 |
| 应当修复的弱测试 | C2 | Oracle 字段失效（对声称的 mutant 无区分力）→ 修复 oracle，而非删除 |
| 只需重新界定 claim 的测试 | C3 | ACTUAL 与 CLAIMED 不一致但 ACTUAL 是真实 fault model 的有效 owner → RECLASSIFY |
| 被其他 owner 支配的测试 | C1 旧套件 / #722 replay 冗余 | Owner 字段显示支配关系（同 fault model、更便宜或同强 oracle）→ 收敛/删除 |
| 必须新增 owner 的真实缺口 | M1/M2、`disrupted:grade`、40P01 retry | Q1 有答案但全仓无 owner → MISSING_OWNER 与 DELETE 同等重要 |

**CALIBRATION_DISCRIMINATION = PASS（限定：校准集内判别力）**。模型在
本报告使用的六个校准案例上能区分上述五类情形。必须如实声明：这六个案例
既是校准集也是验证集，本收束**未主动寻找**模型无法干净裁决的对抗反例，
该 PASS 是同一研究谱系的自评；缓解因素是模型定义先于 #718 审计（#719 §9
本就要求事后验证），且 C1/C2 的判别锚定在已核验的 mutant SURVIVED/KILLED
等非循环证据上。判别力的对抗性检验由后续审计实践持续提供。模型无需为
通过校准而修改；仅冻结以下措辞：MISSING_OWNER 是模型的合法输出（与
DELETE 同等重要），不是模型失效。

---

## 4. #718/#721 PostgreSQL 校准（D3）

六个校准组。历史 SHA = `4dbf62e1bb00f4adb527ee1f62c8f6c457b57fd3`（#718 基线，
`BASE_DRIFT = NO`）；修复后 SHA = PR #721 merge
`e62d317e06819407a28d521ded818ccc62afbeda`；当前核验 HEAD =
`f8c7ae031eb4b2de3073bf6ca087c6f02d89aebf`。本收束对每个案例同时核验了
历史版本（`git show`）与当前 master 的 as-built 状态。

### C1 — False concurrency authority（`ea-lock-order.test.ts`）

```text
CASE_ID = C1
HISTORICAL_SOURCE_SHA = 4dbf62e1
CURRENT_SOURCE_SHA = f8c7ae03（文件已重写为 true-overlap owner）
CLAIMED_BEHAVIOUR = EA↔AE 锁序确定性争用回归、真实重叠下无 40P01、
  tx-bound repo 事务结束后再使用必失败
ACTUAL_SCHEDULE (历史) = T1 完整 COMMIT 后 T2 才开始（L266/L278 两个顺序
  await 事务）；deferred()/expectStillPending 定义但从未调用（死 helper）；
  100× 循环重复同一串行 schedule；终局 oracle `expect(true).toBe(true)`（L297）
FAULT_MODEL = 混合锁序（E→A vs A→E）在真实重叠下形成死锁环（40P01）
ORACLE_BEFORE = 无区分力：无重叠则 40P01 结构上不可能，锁序反转 mutant 存活
ORACLE_AFTER = 真实重叠 owner：双独立 max:1 池（互异 backend pid）、
  观察连接 `FOR UPDATE NOWAIT` 被 55P03 拒绝证明 A 持锁未持 A-attempt、
  `pg_locks` ungranted-lock 探针证明 B 阻塞、锁序反转 mutant 被真实 40P01 杀死
COUNTERFACTUAL_RESULT = 反转 mutant 历史套件 SURVIVED（证明 false authority）；
  新 owner 下 KILLED（PR #721 mutant ledger）
WHY_RESOURCE_REQUIRED = 两个独立物理会话必须争用同一行锁，阻塞本身是 oracle
CLASSIFICATION = FALSE_AUTHORITY（历史）→ VALID_OWNER（当前）
DISPOSITION = REPAIR_DETERMINISTIC_PROOF（已由 #721 完成）
EVIDENCE_GRADE = A（SHA 锚定源码 + 已执行 mutant 反事实）
```

### C2 — Weak oracle（`gradingConcurrency.test.ts` Case 3）

```text
CASE_ID = C2
HISTORICAL_SOURCE_SHA = 4dbf62e1；CURRENT = f8c7ae03（重写为 parked schedule）
CLAIMED_BEHAVIOUR = 等分时第二事务"看到 finalScore 已置位并放弃"（`>` 非 `>=`）
ACTUAL_SCHEDULE (历史) = 共享池上无控 `Promise.all`；无 barrier/阻塞观察
FAULT_MODEL = 等分 clobber（`>=` last-writer-wins 覆盖 finalAttemptId）
ORACLE_BEFORE = `expect([attemptHighId, attemptLowId]).toContain(finalAttemptId)`
  （L528）同时接受"拒绝"与"覆盖"两种结局——声称的 distinguishing oracle 不存在
ORACLE_AFTER = H/L/E 确定性 schedule：T1 park 在 seam Enrollment 锁后，
  T2 的阻塞与重算可观察；等分 `>=` mutant 被 KILLED（#721）
COUNTERFACTUAL_RESULT = Case 3 对 clobber mutant 必然放行（历史）；
  修复后定向 mutant KILLED
WHY_RESOURCE_REQUIRED = 两个事务对同一 enrollment 行的真实锁争用与提交次序
CLASSIFICATION = WEAK_ORACLE / claim 级 FALSE_AUTHORITY（历史）→ VALID_OWNER（当前）
DISPOSITION = 修复 oracle（fix oracle，非删除）
EVIDENCE_GRADE = A
```

### C3 — Overstated race claim（`deadline-scanner.test.ts` T7 及两个兄弟用例）

```text
CASE_ID = C3
HISTORICAL_SOURCE_SHA = 4dbf62e1；CURRENT = f8c7ae03（含 PROOF BOUNDARY 注释，L534）
CLAIMED_BEHAVIOUR = scanner 与 exam writer 的"linearization"/"race"
ACTUAL_SCHEDULE = writer 的竞争状态先 COMMIT，scanner 操作后才运行——
  从未重叠；实际证明的是 under-lock authoritative recheck（消灭
  "移除锁下 recheck" mutant 的有效 owner）
FAULT_MODEL = recheck 缺失时用过期的 discovery-time 谓词自动提交
ORACLE_BEFORE/AFTER = recheck oracle 本身真实有效；只有命名与声称过度
COUNTERFACTUAL_RESULT = "移除 recheck" mutant 会被杀死——owner 是真的
WHY_RESOURCE_REQUIRED = 重叠型 writer race 已由 barrier-backed
  candidate-deadline-authority / candidate-save-deadline-race 套件确定性拥有
CLASSIFICATION = FALSE_AUTHORITY（仅 label 级）+ 有效 recheck owner
DISPOSITION = RECLASSIFY（改名与注释，不新增更昂贵的并发测试）
EVIDENCE_GRADE = A
```

**C3 的方法论意义**：模型支持"降级声称而不是升级测试"的处置——当真实执行
建立的是一个较窄但有效的 fault model 时，正确动作是让 claim 诚实，而不是
强迫每个用例都变成昂贵的并发调度。

### C4 — Physical concurrency owner（正样本：`admin-force-submit.concurrency.test.ts`）

```text
CASE_ID = C4
HISTORICAL_SOURCE_SHA = 4dbf62e1；CURRENT = f8c7ae03
CLAIMED_BEHAVIOUR = 五个冻结 race 矩阵：真重叠、真实阻塞、40001 重试、
  真实 23505、失败原子性
ACTUAL_SCHEDULE = 双独立 max:1 池（互异 backend pid 断言）+ 第三观察连接；
  T1 在 receipt 插入后 park 于事务内；`pg_locks` ungranted-lock 探针机器证明
  T2 阻塞；≥2 次 primary 尝试且 txid 互异证明重试发生
FAULT_MODEL = 真实重叠下双重生效 / 缺重试 / receipt+audit 不完整
ORACLE = 终态 receipt 排序（applied/no_change）、audit 基数、actor 权威
COUNTERFACTUAL_RESULT = 锁移除 → 阻塞探针超时红；重试移除 → 尝试数=1 红
WHY_RESOURCE_REQUIRED = 独立会话争用行锁 + SQLSTATE 仲裁是 oracle 本身
CLASSIFICATION = VALID_OWNER（本收束试点中亦被独立复核，含两项归因精度
  残余：锁类型断言宽松、首尝试 SQLSTATE 未直接断言——不动摇 owner 地位）
DISPOSITION = KEEP
EVIDENCE_GRADE = A
```

### C5 — Atomicity/composition owner（正样本：`candidate-submit-rollback.test.ts`）

```text
CASE_ID = C5
HISTORICAL_SOURCE_SHA = 4dbf62e1；CURRENT = f8c7ae03
CLAIMED_BEHAVIOUR = submit+grade 的多事实族原子回滚与 residue-free 恢复
ACTUAL_SCHEDULE = 真实 HTTP 路由 → 生产事务内 audit 写 → BEFORE INSERT
  trigger 注入确定性失败（RAISE EXCEPTION）；故障发生在相关写入之后、
  COMMIT 之前
FAULT_MODEL = 部分提交（attempt/冻结答案/grading workset/enrollment 投影/audit
  不一致）
ORACLE = 回滚后各事实族持久状态 + 移除故障后同一操作重试成功
COUNTERFACTUAL_RESULT = 移除事务边界 → 多事实族残留 → 红
WHY_RESOURCE_REQUIRED = 多持久事实族必须经真实事务一起回滚/提交
CLASSIFICATION = VALID_OWNER（REAL_PG_COMPOSITION_OWNER）
DISPOSITION = KEEP
EVIDENCE_GRADE = A
```

### C6 — Missing owner（已发现并修复：`executeInTransaction` 40P01 retry 契约）

```text
CASE_ID = C6
HISTORICAL_SOURCE_SHA = e62d317（#722 前：仅注释声称，无任何测试 owner）
CURRENT_SOURCE_SHA = f8c7ae03（packages/db/src/transactionRetry.test.ts，#722 ed63966f）
CLAIMED_BEHAVIOUR = wrapper 把 40P01 视为瞬态并重试整个回调；非可重试错误传播
ACTUAL_SCHEDULE (修复前) = 无 owner（注释即全部证据）
FAULT_MODEL = 40P01 不再重试（瞬态死锁泄漏为 500）；23505 被误重试
ORACLE = 真实 40P01 死锁 schedule（victim 按队列次序被 blaming）→ attempts 计数；
  23505 负对照 → 不重试
COUNTERFACTUAL_RESULT = 4 定向 mutant 全部 KILLED（移除 40P01 → 红；
  加入 23505 → 负对照红）
WHY_RESOURCE_REQUIRED = 真实死锁需要两个真实会话交叉持锁等待
CLASSIFICATION = MISSING_OWNER（修复前）→ VALID_OWNER（修复后）
DISPOSITION = ADD_DETERMINISTIC_OWNER（已由 #722 完成）
EVIDENCE_GRADE = A
```

同族案例：`attemptStateMachine` 禁止转移空间缺 `disrupted:grade` 行
（23 对只枚举 22 对；补行 + 逐行 pin，mutant 验证 KILLED）。

### 必须保留的特殊事实（#720）

#720（CLOSED）以真实 PostgreSQL + Drizzle 0.45 / postgres.js 3.4.9 实证：

> 事务结束后捕获的 tx-bound repository **仍可继续执行**；rollback 后的写入
> 以 autocommit **持久落库**。该栈中不存在"事务已结束"的驱动级拒绝。

当前 master 的刻画测试位于 `ea-lock-order.test.ts`（tx-bound lifecycle
characterization）。**任何后续工作不得引用"事务结束后必然拒绝再使用"的旧语义**；
`code-quality.md` §6 已按 #721 修正。#720 的加固决策（seam 消费方
transaction-generation token vs 接受+文档化）是独立的待决事项。

### D3 验收

```text
NEGATIVE_CALIBRATION = C1（false authority）、C2（weak oracle）、
  C3（overstated claim）、#722 C3 retitle / REPLAYS 冗余
POSITIVE_CALIBRATION = C4（physical owner）、C5（composition owner）
MISSING_OWNER = C6 + disrupted:grade（均已修复并有 mutant 反证）
CALIBRATION_DISCRIMINATION = PASS
```

---

## 5. 跨领域证据完整性（D4，#722 as-built）

PR #722（merge `34d94fd98a72419ed97f151275c3da6136d5d675`，FINAL_HEAD
`ed63966f`，3 commits：`25025c98`/`c93fee21`/`ed63966f`）把 #718/#721 方法
推广到 9 个证据域。**本收束 as-built 核验**：diff 仅 7 个测试文件（零生产
代码），关键 owner 文件与断言在当前 master 在位。

| DOMAIN | MATERIAL_FAULT_MODELS（摘要） | EXISTING_OWNER | ORACLE_TYPE | COUNTERFACTUAL_EVIDENCE | RESULT / NEXT_ACTION |
| --- | --- | --- | --- | --- | --- |
| D1 PostgreSQL/SQL | 锁序、约束仲裁、事务原子性 | #718/#721 已裁定 201 文件；本报告 §4 | SQLSTATE/约束/持久终态 | 7 定向 mutant（#721）全 KILLED | 回归检查 only；KEEP |
| D2 Concurrency/Race/Time | overlap 声明、sleep 时序依赖 | 12 个并发声明文件 + 17 个 sleep 站点复审（计数为 #722 报告自报） | pid/txid/pg_locks/有界谓词 | 3 处修复（retitle、REPLAYS 收敛、有界等待） | 已达标；无遗留 |
| D3 State Machine | 禁止转移空间（attempt/exam/enrollment 三表） | `attemptStateMachine.test.ts` 23 对全枚举 + 行 pin | 精确 reason 断言 | 2 mutant（加边/行）KILLED | 已闭合；无遗留 |
| D4 AuthZ/Tenant | R2/R3/R4、E9/E10、tenant isolation | 既有套件在位 | 403/401 模式 + 隔离断言 | 复审无需修复 | 无修复；无遗留 |
| D5 API Contract | 错误契约形状、PG 错误分类 | plugins/errors owner + T2 负对照 | 规范错误形状 | 3 处 `expect(true)` 核实为编译期 `@ts-expect-error` 守卫（KEEP） | 无修复；无遗留 |
| D6 Worker/Retry/Lifecycle | 40P01 retry 契约、非重试传播 | `transactionRetry.test.ts`（新增） | 真实 40P01 + 23505 负对照 | 2 mutant KILLED | 已闭合；后续 #727 修复其 schedule 缺陷（见下） |
| D7 Web | 组件契约 | 既有套件 | — | 复审无需修复 | 无修复 |
| D8 Browser/E2E | 用户流 | 既有 E2E（#705 已收敛） | 浏览器级证据 | 复审无需修复 | 无修复 |
| D9 Test Infra/CI | lane 契约、隔离、租约 | testScope/testIsolation/testInfraLock 等 | 结构守卫 + lane 断言 | UNRESOLVED=1（lane 契约冲突）→ 由 #723 修复（lane-gated 套件 + `processSuiteLaneGate.structural.test.ts` + testing.md §5.2 修复） | 已闭合 |

**#722 之后的真实缺陷修复（证据系统持续被行使的证据）**：

- #724/#725（CLOSED/MERGED）：process-test harness 的 `PORT_ALLOCATION_TOCTOU`
  与 `READINESS_IDENTITY_GAP`（外部 server 健康应答被误归属为被 spawn 的
  child）——确定性复现 + 把 readiness 绑定到 child 自己的 listen 记录。
- #727（MERGED）：`transactionRetry.test.ts` 40P01 owner 在包级并发下
  flake（3 vs 2 attempts）——用因果执行 DAG 定位缺失 happens-before 边
  （contender commit 与 retry 快照次序），结构性修复 schedule，无生产代码变更。

**边界声明**：上表是"audited scope 内 material fault models 有 named owner"
的证据，**不是**"9 个领域全部可能行为已完整验证"的声明。#722 报告的
owner graph 覆盖 material 表面；未审计角落按 MISSING_OWNER 协议随真实
缺陷/回归持续补齐（#724/#727 即为实例）。

### 与 exam-testsuite 的关系

```text
exam/main = permanent test and behaviour authority（#721/#722 的合并测试
            是执行权威，留在 exam）
exam-testsuite = experiment protocol, evidence and replay authority
```

[exam-testsuite #5](https://github.com/jnhu76/exam-testsuite/issues/5)（OPEN，
`HISTORICAL_IMPORT_PENDING`）已登记 #718 proof-integrity 研究迁移；其边界
明确排除把 #719 整体塞进 `postgresql/proof-integrity`。本收束不改变该关系：
#719 的方法论存于本报告 + issue 记录；若未来需要独立跨领域 methodology
study，应按 TS5 的 sibling-suite 模式新建精确目录并另行授权，不自动建设
通用框架。

**Provenance 备注**：TS5 正文记录的 remediation head
`e41185286451c4177edda3e5129175f13472652c` 与 PR #721 实际 mergeCommit
`e62d317e06819407a28d521ded818ccc62afbeda` 不一致；TS5 自身已要求
"resolve the actual merge/release SHA"。正确锚定值以 GitHub PR 记录为准。

---

## 6. D5 — Workflow experiment 的真实状态

### 6.1 历史状态（G5.1）

```ini
D5_CONTROLLED_EXPERIMENT (historical) = NOT_EXECUTED
INDEPENDENT_REVIEW_EXISTED = LIMITED（PR #721/#722 零人工 review；
  CodeRabbit 因 <10 stars skip；#722 报告中的 adversarial review A–E 为
  同一上下文自审）
MULTI_AGENT_WORKFLOW_EXISTED = NOT_DOCUMENTED
CONTROLLED_WORKFLOW_COMPARISON_EXISTED = NO（#719 评论为空，无任何实验记录）
```

### 6.2 本轮执行的预登记受控试点（G5.2）

预登记设计冻结于试点启动前（输入从 git 历史提取并落盘；reference
adjudication 取自已发布的历史记录，先于运行不可变）。

**样本（6 个互不重复 fault-model 任务，SHA 锚定，冻结后未更换）**：
T1 false concurrency claim（`ea-lock-order` @ `4dbf62e1`）；T2 weak oracle
（`gradingConcurrency` @ `4dbf62e1`）；T3 valid physical owner
（`admin-force-submit` Matrix A @ `4dbf62e1`，冻结节选）；T4 redundant replay
（`attemptLifecycleRaceTraces` @ `e62d317`）；T5 missing owner
（`attemptStateMachine` test+source @ `e62d317`）；T6 process identity
（`restartProcessHarness` @ `dadd224c`）。

**双臂（等价冻结输入、相同任务提示词、相同停止规则；两臂互不可见）**：

- Arm A（Strong-only）：GLM-5.3（max），单上下文完成全部 6 案例审计。
- Arm B（Layered）：B1 证据重建 GLM-5.3-Flash（high）→ B2 独立反向审查
  kimi-k3（max，不同模型家族）→ B3 争议裁决 GLM-5.3（max，仅 3 个争议点）。

**评分（按冻结 reference，机械判定；评分者非试点参与者）**：

| 案例参考要点 | Arm A | Arm B（合成） |
| --- | --- | --- |
| T1 五项 false-authority 事实 | 5/5 | 5/5 + 附加发现（racer 资源身份虚构等） |
| T2 三项（概率证据/case3 盲 oracle/kill mutant 预测） | 1.5/3（1 条与参考预测矛盾的归因断言，UNSUPPORTED） | 3/3（B1 预测与参考一致；B2/B3 补单池前提与隔离级别条件） |
| T3 五项 physical-owner 证据（冻结节选未含 Matrix B 的 23505 腿，故参考项 (f) 边界理由不计分） | 5/5 | 5/5 + 两项归因精度残余（经 B3 裁决不动摇 owner） |
| T4 replay 冗余两项 | 0/2（明确写出与参考相反的判断） | PARTIAL——B1/B2 初判"回放无问题"，B3 裁决支持收敛立场（与已发布处置一致）；**披露：反方立场由编排方注入裁决题面** |
| T5 三项（23 vs 22、mutant 存活、最省 owner） | 3/3 | 3/3 + 附加死导出发现 |
| T6 四项（readiness 身份归属缺口） | 0/4（把 exit-race 当优点） | 4/4——**由 B2 独立审查抓出**；**披露：B2 提示词含按历史发现拟定的审查重点清单（身份归属条目），属 hint 通道** |

**汇总（探索性，n=6）**：

```ini
ARM_A_RECALL ≈ 14.5/22 (66%)
ARM_B_RECALL ≈ 21/22 (95%，其中 T4 PARTIAL、T6 hint-assisted)
ARM_A_UNSUPPORTED_OR_FALSE_FINDINGS = 2
ARM_B_UNSUPPORTED_OR_FALSE_FINDINGS = 0（1 条前提夸大被 B2 修正）
ARM_A_TOKENS = 124,239（1 上下文，382s）
ARM_B_TOKENS = 439,782（3 上下文，累计 1,679s，≈3.5× token / ≈4.4× 时间）
STATISTICAL_CLAIM = NONE（n=6，探索性）
```

**声明的效度威胁**（其中"公开 reference"、"单次运行/无重复"、"评分归属"
三条在预登记设计中已声明；"hint 通道"与"立场注入"两条为执行层复盘
发现的补充声明；"模型+工作流混杂"为双臂定义的隐含事实，此处明示）：

1. T6 的恢复部分来自 B2 提示词中的审查重点清单（hint 通道），非纯自发发现；
2. T4 的恢复由裁决题面注入反方立场驱动，两个执行角色初判均漏；
3. reference 答案公开于仓库 issue 中，两臂同等地可能违反"禁止探索仓库/网络"
   的信任约束；
4. 双臂模型不同（GLM-5.3 vs Flash+kimi），差异归因于"模型+工作流"整体，
   不能分离纯工作流效应；
5. 单次运行、无重复；评分为编排方对照冻结参考的机械判定。

**剔除辅助通道后的分解**：在四条无辅助案例（T1/T2/T3/T5，共 16 个可评分
参考项）上，Arm A ≈ 14.5/16，Arm B 16/16——差距全部来自 T2（Arm A 的
UNSUPPORTED 归因断言 + 半项 (b)），方向性在干净子集上仍然成立。

**试点结论**：在诚实声明上述威胁的前提下，本轮得到一个**方向性**数据点：
分层工作流（中等模型穷尽重建 + 独立反审 + 强模型裁决）在证据召回与
unsupported-claim 率上优于单强模型全包，代价约 3.5× token。它**证明**了
D5 受控实验在本仓库可执行、且 pre-registration + SHA 冻结输入 + 已发布
reference 的协议可行；它**不证明**普遍的模型/工作流优越性。

### 6.3 D5 正式处置（G5.3）

```ini
D5 = PARTIAL_ONLY
D5_REAL_EXPERIMENT_RUN = YES
D5_EXISTING_CONTROLLED_EVIDENCE = NONE (historical)
D5_DEFER_DECISION = PROPOSED（干净复刻：无 hint 通道、n≥12、双臂输入
  逐字节等价、预注册评分表；见 §10 follow-up 草案）
```

理由：D5 的完整主张（分层工作流在仓库级审计上更优）需要无辅助通道的
复刻与更大样本；本轮试点有两条辅助通道，只能支撑探索性结论。**仅有研究
方案不等于完成——本轮交付的是已执行的真实试点 + 保留的复刻设计**，
不是把方案冒充为实验。

---

## 7. 证据归属、适用范围与明确反例

**权威归属**：

- 测试规范的运行时权威：`docs/standards/testing.md`（本轮核验：八字段模型
  **未**被写入 testing.md——方法论目前以 #719（OPEN issue）+ 两个已合并
  campaign 报告（历史证据）+ 本报告（研究综合）为载体。这是有意状态：在
  owner 决定是否把个别规则（如两个反事实问题）提升为标准之前，不创建
  第二套规范权威）。
- 行为权威：`docs/SPEC.md`、Accepted ADR、`docs/contracts/`。
- 修改历史与原始证据：Git、#718/#706（CLOSED）、PR #721/#722（MERGED）、
  本报告引用的 SHA。

**适用范围**：模型与分类学已在 real-PG（201 文件）与 9 证据域 material
表面上校准；其他角落（未审计文件、新增代码）按同一协议随战役持续适用。

**明确反例与限制**（本研究不声称的事项）：

1. #720 反例：驱动/ORM 可能**不**拒绝事务结束后的 repo 使用——任何"框架
   保证边界"类声称必须经刻画测试证实，不得由假设继承。
2. #722 报告自身的 mutation-harness 事故（M1 首次 `sed` 静默未应用导致
   假 PASS，重跑以断言式替换修正）——mutation 结果必须带恢复验证，
   harness 自身可成为假证据源。
3. #727 反例：确定性 owner 也可能携带隐藏 schedule 假设（20ms backoff 兜底
   的 happens-before 边），在并发下 flake——确定性不是一次认证，是可被
   新证据推翻的声称。
4. coverage/测试数仍有效的用途：reachability 与 under-tested 指示；本研究
   反对的是把它们当作充分性判据。
5. 本报告的文献综合基于元数据与摘要级一手核验 + 领域通识；未逐篇重跑
   原始统计（FULL_TEXT_NOT_VERIFIED 项已标注）。

---

## 8. D1–D5 最终矩阵（G0）

```text
REQUIREMENT_ID = D1_LITERATURE_MAP
ORIGINAL_REQUIREMENT = 整理并冻结 oracle/coverage/mutation/behavioural-gap/
  reduction/smells/testability 八个方向的文献，区分 peer-reviewed/industrial/preprint
CANDIDATE_EVIDENCE = #719 §2 八篇引用 + 本轮 8/8 一手源核验（§2 表）
SOURCE_REPO = jnhu76/exam + 外部（Semantic Scholar / arXiv / Springer）
SOURCE_SHA = f8c7ae03（#719 正文）+ 外部检索日期 2026-10-14
WHAT_THE_EVIDENCE_ACTUALLY_PROVES = 引用真实、题录准确、分类正确；
  文献支持以 fault-model discrimination 为主的判断方法
WHAT_IT_DOES_NOT_PROVE = 逐篇全文统计复现；文献本身不证明 Exam 语境有效性
STATUS = SATISFIED
CLOSURE_IMPLICATION = D1 可关闭；文献图冻结于 #719 正文 + 本报告 §2
```

```text
REQUIREMENT_ID = D2_EVIDENCE_MODEL
ORIGINAL_REQUIREMENT = 冻结最小八字段 schema（Contract/Fault Model/Trigger/
  Oracle/Boundary/Counterfactual/Owner/Cost）
CANDIDATE_EVIDENCE = #719 §4 定义；PR #722 按该模型执行并引用；§3 判别力检验
SOURCE_REPO = jnhu76/exam
SOURCE_SHA = f8c7ae03；34d94fd9（#722 应用实例）
WHAT_THE_EVIDENCE_ACTUALLY_PROVES = 模型已在真实战役中作为审计框架使用，
  且能区分 §3.4 的五类情形（PASS）
WHAT_IT_DOES_NOT_PROVE = 模型作为 per-test 强制 metadata 的必要性——
  该升级被 #719 non-goals 与本收束明确排除
STATUS = SATISFIED（Research Model 层次）
CLOSURE_IMPLICATION = 模型冻结；两个反事实问题为操作性核心
```

```text
REQUIREMENT_ID = D3_PG_CALIBRATION
ORIGINAL_REQUIREMENT = 用 #718 真实样本校准 false authority / probabilistic /
  valid owner / redundant / missing owner
CANDIDATE_EVIDENCE = #718 first-pass 审计（201 文件、6 false authorities、
  3 missing-owner）+ PR #721（7 定向 mutant 全 KILLED、201 文件裁决、
  UNRESOLVED=NONE）+ 本轮 C1–C6 历史/当前双态核验
SOURCE_REPO = jnhu76/exam
SOURCE_SHA = 4dbf62e1（历史）→ e62d317（修复）→ f8c7ae03（当前核验）
WHAT_THE_EVIDENCE_ACTUALLY_PROVES = 模型分类学在真实 PG 证据域有判别力，
  且修复有 mutant 级反事实证据
WHAT_IT_DOES_NOT_PROVE = 未复审文件逐个无罪（#718 自述约 165 文件仅
  smell 级筛查；incidental-PG 全量清点未做，记录为后续）
STATUS = SATISFIED（校准目的已达成）
CLOSURE_IMPLICATION = 校准数据集冻结于 #718/#721 记录 + 本报告 §4
```

```text
REQUIREMENT_ID = D4_CROSS_DOMAIN_APPLICATION
ORIGINAL_REQUIREMENT = PG 校准后向 concurrency/state-machine/authz/API/
  worker/web/E2E/infra 推广审计
CANDIDATE_EVIDENCE = PR #722（9 域、4 missing owners、4 mutants KILLED、
  诚实 UNRESOLVED=1）+ as-built diff 核验（仅 7 测试文件）+ #723（lane 契约
  闭合 UNRESOLVED）+ #724/#725/#727（后续真实缺陷修复）
SOURCE_REPO = jnhu76/exam
SOURCE_SHA = 34d94fd9（merge）；ed63966f（FINAL_HEAD）；f8c7ae03（核验）
WHAT_THE_EVIDENCE_ACTUALLY_PROVES = 方法跨域可迁移；audited scope 内
  material fault models 有 named owner
WHAT_IT_DOES_NOT_PROVE = 全仓所有角落已审计；owner graph 是范围限定的
STATUS = SATISFIED（按 #722 的申报范围）
CLOSURE_IMPLICATION = 跨域推广已实践；后续按真实缺陷持续适用协议
```

```text
REQUIREMENT_ID = D5_WORKFLOW_EXPERIMENT
ORIGINAL_REQUIREMENT = 受控比较分层工作流 vs 单强模型的审计质量
  （correctness/omission/false-positive/traceability）
CANDIDATE_EVIDENCE = 历史无受控比较（G5.1）+ 本轮预登记试点
  （6 案例、双臂、4 上下文、真实异构模型；§6.2）
SOURCE_REPO = jnhu76/exam（冻结输入取自 git 历史）
SOURCE_SHA = 4dbf62e1 / e62d317 / dadd224c（案例输入锚）
WHAT_THE_EVIDENCE_ACTUALLY_PROVES = 实验可行且有方向性数据点
  （分层工作流召回更高、unsupported 更少、~3.5× 成本）
WHAT_IT_DOES_NOT_PROVE = 普遍优越性（n=6、两条辅助通道、单次运行）
STATUS = PARTIAL_ONLY
CLOSURE_IMPLICATION = D5 是独立的 workflow-evaluation research，
  非 D1–D4 真实性的必要条件；干净复刻建议 defer 至 follow-up（§10）
```

---

## 9. Provenance（Issues / PRs / SHAs）

```ini
ISSUE_719 = OPEN, 0 comments（收束评论前）, https://github.com/jnhu76/exam/issues/719
ISSUE_706 = CLOSED（owner-layer semantic dominance campaign）
ISSUE_718 = CLOSED（PostgreSQL proof-integrity audit；baseline 4dbf62e1,
  BASE_DRIFT=NO；first-pass 2026-10-06T16:47:44Z；closeout 2026-10-06T19:10:13Z）
PR_721 = MERGED 2026-10-06T19:18:06Z, mergeCommit e62d317e06819407a28d521ded818ccc62afbeda,
  42 files（唯一既非测试也非测试支持的文件：docs/standards/code-quality.md §6 修正；
  另含 2 个测试支持文件 pgConcurrencyProbes.ts / auditLogTestRepo.ts）
PR_722 = MERGED 2026-10-06T20:58:10Z, mergeCommit 34d94fd98a72419ed97f151275c3da6136d5d675,
  7 test files, FINAL_HEAD ed63966f
ISSUE_720 = CLOSED（tx-bound repo 事务结束后仍执行并可持久写入；刻画测试在
  ea-lock-order.test.ts；文档已在 #721 修正）
ISSUE_723 = MERGED（lane 契约：lane-gated process suites + 结构守卫 + testing.md §5.2）
ISSUE_724 = CLOSED / PR_725 = MERGED（readiness 绑定被 spawn child 的身份证据）
ISSUE_726 = OPEN（causal execution DAG 研究——#719 的独立后续研究线，
  非本轮关闭前置条件）
ISSUE_727 = MERGED（transactionRetry 40P01 owner 的因果 DAG schedule 修复）
ISSUE_357 = OPEN（Anti-Decay 总研究；#719 是其测试领域窄化轨道）
TESTSUITE_5 = OPEN, HISTORICAL_IMPORT_PENDING（exam-testsuite 研究登记）
BASE_SHA (this closeout) = f8c7ae031eb4b2de3073bf6ca087c6f02d89aebf
PILOT_PREREG = /tmp/exam719pilot/PREREGISTERED-DESIGN.md（收束会话工作副本；
  正式记录为本节与 §6.2 的内容）
```

---

## 10. Closeout recommendation

```ini
D1 = SATISFIED
D2 = SATISFIED
D3 = SATISFIED
D4 = SATISFIED
D5 = PARTIAL_ONLY
FINAL_RECOMMENDATION = CLOSE_WITH_DEFERRED_SCOPE_PROPOSED
OWNER_CLOSURE_APPROVAL = NOT_REQUESTED_OR_PENDING
ISSUE_CLOSED_BY_AGENT = NO
```

**理由**：D1–D4 已得到充分、直接、可追溯的证据支持（文献 8/8 一手核验、
模型经六组真实校准案例判别 PASS、PG 校准与跨域推广均有 SHA 锚定的 as-built
与 mutant 级反事实证据）。D5 已执行真实受控试点但受两条辅助通道与样本量
限制，只能记 PARTIAL_ONLY。D5 检验的是**审计过程的效率与质量**，不是
D1–D4 结论真实性的必要条件——模型判别力由校准独立确立。

**给 owner 的正式范围修订建议**：将 #719 窄化为
"Test Evidence Model 与工程校准已完成"（D1–D4 关闭；D5 按下述草案移交）。
**只有 owner 接受该范围修订或 defer 决策后，#719 才视为可关闭。**

**D5 follow-up Issue 草案**（供 owner 使用，不自动创建）：

> **[Research][Testing] D5 clean replication — layered vs strong-only audit
> workflow（#719 移交）**
>
> - 目标：在无辅助通道条件下复刻 #719 收束报告 §6.2 的受控试点并扩大样本。
> - 设计：沿用已冻结的协议——预登记（案例、双臂、评分表先于运行冻结）；
>   SHA 锚定输入；reference 取自已发布记录；两臂逐字节等价输入；reviewer
>   提示词不得包含按 reference 拟定的重点清单；争议裁决题面不得注入
>   编排方立场；n ≥ 12（案例可扩至 process identity / restart / tenant 等
>   新 fault-model 族）；报告逐题差异与错误案例，不 claim 统计显著性。
> - 验收：D5 处置可升级为 SATISFIED_BY_NEW_CONTROLLED_PILOT 或确认
>   PARTIAL 边界；产出归档至 exam-testsuite 的独立 methodology suite
>   （sibling 于 `suites/postgresql/proof-integrity`，需另行授权建设）。

**明确的非目标重申**：本收束不删除、不修改、不新增任何测试；不运行
mutation；不把报告升格为强制标准；不自动关闭 #719，不重开 #706/#718，
不把 #726 作为默认前置。
