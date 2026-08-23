---
type: ai-note-protocol
version: 2
status: active
inbox_folder: 0-AI-Inbox
batch_folder: 0-AI-Inbox/_batches
state_folder: .ai-note-review
fleeting_folder: 001-Fleeting_Notes
literature_folder: 002-Literature_Notes
permanent_folder: 003-Permanent_Notes
moc_folder: 004-MOC_Notes
exclude_folders:
  - 099-daily_notes
  - 098-weekly_notes
  - 097-monthly_notes
  - 999-templates
---

# AI Note Protocol

本文件是 AI Agent 维护此 Obsidian 笔记库时必须遵守的协议。Vault 中只能有一个 `status: active` 的协议。

## 核心原则

- 不是所有输入都值得长期保留。
- 必须判断新内容相对旧笔记增加了什么。
- 通过索引召回少量候选，不扫描全库正文。
- 链接应表达知识关系，而不只是关键词相似。
- 用户确认前只分析，不修改笔记库。

## 审核流程

1. 提取来源、主题、主张、证据、方法和用户评论。
2. 搜索标题、URL、专有名词、关键短语和核心主张。
3. 对核心观点进行语义搜索。
4. 合并候选并比较最相关的 5–10 篇。
5. 从“不保留、合并、新建 Literature Note、提炼 Permanent Note、暂时无法判断”中选择一个结论。

## 分类与链接

目录表达来源和成熟度，标签与 MOC 表达稳定主题。每篇保留的笔记通常使用 1–3 个已有标签，并只添加能说明支持、反驳、抽象与案例、上下游或主题归属关系的链接。

## 输出要求

审核必须说明结论、置信度、核心内容、与旧笔记的实际重合和增量、入库建议，以及等待用户确认的具体操作。审核报告默认只在对话中输出。
