# R4 — 性能实验预注册协议（EXAM #668）

状态：PRE-REGISTERED（本文件在运行任何 A/B 实验之前写定；事后修改必须以 deviation 条目记录在 R4-ab-results.md，不允许静默改阈值。）

## 0. 证据地位声明（先于一切数字）

本协议下的全部实验在 **WSL2 环境**（`linux 6.18.x-microsoft-standard-WSL2`）执行。按研究契约 R4 条款：

- WSL 结果**不得**替代 Native Linux / production-topology 证据；
- 本实验的全部产出定性为 **directional（方向性）证据**，其唯一合法用途是：(a) 检验 R1/R2 的因果预测是否在真实 PostgreSQL 上成立；(b) 为 Owner 决定是否值得投入原生环境确认实验提供排序依据；
- WSL 数字本身**不构成** PERF 又一 MATERIAL 判定的充分条件。

PR #667 的 Fedora S200 数字（p99 2.6–2.8×）是**历史证据**，不是当前产品权威（分支已删，仅存 566b2eb9）。

## 1. 环境固定

| 项 | 值（运行时记录于 R4-ab-results.md） |
| --- | --- |
| 宿主 | WSL2，kernel 6.18.x-microsoft-standard-WSL2 |
| PostgreSQL | 仓库 dev compose 提供的版本（运行时 `SELECT version()` 记录） |
| 连接池 | 10（#586: KEEP_POOL_10_FOR_CURRENT_SUBMIT_MECHANISM，实验不得改池） |
| 基线代码 | master 158dc38d + rig 补丁（`rig/exam-668-min-serialization.patch`），EXAM_668_LOCK_MODE 切换臂 |
| E2E/隔离 | 按 docs/standards/testing.md §2：APP_MODE=test 自建 exam_test，每文件独立 schema |

## 2. 实验臂

| 臂 | EXAM_668_LOCK_MODE | 语义 | 预期（来自 R1 证明） |
| --- | --- | --- | --- |
| A（canonical） | `update` | 现行 FOR UPDATE | 全部正确性探针通过；reader/reader 互斥可见 |
| B | `share` | #667 候选机制：仅 deadline readers 改 FOR SHARE，writers/scanner/operator 保留 FOR UPDATE | 全部正确性探针通过；reader/reader 并行可见 |
| C（negative control） | `none` | 无 Exam 锁读取 | T2/T3（writer-first stale-freeze）类探针应失败或依赖重试窗口，证明锁不可省 |

C 臂是**证伪控制**：若 C 臂也全部通过，说明探针没有咬住锁语义，rig 无效。

## 3. 正确性探针（R3，先于性能实验）

探针套件：`rig/exam-668-serialization.research.test.ts`（8 个测试，T1–T8）。准入规则：

- A 臂必须全绿（rig 校验：canonical 行为复现）。
- B 臂必须全绿（等价性主张的正面证据）。
- C 臂必须至少一红（rig 校验：探针确实检测锁缺失）。
- 任何一臂出现 timeout/死锁挂起：记录后停止，不得加 timeout 或重跑换绿灯。

## 4. 性能实验设计（仅 directional）

### 4.1 A/A 先行

先跑 A vs A（update 臂两次独立运行），得到 run-to-run 方差带。**若 A/A 的 p99 相对差 > 25%，则环境噪声过大，本轮放弃任何 A/B 结论，只记录方差。**

### 4.2 工作负载

- 场景：单 Exam，S 个 candidate 在同一时刻并发提交（submit burst），复刻 #586 观察形态（93.8% 锁等待为 exams 单行 tuple wait）。
- S：WSL 上取 50 与 200 两档（200 对齐 #586 的 S200 参考点；50 用于确认效应在小并发下是否已出现）。
- 提交路径：真实 HTTP route（buildTestApp），不含 mock；deadline scanner 停用（DEADLINE_SCAN_INTERVAL_MS=3600000），避免后台 reconcile 混入。
- 每臂每档运行 3 次，取每次的 p50/p95/p99 与总完成时间。

### 4.3 度量

1. 每请求 submit 墙钟（服务端 route 计时）分布；
2. `pg_stat_activity` 采样（100ms 周期）记录 exams 行上的等待者数量峰值与持续时间（对齐 #586 的观察手段）；
3. 40001/40P01 重试计数（passCount 分布）；
4. 错误率（任何 5xx 视为该臂失败）。

### 4.4 MATERIAL 判定阈值（PROPOSAL — 待 Owner 批准，非既定标准）

WSL directional 证据满足以下全部条件时，**才有资格**建议 Owner 投入原生确认实验（不等于建议直接改产品）：

- submit p50 改善 ≥ 30% 且 p99 改善 ≥ 30%（相对 A 臂中位数）；
- 改善方向在 3 次重复中一致（无交叉）；
- B 臂正确性探针全绿、错误率 0；
- A/A 方差带（4.1）不足以解释上述差距（改善幅度 > 2× A/A p99 波动带）。

任何一条不满足 → PERFORMANCE_VALUE=INCONCLUSIVE 或 NEGLIGIBLE，FINAL_DISPOSITION 走 KEEP_FOR_UPDATE 或 DEFER。

### 4.5 停止条件

- B 臂任一正确性探针红 → 立即停止全部性能实验，R3 记录失败模式；
- 出现 40P01（除 T8 构造的 SQL 见证外）→ 停止，升级为等价性疑点；
- 任何臂错误率 > 0 → 该臂数据作废，仅记录现象。

## 5. 因果分析要求（R4-causal-analysis.md）

结果无论正负，必须给出与 R1 预测的对照：

- 预测 P-1：B 臂消去 C/C 排队（reader/reader 不再互斥），submit 尾延迟主要改善来自此；
- 预测 P-2：W 仍与全部 reader 互斥，故 writer-first 场景（T2/T3）B 臂无改善；
- 预测 P-3：改善幅度上限 = C/C 排队占总等待的比例（#586: 93.8% 为 exams 单行等待，其中 reader/reader 占比未单独刻画——本轮实验同时输出该占比）。

若结果与预测矛盾，先修模型再谈结论；禁止用"噪声"一笔带过系统性偏差。

## 6. 产物

- R4-ab-results.md：原始数字 + 环境快照 + deviation 列表；
- R4-causal-analysis.md：P-1..P-3 对照 + 与 #586/#667 历史证据的一致性检验；
- 本文件保持只读（pre-registration 锚点）。
