# R4 — 突发实验结果（EXAM-668，directional only）

状态：GATE-FAILED-NO-LATENCY-CLAIM（按 R4-protocol.md §4.1 预注册方差门槛执行：**本轮不产生任何 A/B 延迟结论**；锁级机制观察按 §5 要求照常输出）
环境：WSL2（`6.18.x-microsoft-standard-WSL2`）/ PostgreSQL 18.4 / pool=10（以 K=10 个 `max:1` 专用连接显式建模，#586 KEEP_POOL_10 不变）
原始数据：`rig/burst-results/*.json`；实验文件：`rig/exam-668-submit-burst.research.test.ts`

## 1. A/A 方差门槛（§4.1）—— FAILED

| run | 模式 | S | makespan | p50 | p95 | p99 | 失败数 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A/A-1 | update | 50 | 1859ms | 346 | 402 | 404 | 0 |
| A/A-2 | update | 50 | 2569ms | 396 | 807 | 965 | 0 |

p99 相对差 ≈ 82%（门槛 25%）→ **环境尾部噪声过大，本轮放弃 A/B 延迟结论**。机制：p50 稳定（±13%）而尾部波动 >2×（WSL2 调度噪声 + 每次运行重建 schema 的 I/O 干扰）—— 恰是本实验关心的度量维度。

## 2. 机制观察（非延迟结论，§5 要求的锁级测量）

`pg_stat_activity` 每 50ms 采样，`wait_event_type='Lock'` 的活跃后端数：

| run | 模式 | S | lockWait 均值（/10 连接） | lockWait 峰值 | 采样数 |
| --- | --- | --- | --- | --- | --- |
| A/A-1/2 | update | 50 | 7.49 / 7.52 | 9 | 37 / 50 |
| MECH | update | 200 | 8.26 | 9 | 117 |
| MECH | share | 50 | **0** | **0** | 11 |
| MECH | share | 200 | **0** | **0** | 40 |
| MECH | none | 50 | 0 | 0 | 11 |

- update 臂：submit 突发期间 ~75–83% 的连接在 exams 行锁上等待 —— **#586 的"93.8% exams 单行 tuple wait"观察形态被复现**；
- share 臂：**整个突发 exams 行锁等待恒为 0** —— C/C 排队被完全消除（R1-C 预测 P-1 的锁级见证）；
- none 臂：同为 0（无锁），但正确性探针（R3）已证明该模式不可接受 —— share 以零锁等待达成 none 的并发形状，同时保留全部 C/W 义务（R3 §4）。

## 3. 方向性数字（仅记录，不构成结论）

| 对 | makespan 比 | p50 比 | p99 比 |
| --- | --- | --- | --- |
| update A/A-1 vs share S50 | 3.4× | 3.2× | 3.4× |
| update A/A-2 vs share S50 | 4.7× | 3.6× | 8.2× |
| update vs share S200 | 2.9× | 2.9× | 2.8× |

S=200 的 makespan 比（2.9×）与 PR #667 在 Fedora S200 的 2.6–2.8× 同一量级。观察到的效应量超出了实测 A/A 噪声带（p99 波动带 2.4×），方向三次一致 —— 这**符合 §4.4 阈值的字面形状**，但 §4.1 门槛已先失败，按预注册优先级不在此轮宣布 directional claim；它只用于论证"值得投入原生确认实验"的 Owner 决策输入。

## 4. 协议偏差记录

- §4.2 预注册"每臂每档 3 次"。因 §4.1 门槛失败，仅运行机制见证共 6 场（update：S50×2 A/A + S200×1；share：S50×1 + S200×1；none：S50×1），未重复满 3× 每格：门槛失败的分支下，重复延迟测量无判定力，锁级机制观察单次即可稳定分辨（0 vs 7.5 均值，噪声不可混淆）。
- 无其他偏差；停止条件未触发（B 臂错误率 0、无预期外 40P01）。

## 5. 正确性

- share 臂突发 0 失败（所有 attempt 冻结为 submitted/graded）；
- 正确性义务由 R3 探针套件承担（share 臂 8/8），突发实验不重复承担该职责。
