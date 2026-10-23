# R6 — WSL2 受控性能复验（EXAM #668）

状态：**REVISED EVIDENCE — AA PASS, A/B 判定有效（directional, WSL2-only）**
本报告在 Sluice 高负载实验迁离本机之后，按 Owner 复验指令（W0–W4）重跑 R4 性能验证。它**修订 R5 中 `PERFORMANCE_VALUE=INCONCLUSIVE` 的判定依据**（R5 报告与其 verdict 块保留为历史记录，不作废其正确性结论）；正确性证据（R3）不受影响并在本轮重新确认。
基线：master `158dc38d` + rig patch（与 `rig/exam-668-min-serialization.patch` 字节一致，本轮已复核）；研究工作树 `/tmp/exam-668-research`（detached 158dc38d + 未提交 rig），Owner 工作树零 tracked 修改。
原始收据：`rig/revalidation-results/`（54 份，逐节引用）。

## 0. 修订原因与证据地位

R4 轮 A/A p99 相对差 82%（门槛 25%），延迟判定被预注册门槛正确地拦下。当时的已知混杂：同机运行 Sluice 高负载实验。Sluice 现已迁至独立服务器。本轮在**同一 WSL2 + Docker PostgreSQL 拓扑、同一 rig、同一负载**下重测，回答两个问题：(a) 去除共租户负载后方差是否收敛；(b) 若收敛，FOR SHARE 的收益是否在稳定环境中依然成立。

证据地位不变（R4 §0 全文适用）：WSL2 结果为 directional；不得替代 Native Linux / production-topology 证据；30% materiality 是 R4 §4.4 的 **PROPOSAL**，未经 Owner 批准不自动成为产品采用标准。

## 1. W0 环境干扰审计

收据：`revalidation-results/w0-host-audit.txt`、`w0-docker-audit.txt`、`w0-pg-audit.txt`。

| 项 | 值 |
| --- | --- |
| 宿主 | WSL2，kernel `6.18.54.1-microsoft-standard-WSL2`，AMD Ryzen 7 5800H，8 vCPU（`.wslconfig`: memory=16GB, processors=8, swap=8GB, autoMemoryReclaim=gradual, networking=mirrored） |
| 负载基线 | 审计时 loadavg 0.31/0.67/0.44；PSI cpu/memory/io avg10 均 ≈0；**无 Sluice 进程**（`ps` 全量检索为空） |
| 静态共租户 | zcode-cli / MCP / chrome-devtools 工具进程常驻（内存 used 11Gi/15Gi，swap 已用 3.5Gi）。非实验期突发源，但如实记录 |
| Docker | `exam-dev-db-1`（postgres:18.4-bookworm，`postgres@sha256:efef99e1…`）+ redis:7-alpine，均 healthy，实验前 DB 容器 CPU 0.00% |
| PostgreSQL | 18.4 (Debian 18.4-1.pgdg12+1)；shared_buffers=128MB，work_mem=4MB，max_connections=100，synchronous_commit=on，fsync=on，`log_statement=none`（全局 + 全部 per-DB 覆盖均为默认值，无日志 I/O 干扰），集群默认隔离 read committed（事务内由 `executeInTransaction` 显式 RR，与产品一致） |
| 代码身份 | Owner 树与 Research 树同处 `158dc38d`；rig 4 文件 diff 与交付 patch **字节一致**（仅 index 行除外）；Node v24.15.0 / pnpm 11.1.2 |
| 测试库 | `exam_test`（schema 模式隔离，testing.md §2），基线 `xact_commit=25344 / rollback=238 / deadlocks=5` |

结论：**无显性资源竞争**（Sluice 已迁离，PSI≈0），满足开工条件。按指令要求如实声明：不能把旧轮 82% 波动**归咎**于 Sluice——旧轮当时没有 W0 遥测，无同时刻主机负载数据可比；本轮只能做"去除后方差是否收敛"的对照检验（见 §3）。

## 2. W3 正确性回归（按 R4 §3 先于性能实验执行）

收据：`w3-probes-update.log`、`w3-probes-share.log`。

| 臂 | 结果 |
| --- | --- |
| update（canonical） | **8/8** T1–T8 全绿 |
| share（#667 候选） | **8/8** 全绿；T1 反事实见证再次复现（`second reader completed while first reader parked`） |

