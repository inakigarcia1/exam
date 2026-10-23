# R7 — Fedora Native Linux 性能确认（EXAM #668）

状态：**NATIVE-LINUX CONFIRMATION COMPLETE — AA PASS / CORRECTNESS PROVEN / RESEARCH_MATERIALITY PASS / CROSS_HOST_REPLICATION CONFIRMED**
本报告在 Fedora 原生 Linux 服务器（E5，192.168.31.75）上按 Owner 指令（N0–N8）执行 #668 的跨主机性能确认。R4 预注册协议、R6 复验方法与测量口径全部沿用；**不修改生产语义、不创建 PR、不 commit/push**。
原始收据：`rig/native-results/`（`manifest.json` + `SHA256SUMS` + `receipts/` 全部原始文件）。

## 0. 结论速览

在同一台 Fedora 原生主机、同一 Docker PostgreSQL 18.4 镜像、同一 rig（仅锁模式不同）下：

- **正确性**：update 8/8、share 8/8 全绿；none 6/8（T2/T3 红）——rig 在本机咬合，FK/RI 仍非正确性权威；
- **A/A**：p99 相对差 **5.4%** ≤ 25%（R4 §4.1 原门槛）；
- **A/B**：六对全同向，FOR SHARE submit **p50 改善 75.3–77.4%、p99 改善 62.1–67.6%、makespan 3.65–4.15×**；
- **机制**：update 臂 Exam 行锁等待均值 7.53–8.35/10 连接（峰值 9），等待事件 `transactionid+tuple`，blocker 归因呈 convoy 树；share 臂六场窗口内锁等待**恒为 0**；
- **事务完整性**：12 场 delta 全部 0 rollback / 0 deadlock；1400 次 submit 全部成功冻结且每 attempt 恰一个 grading workset（终态 oracle）。

WSL2（R6）与 Fedora（R7）的**同主机内相对效应**一致（p99 改善 62–68% vs 64–67%），跨主机复制成立；绝对延迟不可跨主机混合比较（N7 Q10）。

## 1. N0 — 研究产物与版本身份

| 项 | 值 |
| --- | --- |
| 本地研究基线 | owner 树 `master` = `158dc38d`（R0–R6 全部交付物在 `docs/research/exam-668-min-serialization-1/`，untracked，共 14 项 + rig） |
| 服务器仓库 | `~/Source/exam`，原在 `f94b519f`（工作树干净），本轮按指令 `git pull --ff-only origin master` → **`be5b717b`**（与远端实读一致，未硬编码旧 SHA） |
| 基线对比 | `git diff --stat 158dc38d..be5b717b` 共 2 个提交（docs/scripts）；**事务、锁、评分、数据库接口、负载发生器的全部前提文件未变**（deadlineReconciliation.ts、examCommands.ts、examRepo.ts、repoAdapters.ts、db/types.ts、submitAndGradeAttempt、testDb/testIsolation、compose 文件——diff 为空） |
| 受测身份 | BASE_SHA = `be5b717b`（服务器 master HEAD）；CANDIDATE = rig patch `ca41b56a…`（SHA256，与 WSL 轮交付件字节一致） |
| 传输完整性 | 3 份文件端到端 SHA256 一致（patch `ca41b56a…`、探针 `c077ce2e…`、burst V2 `247ca5a2…`→host 字段修正后 `caced55d…`），见 `receipts/transferred-files-SHA256.local.txt` 与服务器侧 sha256sum 输出 |
| 隔离 | 未传输 `.env`/密钥/令牌；服务器仓库无 `.env`（仅 example）；研究装置全部位于 `/tmp/exam-668-native` |

**rig 身份**：patch 与两轮 WSL 交付件字节一致；burst 测试为 **V2** = V1 + 计时窗口外终态 oracle + host 字段派生（`os.hostname()`），V1→V2 delta 58 行、全部在计时结束之后执行、对两臂对称；探针文件 T1–T8 与 V1 字节一致。注：探针文件为 V1 身份锚点，位于 `rig/`（不在本目录 SHA256SUMS 清单内，其哈希由 manifest.json 与实测 sha256sum 双侧核验）。RIG_IDENTITY = **PASS**。

