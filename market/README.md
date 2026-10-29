# 市场发布文件

`index.json` 是 DSH 原生“发现”的单插件索引，可从仓库的 raw URL 添加。

`submission/r-add-r--dsh-peak-idle.json` 是 1024 Store 社区目录的提交文件。提交到
`imsai-sh/awesome-deepseek-harness-plugins` 时，只新增
`catalog/plugins/r-add-r--dsh-peak-idle.json` 这一个文件；`$schema` 相对于目标目录解析。

当前原生索引使用固定提交的 GitHub 来源。发布更新时同步索引版本、提交 SHA 和 `publishTimestamp`；切换为 npm 来源前，必须先完成对应 npm 版本的发布。