- reader/reader compatibility（T1）、reader/writer 冲突（T4/T6）、writer-first stale snapshot（T2/T3，含整事务 40001 重试）、save/submit（T5）、candidate-first 线性化（T4）、scanner（T6）、shared-lock 升级负控制（T8）、不同 exam 负控制（T7）——全部与 R3 首轮一致，**无新正确性失败**。
- FK/RI 仍然不是正确性权威：share 臂的 writer-first 义务由**设计内的 FOR SHARE ↔ FOR UPDATE 冲突**承担（T2/T3 在 share 臂全绿即证明），不依赖 R3 发现的 RI-trigger 意外拯救（那是 none 臂的反事实发现）。
- none 臂未重跑：rig 未变，R3 的反事实证据（6/8 + RI-CONTEXT 日志）原样保留作为负控制。

死锁计数对账（收据 `w0-pg-audit.txt` / `dl-s1.out` / `dl-s2.out`）：`exam_test.deadlocks` W0 基线 5 → W3 两次 T8（真实的 shared-holder 升级死锁，PG 检测器各中止一方）后为 7 → W1/W2 十四场突发 delta 全为 0 → 手工升级死锁见证（7.5 节）后为 8。计数器活性已单独见证，所有 delta 收据有效。

## 3. W1 — A/A 稳定性复验：**PASS**

方法与 R4 §4.1 完全一致：canonical update 臂、S50、两次独立 vitest 运行、无预热删样。仪表：每场 vitest 外包装（前后 loadavg/PSI + `pg_stat_database` 快照）+ 独立连接的 500ms 外部采样器（total/active/lockwait + `pg_blocking_pids` attribution）；门禁只依赖 burst JSON 内部的 50ms 采样与延迟分布（与 R4 同源）。

| run | makespan | p50 | p95 | p99 | 失败 | lockWaitMean (/10) |
| --- | --- | --- | --- | --- | --- | --- |
| REV-AA1 | 1355ms | 264 | 283 | 300 | 0 | 7.44 |
| REV-AA2 | 1394ms | 269 | 290 | 322 | 0 | 7.46 |

**p99 相对差 = |300−322| / 311 = 7.1% ≤ 25% → 门槛通过**（R4 轮为 82%）。p50/p95/makespan 相对差 1.9% / 2.5% / 2.9%。附带一场仪表缺失的预跑（PRE-AA，外部采样器初版故障）：p50 266 / p99 302 / makespan 1361，落在正式两场带内（偏差 D-1）。A/A 期间 deadlock delta 0、rollback delta 0。

**旧 vs 新对照**：旧轮 A/A-1/A/A-2 = p50 346/396、p99 404/965；新轮 = p50 264/269、p99 300/322。去除共租户负载后尾部方差收敛约一个数量级，绝对值整体右移改善。这与资源竞争假设**一致但非证明**（W0 未在旧轮存在，无同时刻遥测可归因）。

## 4. W2 — 配对 A/B（A/A PASS 后执行）

预注册调度（先于运行写定）：S ∈ {50,100,200} × {update=A, share=B}，R1 顺序 `A50,B50,B100,A100,A200,B200`，R2 为其精确镜像（B200,A200,A100,B100,B50,A50）——每格 2 场、每尺寸两臂先后各一次，抵消时间漂移。判定沿用 R4 §4.4 PROPOSAL 原文，未调参。收据：`w2-r*.json`（12）、`burst-REV-AB-*.log`（12）、`sampler-REV-AB-*.txt`（12）、`w2-schedule-output.log`、`w2-pgstat-deltas.txt`、`w2-outer-sampler-per-window.txt`。

### 4.1 延迟与吞吐（两场中值）

| S | 臂 | p50 | p95 | p99 | makespan | 失败 |
| --- | --- | --- | --- | --- | --- | --- |
| 50 | A update | 268.5 | 297 | 333.5 | 1405ms | 0/0 |
| 50 | B share | **99.5** | 109 | **111.5** | **503.5ms** | 0/0 |
| 100 | A update | 273 | 314.5 | 318.5 | 2824.5ms | 0/0 |
| 100 | B share | **98** | 108.5 | **113** | **983ms** | 0/0 |
| 200 | A update | 276 | 302 | 329 | 5617.5ms | 0/0 |
| 200 | B share | **96** | 115.5 | **119** | **1962.5ms** | 0/0 |