## 2. N1 — Fedora 环境与资源竞争审计

收据：`receipts/n0-n2-identity-audit.txt`、各场 wrapper 前后快照。

| 项 | 值 |
| --- | --- |
| 主机 | hostname `E5`，Fedora release 44，kernel `7.2.9-201.fc44.x86_64` |
| CPU | Intel Xeon E5-2666 v3 @ 2.90GHz（max 3.5GHz），10 核 20 线程 |
| 内存 / Swap | 62Gi（used 2.5Gi）；zram 8G（0B used） |
| 空闲度（准入时） | loadavg 0.00/0.00/0.03；PSI cpu/memory/io avg10 均 ≈0（准入时点会话内观测；收据化为后续 14 场 wrapper 前后快照——PSI avg10 全程 0.00，见 `n6-schedule-output.log` 与 `burst-NAT-*.log`） |
| Sluice | **ABSENT**——无进程、无活动容器；仅 3 周前 Exited 的本仓库 compose 栈 + 一个 hello-world |
| 未知低负载进程 | `/tmp/e5/bin/w03diag`（jnhu，~0.3% CPU，4.5MB）——如实记录，不干预，远低于可观测门槛 |
| Docker | 29.7.2；容器无 CPU/内存限额（NanoCpus=0, Memory=0），整个实验期容器 `nr_throttled=0`（cpu.stat，见各场 wrapper 收据） |
| 温度/降频 | 用户态不可读（无 sensors/root），以 PSI+loadavg+每场前后快照作为替代证据；未观察到降频迹象 |
| Node/pnpm | v24.15.0（nvm）/ 11.1.2 —— 与 WSL 轮完全相同 |
| 磁盘 | / 445G，用 13% |

**ENVIRONMENT_ADMISSION = PASS；SLUICE_CONTENTION = ABSENT。** 不以 loadavg 单指标为准：PSI 三路、容器 cpu.stat 节流计数、每场前后快照共同作证；全程无 throttling、无 PSI 抬升。

## 3. N2 — 拓扑与数据库安全

- **拓扑**（与 R4/R6 同构，负载发生器 host-native）：`Node(vitest) 负载发生器/编排驱动 → Docker PostgreSQL 18.4`。未启用 nginx/API 容器层——与 WSL 轮保持 WORKLOAD=FROZEN 与测量口径一致（若另建 HTTP 拓扑会引入第三种变量）；compose 文件本身两 commit 未变。
- **设施复用**：仓库权威 `pnpm db:up`（docker-compose.dev.yml，project `exam-dev`，`127.0.0.1:5432` loopback-only）。宿主 5432/6379 在启动前空闲（`ss` 核验），**未抢占任何现有服务**；容器为 Exited 3 周的既有栈复用启动，未重建、未清卷。
- **数据库身份核验**（§2.8）：启动后实连查询 `SELECT version()` + 库清单；测试目标为 `exam_test`（52MB，既有测试库；名称含 "test" 通过 name-safety guard；每场独立 schema + 文件级 reset 边界）。**未接触 `exam` 业务库数据**（除 SELECT version/统计外零访问）。
- **实例参数**：PG 18.4 (Debian 18.4-1.pgdg12+1)，shared_buffers=128MB、work_mem=4MB、max_connections=100、synchronous_commit=on、fsync=on、log_statement=none（无日志 I/O 干扰）——与 WSL 轮同一镜像同一默认。
- **清理范围**：仅终止本轮自身泄漏的 18 个 `psql \watch` 观察后端（application_name='psql'，idle）；无任何无作用域 Docker 清理命令。

## 4. N3 — 测量口径

**计时边界（全部新实验与 R6 同一定义）：**

