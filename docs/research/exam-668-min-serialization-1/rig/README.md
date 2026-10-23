# EXAM-668 研究装置（rig）

隔离研究设施，**不是**产品测试、不进入合并。基线：master `158dc38d`。

## 组成

| 文件 | 内容 |
| --- | --- |
| `exam-668-min-serialization.patch` | 4 个生产文件的锁模式 seam（默认行为完全不变） |
| `exam-668-serialization.research.test.ts` | T1–T8 确定性正确性探针（放置于 `apps/api/src/routes/attempts/`） |
| `evidence-none-arm-T3-40001-context.log` | none 臂 40001 RI-CONTEXT 的 PostgreSQL 日志摘录 |
| `exam-668-submit-burst.research.test.ts` | R4 提交突发方向性实验（非正式证据，见 R4-protocol.md） |
| `burst-results/` | 6 场突发的原始 JSON 结果（A/A 门槛失败如实记录；锁级机制见证） |
| `revalidation-results/` | R6 WSL2 受控复验全部原始收据（W0 审计 / W3 探针 / W1 A/A / W2 12 场 A/B / 包装器脚本），见 `../R6-wsl2-revalidation.md` |
| `native-results/` | R7 Fedora 原生 Linux 确认全部原始收据（N0–N8：身份/A-A/12 场 A/B/终态 oracle/独立复审 + manifest + SHA256SUMS），见 `../R7-native-linux-validation.md` |
| `../R5-final-report.md` | 最终裁决（R5），含 verdict block 与审计记录 |
| `../R6-wsl2-revalidation.md` | Sluice 迁离后的受控复验：AA_STABILITY=PASS、WSL_PERFORMANCE_VALUE=MATERIAL（directional）、CROSS_HOST_CONFIRMATION=REQUIRED |
| `../R7-native-linux-validation.md` | Fedora 原生确认：AA PASS、CORRECTNESS PROVEN、RESEARCH_MATERIALITY PASS、CROSS_HOST_REPLICATION CONFIRMED；PRODUCTIZATION_DISCUSSION=READY（Owner 决策门禁不变） |

## Seam 设计

`packages/exam-engine/src/deadlineReconciliation.ts` 引入：

```ts
type Exam668LockMode = "update" | "share" | "none";
function exam668LockMode(): Exam668LockMode  // EXAM_668_LOCK_MODE，默认 update
async function exam668ReadExamAuthority(...)  // 两处 deadline reader 读点经由它
```

- `update`（默认）：`findByIdForUpdate` —— 与现行代码逐字节等价的行为；
- `share`：`findByIdForShare`（patch 同时给 `examRepo`/接口/adapter 加该方法的透传）；
- `none`：`findById`（反事实负控制）。

writer / scanner / operator / restore 路径全部保持 FOR UPDATE 不动（对齐 PR #667 的范围假设）。

## 重放

```bash
git worktree add --detach /tmp/exam-668-research 158dc38d
cd /tmp/exam-668-research
git apply <path-to>/exam-668-min-serialization.patch
cp <path-to>/exam-668-serialization.research.test.ts apps/api/src/routes/attempts/
pnpm install

# 三臂（R3）
EXAM_668_LOCK_MODE=update pnpm --filter @exam/api exec vitest run \
  src/routes/attempts/exam-668-serialization.research.test.ts --reporter=verbose
EXAM_668_LOCK_MODE=share  pnpm --filter @exam/api exec vitest run ...  # 同上
EXAM_668_LOCK_MODE=none   pnpm --filter @exam/api exec vitest run ...  # 预期 T2/T3 红
```

预期结果矩阵见 `../R3-correctness-evidence.md` §1。

R6 复验突发接口（同一 burst 文件，无装置改动）：

```bash
# 单场：EXAM_668_LOCK_MODE=update|share|none，EXAM_668_BURST_CANDIDATES=S，
#       EXAM_668_BURST_OUT=<json>，EXAM_668_BURST_LABEL=<label>
# R6 使用的 12 场交错平衡调度与仪表包装见 revalidation-results/{run-burst.sh,w2-schedule.sh}
```

## 装置纪律（继承 #560/#543）

- 无 sleep 换同步：park 点 + enrollment 行锁 barrier（pg_locks txid 等待者谓词）强制交错；
- 阻塞观察是带硬截止的活跃性谓词（`pg_stat_activity` + `pg_blocking_pids`），miss 即响亮失败；
- 测试库生命周期完全走 docs/standards/testing.md §2（`APP_MODE=test` 自建库，每文件独立 schema）；
- 已知装置约束：`createPostgresDatabase` 带 schema 时 `max:1` —— 每个并发事务需要独立连接句柄（park 中的事务独占其连接）。