### 4.2 R4 §4.4 MATERIAL 提名逐条检验（PROPOSAL，非标准）

| 条件 | 观测 | 判定 |
| --- | --- | --- |
| p50 改善 ≥30% | 62.9% / 64.1% / 65.2%（S50/100/200，2.70–2.88×） | ✓ |
| p99 改善 ≥30% | 66.6% / 64.5% / 63.8%（2.99× / 2.82× / 2.76×） | ✓ |
| 重复方向一致 | 每格 2/2 同向、无交叉；加 PRE-AA/AA 共 9 个 update 场对 6 个 share 场全部分离（update p99 ≥300，share ≤127） | ✓ |
| B 臂探针全绿、错误率 0 | W3 share 8/8；12 场共 **1400** 次 submit（4×(50+100+200)，R7 N3 勘误：本节原误记为 600）全部冻结为 submitted/graded（vitest 结构断言） | ✓ |
| 改善 > 2× A/A 带 | A/A p99 带 7.1%（格内重复 ≤13.5%），改善 ~64% ≈ 5–9× 带 | ✓ |

→ **WSL_PERFORMANCE_VALUE = MATERIAL（依 R4 §4.4 提名判据；directional，WSL2-only）**。

### 4.3 锁级机制与 blocker attribution（§5 要求）

- **内部采样（每场自身 50ms 窗口，无污染）**：update 六场 lockWaitMean 7.57–8.31、峰值 9/10 连接；share 六场 **恒为 0**（含 S200）。#586 的"exams 单行 tuple wait 占绝对主导"形态再次复现，R1-C 预测 P-1/P-2 的锁级见证在稳定环境下不变。
- **外部采样 blocker attribution**（按各场自身时间窗重构，见 D-2）：update 臂突发期 8–9 个等待者的 `pg_blocking_pids` 呈** convoy 树**——等待者既被当前持锁者阻塞、也被队首邻居阻塞（如 R1-A200 窗口内 `237922→237918,237921,…` 链）；share 臂六场自身窗口内 lockwait>0 行数为 **0**。
- **事务完整性**：12 场 pg_stat delta 全部 `rollbacks+0, deadlocks+0`（`w2-pgstat-deltas.txt`）；提交数随 S 线性（S50≈1.1k、S100≈2.1k、S200≈4.0k），无重试耗尽、无 40P01。
- 连接峰值：update 突发期 active=10–11（10 worker 全忙），与 K=10 拓扑一致。

### 4.4 与历史证据的一致性

| 对比 | 量级 |
| --- | --- |
| 本轮稳定 WSL2（S200 makespan / p99） | 2.86× / 2.76× |
| R4 轮（噪声 WSL2，S200） | 2.9× / 2.8× |
| PR #667（Fedora S200，历史证据 566b2eb9） | 2.6–2.8× |

R4 轮 S50 的 3.4–8.2× 区间上端是 A 臂尾部被噪声抬高的伪放大；稳定环境下三尺寸收益收敛于 **2.7–3.0×**，与 #667 历史量级吻合。

## 5. 偏差记录（对 R4 协议与本轮指令）

- **D-1**：首次 A/A 尝试的外部采样器 shell 失败（zsh 不做变量词分裂），该场延迟数据完整但无外层仪表；以同配置重跑两场正式 A/A（AA1'/AA2'），门禁计算只用正式两场；PRE-AA 场数字如实记录于 §3，未参与门禁。修复后的包装器存档 `revalidation-results/run-burst.sh`。
- **D-2**：包装器 `kill $SAMPLER` 只终止 subshell，`docker exec` 内存活的 psql `\watch` 进程把**后续 run 的采样行写进了前一 run 的采样文件**。处理：以调度日志 12 个 header 时间戳重建每场自身窗口，仅在窗口内取数（`w2-outer-sampler-per-window.txt`）；per-run 延迟与内部锁采样（JSON，独立进程独立窗口）不受影响；门禁不依赖外部采样器。
- **D-3**：泄漏的观察连接逐场累积（1→14 个，每 500ms 一次亚毫秒 catalog 聚合查询）。效应评估：各臂数字无随时间的系统漂移（update p50 264–286 共 8 场、share 96–101 共 6 场；R1 vs R2 无单调恶化），远小于被测效应（~180%）；已全部终止并记录。
- **D-4**：第一次 W2 调度在启动后因 D-1 的仪表问题被整批中止重跑，被弃收据已删除、未参与任何分析（非噪声删样）。
- **D-5**：deadlock 计数器活性见证在 `exam_test.public` 建立并随后 DROP 了一张临时探针表 `e668_deadlock_probe`（一次性本地见证，AGENTS §7 例行可逆；目标为测试库，已核对）。
- 协议其他条款（负载、池、隔离级别、事务语义、S 档、warm-up 语义、停止条件）与 R4 预注册一致；S100 为 Owner 本轮指令新增档位，R4 §4.2 的 {50,200} 未删减。