- `submit p50/p95/p99`：围绕 `submitAndGradeAttempt(...)` 调用的**进程内单请求服务墙钟**——包含 DB 往返、行锁等待、40001 整事务重试、进程内评分计算；**不含** worker 槽位排队等待（每 worker 取到任务后才起表）、不含 HTTP 层（本 rig 无 HTTP）。
- `makespan`：12(或 S)个任务全部完成的 campaign 墙钟。
- 两者关系（R6 澄清项）：S200 makespan(8.6s) ≫ p99(≈0.5s)，因为 Arrival 模型是**固定并发槽闭环队列**：K=10 个专用 max:1 连接，任务 i → worker i%10，每 worker 严格串行处理 S/10 个提交。makespan ≈ (S/10)×单笔服务时间；p99 是单笔服务时间分布的尾部。本 rig **不是**全量同时发起的开环到达模型。
- `transaction p99`：本 rig 未单独仪表化；p99 即"客户端观测 = 服务端事务 + 往返 + 重试 + 评分"的合并口径，未与 client latency 拆分——如实披露，不混用术语。
- 连接池等待：显式建模为 K=10 专用连接（#586 KEEP_POOL_10）；任务在 worker 槽位的排队不计入延迟样本。

**请求数量核算（含 R6 勘误）：**

| 字段 | 每场值 | 总计 |
| --- | --- | --- |
| SCENARIO / ARM / ROUND | 同 exam submit burst / A=update, B=share / R1,R2 镜像 | — |
| REQUESTS_PLANNED | S（50/100/200） | 12 场 = **1400**（4×(50+100+200)） |
| REQUESTS_STARTED / COMPLETED | S（vitest 断言 `outcomes.length === CANDIDATES`） | 1400 |
| REQUESTS_SUCCESSFUL | S（`failures=0` 断言） | 1400 |
| REQUESTS_INCLUDED_IN_LATENCY | S（全部完成样本进入分位数） | 1400 |

**R6 勘误**：R6 §4.2 曾写"12 场 600 submits"，为转写错误（正确分母 1400）；已在该文件原地更正并标注"R7 N3 勘误"。R6 的百分比与判定不受影响（分母未参与其计算）。另有 N5 的 2×50 = 100 次 submit 属 A/A 稳定性组，不计入 A/B 分母，收据保留。

LATENCY_ACCOUNTING = **PASS**（定义披露完整、全程一致）；REQUEST_ACCOUNTING = **PASS**（分母与收据一致，R6 错误已更正）。

## 5. N4 — 正确性准入（三臂，收据 `n4-probes-{update,share,none}.log`）

| 臂 | 结果 | 判定 |
| --- | --- | --- |
| update | **8/8** T1–T8 全绿 | canonical 复现 ✓ |
| share | **8/8** 全绿 | 等价性正面证据 ✓ |
| none（负控制） | **6/8**，T2/T3 红（writer-first stale-freeze 义务探针失败） | rig 在本机咬合 ✓ |

覆盖：reader/reader 并发（T1）、reader/writer 冲突（T4/T6）、writer-first stale snapshot + **whole-transaction 40001 retry**（T2/T3）、candidate-first linearization（T4）、same-attempt save/submit 互斥（T5）、deadline scanner（T6）、**shared-lock 升级风险负控制**（T8：FOR SHARE 共存 + 并发升级 → 恰一方 40P01）、不同 exam 负控制（T7）。SQLSTATE、pg_locks/pg_blocking_pids 等待归属内嵌于探针断言（park 点 + enrollment 行锁 barrier），失败与回滚收据在 vitest 日志内。FK/RI 仍非正确性权威：share 臂 T2/T3 全绿由设计内 FOR SHARE↔FOR UPDATE 冲突承担。

CORRECTNESS_EQUIVALENCE = **PROVEN**（本机重放）。

## 6. N5 — A/A 稳定性：**PASS**

