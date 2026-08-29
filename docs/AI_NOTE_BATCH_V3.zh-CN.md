# AI Note Batch V3 中文使用指南

AI Note Batch V3 用于把 Slax Reader 中的新文章增量同步到 Obsidian，并让 Codex 在后台完成查重、内容提示和知识连接建议。你只需要在晚上查看一张看板，勾选认可的处理建议，再执行一次 apply。

## 工作流概览

```text
在手机或电脑上把链接保存到 Slax Reader
                  ↓
手动同步，或由 Mac 每 90 分钟自动检查
                  ↓
链接进入 Obsidian：0-AI-Inbox/今日待整理.md
                  ↓
Codex 补充 AI 建议、目标路径、内容线索和关联笔记
                  ↓
你勾选认可的条目，必要时填写人工修改意见
                  ↓
运行 $ai-note-batch apply today
                  ↓
创建极简 Literature Note、追加来源引用，或仅在 Slax 保留
```

Slax Reader 始终是原始全文的保存位置。V3 不会把完整文章复制进 Vault，也不会修改 Slax 的标签、Inbox 或归档状态。

## 使用前检查

需要准备：

- 已登录的 Codex。
- 已登录的 `reader-cli`。
- 已配置的 Obsidian MCP，用于语义检索和读取相关段落。
- Obsidian 官方 CLI；在 Obsidian 的 Settings → General 中启用 Command line interface。
- apply 时 Obsidian 必须正在运行，并且当前 Vault 必须与协议指定的 Vault 完全一致。
- Vault 中恰好存在一份启用的 `ai-note-protocol`。

协议可以使用以下默认配置：

```yaml
type: ai-note-protocol
version: 2
status: active
inbox_folder: 0-AI-Inbox
batch_folder: 0-AI-Inbox/_batches
state_folder: .ai-note-review
daily_inbox_path: 0-AI-Inbox/今日待整理.md
daily_history_folder: 0-AI-Inbox/_daily
literature_folder: 002-Literature_Notes
```

## 第一次端到端验证

先不要安装后台任务。向 Slax Reader 保存一篇你确实想留下的文章，然后在 Codex 中运行：

```text
$ai-note-batch sync
```

打开 `0-AI-Inbox/今日待整理.md`，确认：

- 新链接只出现一次。
- 条目包含 AI 建议、建议目标、1–3 句内容线索和最多三个关联笔记。
- 条目保留原文链接，但没有完整文章正文。
- Slax Reader 中的文章没有被归档、删除或修改标签。

在看板中勾选该条目：

```markdown
- [x] `slax:<完整 Slax ID>` ...
```

然后运行：

```text
$ai-note-batch apply today
```

命令会先展示精确 dry-run，再执行已经勾选且分析完成的条目。完成后确认：

- 新建或更新的路径与 dry-run 一致。
- 看板的“结果”字段出现可点击的 Obsidian 笔记链接。
- 新建 Literature Note 只有来源信息、内容线索、关联笔记和空白“人工整理”区，不包含完整抓取正文。
- 再次运行 `apply today` 不会重复建卡或追加相同来源。

## 日常使用

白天只需要把链接保存到 Slax Reader。晚上打开：

```text
0-AI-Inbox/今日待整理.md
```

每个条目会给出以下信息：

- `状态`：等待分析、正在生成建议、已完成分析、后台失败或需要人工处理。
- `AI 建议`：合并、新建 Literature Note、提炼 Permanent Note、不保留或暂时无法判断。
- `建议目标`：准备创建或更新的 Vault 路径。
- `内容线索`：帮助快速回忆文章讲了什么。
- `关联`：最多三个已有笔记，以及各自的一句话关系。
- `人工修改意见`：用于覆盖 AI 建议。
- `结果`：apply 后的实际笔记链接或“仅保留于 Slax”。

勾选表示批准 AI 建议；未勾选条目完全不会执行。整理完后运行一次：

```text
$ai-note-batch apply today
```

