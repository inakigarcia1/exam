# N8 独立复审报告（EXAM-668 R7）

审计执行：独立 subagent（general-purpose），于 R7 定稿后对本目录收据与 R7-native-linux-validation.md 逐项核验。
审计方法：读取收据文件、sha256sum -c 全量校验、JSON 数值程序化复算、V1/V2 diff 逐行核对。

## 结论

AUDIT_VERDICT = PASS（无 P1 缺陷；1 项 P2、5 项 P3，全部已在 R7 中修正或标注）

## 逐项

1. 环境身份 PARTIAL(P2) — Fedora 44 原生内核/PG 18.4/RepoDigests/nr_throttled=0 有收据；准入时点 loadavg/内存数字无收据文件（会话内观测）→ R7 §2 已改为引用收据支持的证据链
2. rig 身份 PASS — sha256sum -c 全 OK；三 SHA256 与实测一致
3. A/A 判据 PASS — 589/558，|a-b|/mean = 5.41% ≤ 25%
4. 12 场 PASS — 表格数值逐场与 JSON 一致，failures=0，host=NAT/E5
5. 请求数 PASS — 1400 = Σ candidates；candidates == oracle.attempts 全成立
6. oracle PASS — 12/12 场五元组全等 S
7. 中值比率 PARTIAL(P3) — S200 p99 复算 62.1%（报告原写 62.2%，舍入误差，已更正）；其余全部精确复算成立
8. 失败轮保留 PASS(P3) — attempt1=2 份、attempt2=2 份（报告原写"各 3 份"已更正）；未参与正式统计
9. pgstat PASS — 12 场全 0 rollback / 0 deadlock
10. V1→V2 PASS — 差异恰为 os import + host 字段 + 计时后 oracle 块（+ 从属 drizzle import）；计时区间内无额外工作
11. WSL 数据分离 PASS — burst-results/ 与 revalidation-results/ 独立；native 仅 NAT-* 
12. R6 勘误 PASS — 600→1400 原地更正并标注

额外 P3：version() 字符串未收据（已补 n2-pgversion-supplement.txt）；sampler 计数 14→12（AB 12 + AA 2，已更正）；probe 哈希经 manifest+实测补证（rig/ 下，不在本目录 SHA256SUMS 内，已在 R7 §1 注明）。

## 缺陷汇总
P1: 无。P2 ×1（准入数字收据缺失，结论不受影响）。P3 ×5（均已更正/标注）。