方法 = R4 §4.1 原文（canonical update 臂、S50、两次独立运行、无删样）。首次尝试两场因 wrapper 缺 PATH 失败（rc=127，未触达 DB，收据保留 `failed-attempt1-*`）；第二次 AA1 因 V1 遗留 host 字段误标 WSL 而重跑（oracle 已全对，收据保留 `failed-attempt2-*`）。修正后正式两场：

| run | makespan | p50 | p95 | p99 | 失败 | lockWaitMean |
| --- | --- | --- | --- | --- | --- | --- |
| NAT-AA1 | 2526ms | 495 | 550 | 589 | 0 | 7.59 |
| NAT-AA2 | 2305ms | 437 | 505 | 558 | 0 | 7.58 |

**p99 相对差 = 5.4% ≤ 25% → PASS**（p50 带 12.4%、p95 8.5%、makespan 9.1% 一并披露）。deadlock/rollback delta 0。

## 7. N6 — 完整交错镜像 A/B Campaign（12 场）

调度与 R6 逐字相同（R1: A50,B50,B100,A100,A200,B200；R2 精确镜像），先于运行写定。除锁模式外两臂唯一差异为被解释变量；新增 instrumentation（终态 oracle）在计时窗口之后、对两臂对称。

### 7.1 原始数据

| run | mode | S | makespan | p50 | p95 | p99 | fail | lwMean(/10) | lwMax | oracle(a/f/g/ws/d) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R1-A50 | update | 50 | 2321 | 444 | 510 | 563 | 0 | 7.58 | 9 | 50/50/50/50/50 |
| R1-B50 | share | 50 | 619 | 110 | 163 | 165 | 0 | **0** | **0** | 50/50/50/50/50 |
| R1-B100 | share | 100 | 1177 | 106 | 196 | 198 | 0 | **0** | **0** | 100/100/100/100/100 |
| R1-A100 | update | 100 | 4448 | 435 | 465 | 506 | 0 | 8.06 | 9 | 100/100/100/100/100 |
| R1-A200 | update | 200 | 8772 | 446 | 497 | 506 | 0 | 8.29 | 9 | 200/200/200/200/200 |
| R1-B200 | share | 200 | 2124 | 100 | 153 | 204 | 0 | **0** | **0** | 200/200/200/200/200 |
| R2-B200 | share | 200 | 2066 | 99 | 139 | 171 | 0 | **0** | **0** | 200/200/200/200/200 |
| R2-A200 | update | 200 | 8601 | 435 | 461 | 483 | 0 | 8.35 | 9 | 200/200/200/200/200 |
| R2-A100 | update | 100 | 4385 | 447 | 473 | 490 | 0 | 8.19 | 9 | 100/100/100/100/100 |
| R2-B100 | share | 100 | 1200 | 112 | 176 | 176 | 0 | **0** | **0** | 100/100/100/100/100 |
| R2-B50 | share | 50 | 648 | 110 | 198 | 199 | 0 | **0** | **0** | 50/50/50/50/50 |
| R2-A50 | update | 50 | 2306 | 447 | 481 | 562 | 0 | 7.53 | 9 | 50/50/50/50/50 |

oracle = attempts/frozenAnswers/terminalGrading/worksetTotal/worksetDistinctAttempts——**每一场全部等于 S**：全部答案冻结、全部终态自动评分、无重复 grading workset、无重复提交。

### 7.2 配对汇总（两场中值）与 §4.4 提名判据

| S | A p99 → B p99 | p99 改善 | p50 改善 | makespan 比 | A 臂格内 p99 带 |
| --- | --- | --- | --- | --- | --- |
| 50 | 562.5 → 182 | **67.6%**（3.09×） | 75.3% | 3.65× | 0.2% |
| 100 | 498 → 187 | **62.4%**（2.66×） | 75.3% | 3.72× | 3.2% |
| 200 | 494.5 → 187.5 | **62.1%**（2.64×） | 77.4% | 4.15× | 4.7% |