## 6. W4 — 裁决与五问

```text
BEGIN_EXAM_668_RESEARCH_VERDICT (REV2 — supersedes R5 block's performance fields only)
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
AA_STABILITY=PASS
WSL_PERFORMANCE_VALUE=MATERIAL
CROSS_HOST_CONFIRMATION=REQUIRED
PRODUCTION_CHANGE=NONE
POOL_CHANGE=NONE
PR_CREATED=NO
COMMIT_PUSH=NONE
OWNER_DECISION_REQUIRED=YES
END_EXAM_668_RESEARCH_VERDICT
```

1. **A/A 波动是否显著降低？** 是。p99 相对差 82% → 7.1%；p95 100%+ → 2.5%；六个 A/B 格内重复 ≤13.5%。
2. **是否支持原先的资源竞争假设？** 支持（不可归因证明）：Sluice 迁离 + PSI≈0 的条件下方差收敛约一个数量级、绝对延迟整体改善；旧轮无同时刻遥测，归因只能是推断。
3. **FOR SHARE 的 p99 收益是否稳定？** 是（WSL2 范围内）：2.76–2.99×，六对全同向；share 臂 p99 绝对值 111–127ms 且几乎不随 S 增长；机制（C/C 排队消除，锁等待 0 vs 8–9/10）在锁级与 attribution 两层独立见证。
4. **除 Exam Reader Convoy 外还剩哪些瓶颈？** share 臂单笔提交 ≈96–101ms 与 S 无关，makespan ≈ (S/10)×100ms——剩余限制是**单事务内的工作量**（冻结写、grading workset 物化、receipt/事件写入）× **池宽 K=10**（#586 KEEP_POOL_10），不再是 exams 行互斥。update 臂残余 ≈270ms/笔即 convoy 服务时间。
5. **是否足以向 Owner 提生产化建议？** 足以**提出建议包**：(a) 批准/修订 R4 §4.4 materiality 阈值；(b) 出资 native/topology 确认实验（CROSS_HOST_CONFIRMATION=REQUIRED——两轮 WSL2 + #667 Fedora 历史同量级已充分说明值得投入，但按 R4 §0 WSL 不可替代生产拓扑证据）；(c) 若 native 确认成立，#667 候选 seam（rig patch，4 文件、默认行为不变）即为施工起点。**本轮未实施任何产品变更**；`PRODUCTION_CHANGE=NONE`。

## 7. 收据清单（`rig/revalidation-results/`）

| 组 | 文件 |
| --- | --- |
| W0 | `w0-host-audit.txt`、`w0-docker-audit.txt`、`w0-pg-audit.txt` |
| W3 | `w3-probes-update.log`、`w3-probes-share.log`；死锁见证 `dl-s1.out`、`dl-s2.out` |
| W1 | `w1-aa{1,2}-update-s50.json` + 对应 `burst-REV-AA*.log`、`sampler-REV-AA*.txt` |
| W2 | `w2-r{1,2}-{a,b}{50,100,200}.json`（12）+ `burst-REV-AB-*.log`（12）+ `sampler-REV-AB-*.txt`（12）+ `w2-schedule-output.log` |
| 派生 | `w2-pgstat-deltas.txt`、`w2-outer-sampler-per-window.txt` |
| 装置 | `run-burst.sh`、`w2-schedule.sh`（复验包装器；D-1 修复后版本） |

重放：`git worktree add --detach /tmp/exam-668-research 158dc38d && git apply rig/exam-668-min-serialization.patch`，两份探针文件复制到 `apps/api/src/routes/attempts/`，`pnpm install`，然后按 `rig/README.md` 与 `run-burst.sh` 的环境变量接口执行。