## 人工修改意见

人工意见优先于 AI 建议。常用写法包括：

```text
人工修改意见：标题：新的标题
人工修改意见：目标：002-Literature_Notes/指定笔记.md
人工修改意见：合并到：003-Permanent_Notes/已有笔记.md
人工修改意见：不保留
人工修改意见：已自行处理
```

意见必须足够明确。无法解析的自由文本会在任何知识库写入前失败，不会由系统猜测执行。

`暂时无法判断` 默认不执行。只有人工意见明确给出目标动作，或说明已经自行处理时，才能结算。

## 五类建议分别做什么

### 新建 Literature Note

创建一张极简来源卡，包括来源 URL、Slax ID、来源标题、少量复用标签、内容线索、关联笔记和空白“人工整理”区。

### 合并

不重写目标笔记，只在目标笔记的“相关来源”下追加文章标题、URL、一句话关系和隐藏 Slax 标记。

### 提炼 Permanent Note

只创建 Literature 来源卡，并增加一个“待人工提炼 Permanent Note”任务。Codex 不代写你的个人观点。

### 不保留

不创建正式 Obsidian 笔记，仅把本地处理状态结算为 discarded。Slax 中的原文仍然保留。

### 暂时无法判断

不执行任何正式入库操作，等待补充信息或人工指定动作。

## 后台自动同步

手动流程验证无误后，可以显式安装 macOS LaunchAgent：

```text
$ai-note-batch automation install
```

安装过程会先展示以下 dry-run 信息：

- 精确 Vault 路径。
- LaunchAgent 文件路径和标识。
- 5,400 秒，即 90 分钟的检查间隔。
- Node、Codex、reader-cli 和同步程序路径。
- 标准输出和错误日志路径。

确认后才会真正安装。普通 Skill 安装、`sync` 和 `apply` 都不会创建后台任务。

查看状态：

```text
$ai-note-batch automation status
```

不等待 90 分钟，立即触发一次：

```text
$ai-note-batch automation run
```

移除后台任务：

```text
$ai-note-batch automation uninstall
```

Mac 睡眠时不会运行；唤醒后会补齐。后台任务不会主动启动 Obsidian。如果 Obsidian 或 MCP 不可用，链接仍进入看板，AI 分析会在后续运行中重试。

## 跨日归档

每天第一次同步时，前一天的完整看板会归档到：

```text
0-AI-Inbox/_daily/YYYY-MM-DD.md
```

已完成条目及其结果链接永久保留在日期归档中；未完成条目会自动进入新的“今日待整理”，并保留原始收集时间、勾选状态和人工意见。

## 抓取失败与重试

- 正文少于 200 个可见字符时，系统会跨三个同步周期自动重试。
- 连续三次失败后，条目标记为 `needs_manual`，不能 apply。
- 可以勾选条目中的“重试抓取”，让后续同步重新开始尝试。
- 超过 40,000 个可见字符的材料不会在后台深度审核，会建议使用单篇 `$ai-note-review`。
- Codex、MCP 或网络临时失败时，条目保留在看板并显示简短错误；后续同步会重试。

## 安全保证

- 后台同步只更新每日看板和机器状态，不自动修改正式知识笔记。
- 只有明确运行 `apply today` 才会处理已勾选项目。
- apply 在任何写入前检查 Obsidian、官方 CLI、Vault 路径、目标冲突和关联链接。
- 所有写入带隐藏 Slax 标记；中断后重跑不会重复创建或追加。
- apply 遇到意外失败会立即停止剩余操作。
- 不自动更新 MOC，不修改 Slax，不执行未勾选条目。

## 与旧批次工作流的关系

V3 不删除旧命令。处理历史积压时仍可使用：

```text
$ai-note-batch slax --limit 15
$ai-note-batch review <batch-id>
$ai-note-batch apply <batch-id>
```

日常新增材料优先使用 `sync` 和 `apply today`；旧批次模式只用于有意处理一组历史材料。