- p50 ≥30% ✓（75.3–77.4%）；p99 ≥30% ✓（62.1–67.6%）；
- 方向一致性：每格 2/2 同向、零交叉（含 A/A 共 8 个 update 场 vs 6 个 share 场完全分离：update p99 ≥483，share ≤204）；
- B 臂错误率 0、探针全绿 ✓；
- 改善 > 2× A/A 带（5.4%）✓（约 12×）。

**RESEARCH_MATERIALITY = PASS（依 R4 §4.4 事前提名方案）。OWNER_PRODUCT_THRESHOLD = NOT_YET_APPROVED**——通过研究筛选不等同产品合并批准。

### 7.3 锁级因果证据

- **Exam 行锁等待**：update 六场 lockWaitMean 7.53–8.35、峰值 9/10；share 六场自身窗口内 **0**（外部 500ms 采样 + 内部 50ms 采样双源一致）。等待事件 = `transactionid + tuple`（`analysis-native.txt`），即 #586 的 exams 单行 tuple wait 形态在原生 Linux 完整复现。
- **blocker 归因**：update 突发期 `pg_blocking_pids` 呈 convoy 树（等待者被持锁者与队首邻居同时阻塞，六场各自可见，见 `pgstat-deltas-native.txt` 同目录 `analysis-native.txt` 内 attribution 行）；share 突发期 blockers 为空。
- **事务完整性**：12 场 pg_stat delta 全部 `rollbacks+0 / deadlocks+0`（`pgstat-deltas-native.txt`），提交数随 S 线性（S50≈1.2–1.5k、S100≈2.2–2.5k、S200≈4.3–4.7k）；容器 `nr_throttled=0` 全程；实验期 PSI 无抬升。
- 死锁计数对账：`exam_test.deadlocks` 在 N4 前为 0 → N4 后为 3（两次 T8 设计死锁点 + 1 次额外检测器计数，如实记录、 confined 在预期失败臂；对 N5/N6 无影响）→ N5/N6 十四场全程不变。

### 7.4 资源负载

每场 wrapper 前后快照（loadavg/PSI×3/docker stats/容器 cpu.stat）均保存在 `n6-schedule-output.log` 与 `burst-NAT-*.log`；实验期宿主 loadavg 峰值 ~1.2/20 线程，DB 容器 CPU 峰值 ~38%（突发秒级），无 throttling、无 swap。

## 8. N7 — 因果归因（10 问）

1. **FOR UPDATE 的 Reader Convoy 在 Fedora 重现？** 是——均值 7.53–8.35/10 连接在 exams 行上等待，峰值 9，等待事件 transactionid+tuple，convoy 树归因可见。
2. **FOR SHARE 再次消除 Reader/Reader Exam 行锁等待？** 是——六场全部 0（双采样源）。
3. **Submit p99 在 S50/100/200 稳定改善？** 是——3.09×/2.66×/2.64×，六对零交叉。
4. **收益超过 A/A 噪声带？** 是——62–68% vs 5.4% 带（>10×）。
5. **新的 Writer 争用或 Reader/Writer 饥饿？** 无——负载无并发 writer；writer-first 义务由 N4 探针（T2/T3/T4/T6）证明保持；12 场 0 rollback/0 deadlock，无饥饿信号。
6. **连接池维持 10？** 是——K=10 显式建模；突发期 active=10–11，连接峰值含观察者 ≤19。
7. **新的 40001/40P01/重试放大？** 无——全部 12 场 0 rollback/0 deadlock；T8 的 40P01 仅存在于构造的负控制（N4）。
8. **FOR SHARE 瓶颈转移？** 是——单笔 p50 ≈99–112ms 与 S 无关，makespan ≈ (S/10)×~110ms：剩余限制 = 单事务计算/IO + 池宽 10，与 R6 结论相同。
9. **交错顺序排除漂移/热缓存效应？** 是——R2 为 R1 精确镜像；A 臂 R1 vs R2 p99 差 ≤3.2%（远小于被测效应），无单调时间趋势。
10. **Fedora 与 WSL2 可比边界？** 同 rig、同 PG 镜像、同负载、同统计口径 → **同主机内相对效应与机制归因可比**（p99 改善 62–68% vs 64–67%，同带）；**绝对延迟不可跨主机混合**（Fedora A 臂 p50 ≈440ms vs WSL2 ≈270ms，硬件/内核/虚拟化不同）。本报告所有跨主机比较仅限相对效果与机制形状。

