# R4 — 因果分析（EXAM-668）

状态：COMPLETE。将 R1 的机制预测与 R4 观察逐条对照；性能数字的地位受 R4-ab-results.md 门槛结论约束（INCONCLUSIVE），本文只回答"机制是否按预测运作"。

## P-1 — B 臂消去 C/C 排队 —— 确认（锁级）

R1 预测：submit 的 deadline reader 读点从 FOR UPDATE 降为 FOR SHARE 后，submit-vs-submit 不再在 exams 行上互斥（share/share 兼容），#586 观察到的 exams 单行 tuple wait 应消失。

观察：update 臂突发期间 lockWait 均值 7.49–8.26（峰值 9/10 连接），share 臂三场突发**恒为 0**。预测成立，且效应是开关式的（不是缩减，是消除）—— 与 R1-C"写集不相交，互斥是机制选择引入"的证明一致。

剩余等待去哪了：share 臂 makespan 仍随 S 增长（S=200 约 2.1s），瓶颈转移到 K=10 连接池与各 attempt 行/评分写 —— 这正是预期中的下一道墙（池不变是 #586 的明确决策）。

## P-2 — writer-first 场景 B 臂无改善 —— 确认（R3 探针）

R1 预测：W（extend/close/scanner）与 reader 的冲突关系在两模式下完全一致，故扩展/关闭等 writer 路径不受 share 影响。

观察（R3，非突发）：share 臂 T2/T3/T4/T6 与 update 臂逐点相同（40001 中止点、重试、writer 排队）。提交突发这种纯 C/C 负载之外的场景，两种模式行为不可区分。

## P-3 — 改善上限 = C/C 排队占等待的比例 —— 定量锚定

R1 指出 #586 只刻画了"93.8% 锁等待 = exams 单行"，未拆分其中 reader/reader 与 reader/writer 份额。本轮直接测量：纯 submit 突发（无 writer）中 exams 行等待 ~75–83% 的连接时间占比 —— 即在该负载形态下，**C/C 排队几乎构成 exams 行等待的全部**。机制上限：换成 share 后这部分等待归零；遗留等待只受池宽限制。这与 PR #667 的 2.6–2.8×（Fedora S200）和本轮方向性 2.9×（S=200，非结论）相互印证 —— 三者同一因果：消除的是同一份 C/C 排队。

## 与历史证据的一致性

| 证据 | 数字 | 本轮解释 |
| --- | --- | --- |
| #586（WSL, current mechanism） | 93.8% 锁等待 = exams 单行；S200 p99≈5.2s | update 臂复现其观察形态（75–83% 连接锁绑定） |
| PR #667（Fedora S200, unmerged） | p99 2.6–2.8× 改善 | 同一机制（仅两处 reader 读点换 share）；本轮以独立 rig 复现同量级方向 |
| R3 三臂探针（本轮） | share 8/8 与 canonical 等价 | 收益不是用正确性换的 —— 冲突语义对 W 全等 |

## 结论链（供 R5 裁决）

1. C/C 互斥是现行机制**额外引入**的成本，不是 #558 义务（R1 证明 + R3 记录 1）；
2. FOR SHARE 在同一机制内保留全部 C/W 义务与重试语义（R1 证明 + R3 share 臂 8/8）；
3. 该收益的机制（消除 C/C 排队）已被锁级观察确认（本轮），其**产品级数量**在原生环境上仍未测量（A/A 门槛失败 → INCONCLUSIVE）；
4. 因此 OWNER_DECISION_REQUIRED=YES：决策不是"要不要信 WSL 数字"，而是"是否值得一次原生 Linux/生产拓扑的确认实验 + 评审接受两处 seam 读点的锁模式变更"。

## 环境限制声明

全部数字产生于 WSL2。按研究契约 R4 条款，任何 WSL 结果不得替代 Native Linux / production-topology 证据；本文的机制结论（锁等待形态、0-vs-7.5 的开关式差异）由 PostgreSQL 行锁语义背书、对宿主拓扑不敏感，但延迟数量不具证据地位。
