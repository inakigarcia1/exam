# 管理列表 URL 查询状态 — 行为契约与 BDD 规格（#784 阶段 A3）

> Status: ACTIVE（承载 `/admin/questions` 与 `/admin/exams` 的 URL 查询状态契约）
> Baseline: master@`9546abe8a926daaf81e455427f2ffe6a5252a005`
> 来源：#784（阶段 A3；设计与 owner 裁决 OD1–OD10 见 Issue 评论，本文件是其长期权威化）。

本文冻结**已提交查询状态**在 URL 与两个管理列表之间的行为契约。实现完成后，本文件描述的就是长期行为；过程性证据（RED/GREEN/mutant 记录、浏览器见证）属于 PR 描述与 Git 历史，不进入本文。

范围：`/admin/questions`（QuestionPage）与 `/admin/exams`（ExamPage），以及从这两页进入详情/编辑/新建/导入后的返回导航。其它管理列表（Candidates/Users/AuditLog/GradingQueue/ProctorRecovery/ResultsOverview/ScoreList）不在本契约内。

## 1. 单一状态权威

```
URL → 解析/规范化（纯函数） → { filterKey, page } → API request → rendered rows
```

URL 是已提交查询状态的**唯一**权威。请求键 = `(filterKey, page)`；渲染门只按 `filterKey`（Questions）或 `queryKey`（Exams）比对。**这是两个不同的键空间**，实现与测试都必须分开：

- `idKey`（渲染键）= 当前屏幕上那批行的筛选身份（最后一次**成功**响应的身份）；
- `reqKey`（请求键）= 最后一次**结算**（成功或失败）响应所回答的确切请求。

允许的局部状态只有两类：搜索框的 draft（不进入身份与请求）与「已结算响应缓存 + 渲染门」。禁止保留 `committedSearch` / `filter*` / `page` 这类双写。

## 2. 参数表

### 2.1 `/admin/questions`

| 参数 | 类型 | 默认 | 合法值 | 非法输入 |
| --- | --- | --- | --- | --- |
| `page` | 正整数 | 1（**永不写出**） | `/^[1-9][0-9]*$/` | 视为缺省并从 URL 删除（replace） |
| `courseId` | 课程 id | 缺省 | 由**可显示性探测**判定 | 无法解析为可显示课程（格式非法 / 已删除 / 越权 404 / 400）→ 丢弃 + 规范化；**临时失败不丢弃**（见 §3.3） |
| `type` | 题型 token | 缺省 | `single_choice`/`multiple_choice`/`fill_blank`/`true_false`/`text_response` | 不在词表 → 丢弃 + 规范化 |
| `difficulty` | 整数 | 缺省 | `1`–`5` | 非整数或越界 → 丢弃 + 规范化 |
| `tags` | 逗号分隔 | 缺省 | token trim 后非空；去重；**升序排序**（默认 `sort()` 的 UTF-16 码元序，禁用 `localeCompare`） | 空 token 丢弃、重复折叠；全空 → 参数丢弃 |
| `search` | 字符串 | 缺省 | trim 后非空 | trim 后为空 → 丢弃 + 规范化 |
| 其它 | — | — | — | 补丁式写入原样保留；「清空筛选」删除全部参数；不解释、不生效、不参与身份 |

### 2.2 `/admin/exams`

| 参数 | 类型 | 默认 | 合法值 | 非法输入 |
| --- | --- | --- | --- | --- |
| `page` | 正整数 | 1（永不写出） | 同 §2.1 | 同 §2.1 |
| `status` | 考试状态 token | 缺省（= 全部） | `draft`/`published`/`open`/`closed`/`canceled`/`archived` | 不在词表（含逗号多值）→ 丢弃 + 规范化 |
| 其它 | — | — | — | 同 §2.1 |

URL 用单数 `status`，API 仍用复数 `statuses`：URL 表达「控件能表达的用户意图」，而该控件是单选。

参数名与值均大小写敏感（`search` 不做大小写折叠）。**例外**：`courseId` 的相等判定不区分大小写（zod 与 Postgres 的 uuid 比较都不区分），因此 URL 会被折回服务端的拼写（§3.2）。

## 3. 规范化与终止性

### 3.1 通用规则

- 规范化写回一律 `replace`，不产生历史记录；规范化**幂等**（规范化后再解析得到同一请求键，不触发第二次改写）。
- 重复参数取**第一个**出现值并改写为单一值。
- 越界 clamp 触发条件：仅 `items.length === 0 && page > 1`；`total <= 0` → 目标 1；否则 `lastValid = max(1, ceil(total/pageSize))`，**仅当 `lastValid < page`** 时 clamp。
- **绝不因 `page > totalPages` 丢弃非空页**：分页 SELECT 与 COUNT 是两条语句（`examRepo` / `questionRepo` 把二者放在 `Promise.all` 里各发一条），并发删除会合法产出「`items` 非空、`total` 偏小」的组合。
- clamp 期间进入 pending；`clamping` 在目标请求键**落地或失败**时清除，并在**用户发起的、请求键与 clamp 目标不同的**新导航时清除。clamp 自身的 URL 改写**不得**清除它（否则恢复窗口会塌回翻页窗口）。
- 任何由响应派生的 URL 写入（clamp、courseId 丢弃、规范化回写）只允许发生在**非 stale 分支**内，且必须仍对应当前 URL 的请求键。