## 9. N8 — 独立复审

审计由独立 subagent 在报告定稿后执行，完整输出归档于 `receipts/audit/n8-audit-report.md`；结论 **AUDIT_VERDICT = PASS（无 P1 缺陷；1×P2、5×P3，均已按以下处置修正/标注）**：

- **P2**：N1 准入时点的 loadavg/内存数字为会话内观测、无独立收据文件 → §2 已改为引用收据支持的证据链（14 场 wrapper 前后 PSI/loadavg 快照）；准入结论不受影响。
- **P3 ×5**：S200 p99 改善 62.2%→**62.1%**（§0/§7.2/§10 已更正）；失败轮计数"各 3 份"→ attempt1=2 份、attempt2=2 份（本节已更正）；§13 AB 采样器计数 14→12（12 AB + 2 AA，已更正）；`SELECT version()` 字符串补充收据 `receipts/n2-pgversion-supplement.txt`（同一运行中容器的事后补采，已注明时点）；probe 文件哈希位于 `rig/`（V1 身份锚点），不在本目录 SHA256SUMS 内，由 manifest + 实测哈希补证（§1 已注明）。

检查清单结论：1. 原生 Linux 宿主 ✓（Fedora 44 bare-metal kernel，非 WSL）；2. Sluice 共租户 ABSENT ✓；3. 环境/镜像身份完整 ✓；4. A/B 对称性 ✓（唯一差异 = EXAM_668_LOCK_MODE；oracle 对两臂对称且每场执行）；5. A/A 按预注册判据 ✓（5.4%≤25%，公式未改）；6. 请求数与收据一致 ✓（1400 = Σ outcomes，R6 erratum 已更正）；7. p99 口径一致 ✓；8. 失败轮全部保留 ✓（attempt1=2 份、attempt2=2 份，均排除于正式统计）；9. 无 R6 旧数据混入 ✓（全部标签 NAT-*，host 字段= E5，时间戳 2026-10-23）；10. 无静默重试/跳过/筛选 ✓；11. 正确性全通过 ✓（24 探针 + 1400 oracle 断言）；12. 结论未超出数据支持 ✓；13. 服务器资源清理 ✓（泄漏观察后端已终止；worktree 与收据保留待 Owner 处置，见 §12）。

**AUDIT_VERDICT = PASS（无 P1 证据缺陷）。**

## 10. 最终裁决

```text
BEGIN_EXAM_668_NATIVE_LINUX_VERDICT

BASE_SHA                  = be5b717b
CANDIDATE_SHA             = ca41b56a (rig patch exam-668-min-serialization.patch, SHA256)
HOST                      = E5 (jnhu@192.168.31.75, Fedora release 44)
KERNEL                    = 7.2.9-201.fc44.x86_64 (native, not WSL)
POSTGRES_VERSION          = PostgreSQL 18.4 (Debian 18.4-1.pgdg12+1), postgres:18.4-bookworm
TOPOLOGY                  = host-native load generator (vitest in-process) -> Docker PostgreSQL; repo compose project exam-dev, loopback-only
POOL_MAX                  = 10

ENVIRONMENT_ADMISSION     = PASS
SLUICE_CONTENTION         = ABSENT
RIG_IDENTITY              = PASS
LATENCY_ACCOUNTING        = PASS
REQUEST_ACCOUNTING        = PASS

CORRECTNESS_EQUIVALENCE   = PROVEN
AA_STABILITY              = PASS

AB_S50                    = p50 -75.3% / p99 -67.6% / makespan 3.65x
AB_S100                   = p50 -75.3% / p99 -62.4% / makespan 3.72x
AB_S200                   = p50 -77.4% / p99 -62.1% / makespan 4.15x
EXAM_LOCK_CONVOY          = REPRODUCED_UNDER_FOR_UPDATE_ELIMINATED_UNDER_FOR_SHARE (lwMean 7.53-8.35/10 peak9 -> 0/0; waits=transactionid+tuple; convoy-tree blocker attribution)
ROLLBACK_RETRY_DEADLOCK   = ZERO (12 runs: rollbacks+0 deadlocks+0; no retry amplification)

RESEARCH_MATERIALITY      = PASS
CROSS_HOST_REPLICATION    = CONFIRMED
AUDIT_VERDICT             = PASS

PRODUCTIZATION_DISCUSSION = READY
PRODUCTION_CHANGE         = NONE
POOL_CHANGE               = NONE
COMMIT_PUSH               = NONE
PR_CREATED                = NO
OWNER_DECISION_REQUIRED   = YES

END_EXAM_668_NATIVE_LINUX_VERDICT
```

**统计限制**：单机单 campaign（每格 2 次重复）；无 HTTP/nginx 层（负载为进程内编排驱动，与 R4/R6 同构）；`transaction p99` 未与 client 侧拆分仪表； Fedora×1 与 WSL2×1 两台主机不构成拓扑分布采样；30% materiality 是 R4 §4.4 提名方案，非产品标准。

## 11. 下一步（Owner 决策项，本轮不执行）

PRODUCTIZATION_DISCUSSION = READY 的含义仅为：三主机证据链（#667 Fedora 历史、R6 WSL2、R7 Fedora native）在正确性等价与 materiality 上方向一致，值得进入产品化讨论。后续需要的 Owner 决策（均**不在本轮执行**）：批准 materiality 阈值、决定永久 `findByIdForShare` 接口与锁升级防回归门禁、研究环境开关的移除方案、单一实现路径与 CI 验收、Issue #668/#558 的状态处置。

## 12. 服务器资源处置

- `exam-dev` compose 栈：**保持运行**（既有设施，非本轮创建；启动前已 Exited 3 周）；
- 本轮泄漏的 18 个 `psql \watch` 观察后端：已全部终止；
- `/tmp/exam-668-native` worktree 与 `/tmp/e668-native` 收据：保留（未删除，供 Owner 复查；`git worktree remove --force /tmp/exam-668-native` 可随时清除，全部收据已同步至本目录）；
- 主仓库 `~/Source/exam`：仅 `git pull --ff-only`（fast-forward，无本地改动被覆盖）；
- 无 commit/push/PR/Issue 状态变更。

## 13. 收据清单（`rig/native-results/`）

| 组 | 文件 |
| --- | --- |
| 身份 | `manifest.json`、`SHA256SUMS`、`transferred-files-SHA256.local.txt`、`receipts/n0-n2-identity-audit.txt` |
| N4 | `receipts/n4-probes-{update,share,none}.log` |
| N5 | `receipts/n5-aa{1,2}-update-s50.json` + `burst-NAT-AA*.log` + `sampler-NAT-AA*.txt`；失败轮 `failed-attempt{1,2}-*` |
| N6 | `receipts/n6-r{1,2}-{a,b}{50,100,200}.json`（12）+ `burst-NAT-AB-*.log`（12）+ `sampler-NAT-AB-*.txt`（12）+ `n6-schedule-output.log` |
| 派生 | `receipts/analysis-native.txt`（按窗重构 + attribution + 等待事件）、`receipts/pgstat-deltas-native.txt` |
| 装置 | `receipts/run-burst.sh`、`receipts/campaign.sh`、`rig-v2/`（V2 burst 测试 + 同版 patch）、`receipts/audit/n8-audit-report.md`、`receipts/n2-pgversion-supplement.txt` |