### 3.2 过滤器必须可显示

任何被应用的筛选值必须能被其控件显示，并可被移除：

- `courseId` 不在已加载选项内 → 按 id 探测 `GET /api/courses/:id`（探测前必须 `encodeURIComponent`）。**已在选项内则不发请求**。
- 探测答案携带服务端的规范拼写；URL 随之折回该拼写（replace），使 URL、控件与请求指向同一门课程。不引入客户端 uuid 正则。
- 多标签中不在词表内的标签，仍必须在标签下拉中列出并可单独取消（OD9）。

### 3.3 courseId 的失败分级

| 探测结果 | 行为 |
| --- | --- |
| 解析成功 | 并入选项；URL 折回服务端拼写 |
| 404 / 400（已删除、越权、格式非法） | 丢弃该参数并 replace 规范化 |
| 其它（网络失败、5xx、超时、取消） | **保留用户意图**：参数留在 URL，页面呈现可重试的错误；不得伪装成「没有这门课」，也不得静默丢弃 |

失败结论绑定到**那个 id**：URL 不再携带它时，该失败不再呈现。

## 4. 浏览器历史契约

| 操作 | 语义 |
| --- | --- |
| 翻页（含回到第 1 页） | **push** |
| 筛选 / 状态 / 标签 / 搜索提交 | **replace** |
| 清空筛选 | **replace**（删除全部参数） |
| 规范化改写（非法值、重复参数、clamp、courseId 丢弃或折回） | **replace** |
| 进入详情 / 编辑 / 新建 / 导入 | **push** |
| 应用内部「返回列表」 | **push**（不是 `navigate(-1)`，不是 replace） |
| 侧边栏进入列表路由 | **push**，目标为裸列表 URL（侧边栏是新查询入口，不是恢复） |

「返回列表」的目标来自进入时写入的 `state.from`（`pathname + search`）。返回侧必须**严格校验**：

```
形态层：非空、以单个 "/" 开头（"" / "#x" / "?x=1" / "admin/exams" / "https:…" 一律视为缺失）
同源层：new URL(candidate, origin) 的 origin 必须等于本页 origin
         （WHATWG 解析先剥离 \t \n \r，且 "\" 是路径分隔符，故 "/\t/evil.example"
          与 "/\evil.example" 只能靠 origin 比较拦下）
路由层：解析后的 pathname 必须**恰好等于**本出口所属页面的裸列表路由
合法输入：保留 query 与 hash
```

三层任一不通过 → 回退到该出口所属页面的裸列表路由。非法目标不得把用户送到任何预期之外的位置。

## 5. 并发与一致性契约

**(a) 最新请求胜出**：任一请求键变化都发请求并递增 generation；旧响应不得改写 items/total/error/loading，**也不得执行任何 URL 写入**。

**(b) 渲染身份门**：

```
renderKeyOf(requestKey) = filterKey（Questions） | queryKey（Exams）
loadState = { idKey: renderKey | null, reqKey: requestKey | null, status: "loaded" | "failed" }
failed  = loadState.status === "failed" && loadState.reqKey === requestKey   // 失败只属于那一次请求
pending = !failed && (loadState.idKey !== renderKey || clamping || 身份未定)
呈现优先级：failed → 错误呈现；否则 pending → Loading/占位；否则 → 行/空态
```

**门按身份投影，失败绑定到具体请求。** 用 `reqKey` 与渲染键比较会让任何非第 1 页的请求结算后两键永不相等（永久 Loading）；用渲染键判失败会让「第 2 页失败 → 点下一页」在请求在途时继续显示上一次的错误行。

判定式验收清单（实现与 oracle 都按此核对）：① 首屏失败 = 错误；② 已加载 A→B 在途 = pending；③ B 失败 = 错误；④ B 失败后切到 C = pending；⑤ 同身份翻页成功（含 `page≥2`）= 渲染新切片，不得 pending；⑥ 同身份翻页失败 = 错误；⑦ clamp 中 = pending；⑧ clamp 重查失败 = 错误且脱离 pending；⑨ clamp 期间用户重新导航 = 由新请求键主导；⑩ 同身份翻页失败后再翻页 = 回到翻页窗口。

**(c) 写入原子性**：以「最近一次写入后的完整参数」为基准（`latestParams` ref），禁止以渲染期闭包中的 `searchParams` 为基准。**由交互触发的重查必须走「当前 loader」**，不能用触发那一刻的渲染闭包：删除确认可能在该轮渲染早已被替换之后才落地，用旧闭包会发出一个过时请求键的请求，而 generation guard 随后会丢弃当前查询自己的响应。

**(d) Draft 双向规则**：URL→draft 仅在 draft 等于上次提交值时才回填；观测到的 URL 与本页上一次掌握的 URL 不同 ⇒ 外部导航 ⇒ 取消未落地的 debounce 提交。本页写入（含 clamp/规范化）**不**取消用户正在输入的草稿。

**(e) 两页的翻页窗口刻意不一致**（OD7，本契约保留该不对称）：

- Questions：**同身份**翻页不开启身份门——上一页切片保持可见，桌面表体 `aria-busy` 为真，工具栏在途指示可见，不得出现任何空态；**跨身份** pending 则不得渲染旧行、不得渲染空态。
- Exams：`queryKey` 含 page，翻页也开启身份门（#785 B12 已冻结行为）。
- 统一两者必须推翻 `DesktopDataTable` 中记录在案的实测决策（占位行会把表格从 1374px 压到 170px），故不统一。

**(f) 跨身份 pending 的几何**：Questions 的 pending 主体不得渲染旧身份的行、不得渲染空态，**且不得塌陷**——列表区必须保留最后一次结算时的高度（实测锚点：20 行 ≈1374px，单占位行 ≈170px）。Exams 的 pending 主体沿用既有 `LoadingState`（#785 冻结）。

**(g) 错误呈现**：首屏失败与跨身份失败 → 页级 `ErrorState`（`role="alert"` + 重试）；同身份翻页失败 → 既有表体错误行（外壳保留，页码控件仍可用）。重试是**新的一次尝试**：必须离开错误呈现进入在途状态。

**(h) 未定义/已声明偏差**（不声称已消除）：被删除行在确认响应落地前仍可见；反向竞态（COUNT 先于批量删除）可返回自相矛盾的空页并被提交；`MobileRecordList` 无 `aria-busy`；搜索框在请求期间被禁用；页数事实存在多份显示侧拷贝。

## 6. 场景 → 测试矩阵

层级：U = 纯函数单测；L2 = 组件测试（`MemoryRouter initialEntries` + mock API）；L3 = 真实浏览器 + 真实 API/DB（`apps/e2e/e2e/admin-list-query-state.spec.ts`，事件同步，无 sleep）。

| ID | 保护的 claim | 层级 | 证据 |
| --- | --- | --- | --- |
| A01 | Questions 深链接恢复筛选+页码，且控件显示出被应用的筛选 | L2 | `QuestionPage.queryState.test.tsx` |
| A02 | 多标签 AND + 搜索 + 页码组合正确 | L2 | 同上 |
| A03 | Exams 状态+页码恢复 | L2 | `ExamPage.queryState.test.tsx` |
| A04 | 列表→详情→Back 恢复 | L3 | `admin-list-query-state.spec.ts` |
| A05 | 内部返回三情形（表头入口 / 行入口 / 刷新后 / 恶意目标） | L2 + L3 | `listReturnNavigation.pages.test.tsx`、spec |
| A06 | Back/Forward 一致；Back 后写入不复活已离开参数 | L3 + L2 | spec、两个 queryState 套件 |
| A07 | 非法/重复/过期参数不产生错误状态 | U + L2 | `listQueryState.test.ts`、queryState 套件 |
| A08 | 旧请求晚完成不覆盖新查询 | L2 | queryState 套件 |
| A09 | 跨身份 pending 不把旧结果当新结果 | L2 | queryState 套件 |
| A09b | 同身份翻页窗口有界；`page≥2` 成功后渲染新切片 | L2 | queryState 套件 |
| A10 | 越界单跳恢复、无假空态、非空页不被丢弃 | U + L2 | `listQueryState.test.ts`、queryState 套件 |
| A11 | 既有机制与既有断言零修改（#785 B01/B06/B07/B08/B11/B12） | L2 + L3 | `ExamPage.test.tsx`、`admin-list-pagination.spec.ts` |
| A12 | debounce 与筛选变更互不覆盖；外部导航取消草稿 | L2 | queryState 套件 |
| A13 | Questions 跨身份 pending 的几何不塌陷 | L3 | spec（含几何 artifact） |
| A14 | 不可显示筛选值不生效（可解析则显示，否则丢弃） | U + L2 | `listQueryState.test.ts`、queryState 套件 |
| A15 | 历史语义可观察（筛选 replace / 翻页 push / 内部返回 push） | L3 | spec（Back 栈走查 + artifact） |
| A16 | 四类失败都不得被 pending 吞掉或停留 Loading | L2 | queryState 套件 |
| A17 | 重复参数与默认值省略（钉住存活值） | U + L2 | `listQueryState.test.ts`、queryState 套件 |
| A18 | 下拉枚举并可单独移除非词表标签 | L2 | queryState 套件 |

## 7. 边界与后续

- 本契约不覆盖其它管理列表；`RecoveryQueuePage` 的 URL 机制不重构。
- 页数事实的显示侧拷贝收敛（`max(1, ceil(total/pageSize))` 出现在多处）是独立后续项。
- `MobileRecordList` 的 `aria-busy`、搜索框在请求期间的禁用属共享组件行为，未纳入本阶段。
