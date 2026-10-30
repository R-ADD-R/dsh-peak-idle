# dsh-peak-idle · DSH 峰谷时段提醒

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

DeepSeek Harness 的峰谷计费时段提醒插件。在**输入框工具栏、模型选择器左侧**显示太阳／月亮图标和当前时段的剩余时间，点击查看剩余时间、优惠标记及官方 Token 定价链接。

Peak / idle billing-period indicator for DeepSeek Harness. Shows a minimal sun/moon icon and remaining duration next to the model selector. Click for a discount badge and a direct link to official token pricing; hover for secondary period details and reminder settings. Uses Beijing time and the bundled 2026 Chinese holiday calendar. No API key is required.

## 功能

- 工具栏只显示太阳／月亮和剩余时长（如 `2h 34m`）；打开详情时变为 DSH 原生蓝色。
- 主面板显示当前时段、剩余时间、未来 24 小时时间轴、一个简短的优惠标记（空闲期名称右侧显示“↓ 50%”），以及蓝色的“Token 定价”官网链接；不展示模型切换或价格明细。
- 倒计时下方显示从当前时刻起的未来 24 小时时段分布，使用北京时间刻度，跨天标注“明日”；悬停色块查看区间起止时间。
- 悬停时间或优惠标记，展开起止时间、时段规则、计费比例和官网同步信息；键盘焦点或点击同样可展开。
- 再次点击工具栏按钮、点击其他区域或按 Escape 关闭。二级信息打开时，Escape 先关闭二级信息。
- 默认在切换前 5 分钟内及实际切换时提示一次，可在时段的二级信息内关闭提醒。
- 使用 DSH 原生 `--dsw-*` 变量，跟随宿主深浅主题与字体。
- 支持键盘操作、Escape 关闭、窗口边缘避让和减少动态效果设置。
- 休眠恢复或重新聚焦后重新读取本机时钟；时段计算在本地完成，无须 API Key，不发送模型请求。
- 启动及价格超过 6 小时后，由宿主读取 DeepSeek 官方公开定价页面；也可在价格二级信息中手动同步。仅访问定价页面，不上传对话内容或 API Key。离线时使用最近核验的优惠比例，来源和同步状态在二级信息中显示。

## 安装到桌面端

要求：DSH `0.2.1-rc.2` 或之后的兼容 `0.2.x` 版本。发布包包含编译产物，不需要用户安装开发依赖。

直接下载 [dsh-fg-1.1.1.tgz 安装包](https://github.com/R-ADD-R/dsh-peak-idle/raw/refs/heads/main/releases/dsh-fg-1.1.1.tgz)，在 DSH 的 **插件 → 添加插件** 中填写下载文件的绝对路径。[SHA-256 校验值](releases/dsh-fg-1.1.1.tgz.sha256)随安装包提供。

在 DSH 桌面端打开 **插件 → 添加插件**，输入安装来源：

```text
github:R-ADD-R/dsh-peak-idle
```

完成安装并启用后，重启 DSH 或刷新界面，在任意会话的模型选择器左侧查看时段图标。

安装了 `dsh` 命令时，也可执行：

```sh
dsh plugin --profile desktop add github:R-ADD-R/dsh-peak-idle
```

Web 版使用 `--profile web`；自定义 profile 使用实际名称。仓库名为 `dsh-peak-idle`，DSH 插件内部包名为 `dsh-fg`。

**npm 包名为 `dsh-fg`。** 对应版本发布到 npm 后，也可在插件页直接输入 `dsh-fg`，或执行 `dsh plugin --profile desktop add dsh-fg`。发布版本以 [npm 页面](https://www.npmjs.com/package/dsh-fg)为准；GitHub 来源不依赖 npm 发布。

### 通过原生“发现”安装

启用 DSH 实验性插件 **自定义插件索引（Custom plugin indexes）** 后，在“发现”中添加索引源：

```text
https://raw.githubusercontent.com/R-ADD-R/dsh-peak-idle/main/market/index.json
```

该索引只列出本项目，使用固定到已验证提交的 GitHub 安装源，不依赖 npm 发布。社区市场提交文件已准备好，尚未提交收录申请。

### 其他安装方式

需要本地安装包时，在源码目录运行 `pnpm install --frozen-lockfile`、`pnpm pack:plugin`，生成 `releases/dsh-fg-1.1.1.tgz`。在 DSH 插件页填写该文件的绝对路径，或执行：

```sh
dsh plugin --profile desktop add ./dsh-fg-1.1.1.tgz
```

从已克隆的源码目录安装：

```sh
dsh plugin --profile desktop add ./dsh-peak-idle
```

仓库包含预编译的 `lib/`。源码修改后运行 `pnpm build`，再刷新 DSH；使用 npm 或发布包安装的实例需要升级到新版本。

卸载：

```sh
dsh plugin --profile desktop remove dsh-fg
```

## 真实 DSH 截图

浅色主题：

![浅色主题中的输入框图标和计费时段弹层](https://raw.githubusercontent.com/R-ADD-R/dsh-peak-idle/main/docs/screenshots/dsh-light.webp)

深色主题：

![深色主题中的输入框图标和计费时段弹层](https://raw.githubusercontent.com/R-ADD-R/dsh-peak-idle/main/docs/screenshots/dsh-dark.webp)

## 计费规则与日历

规则核对日期：**2026-10-31**。依据 [DeepSeek 官方模型与价格说明](https://api-docs.deepseek.com/zh-cn/quick_start/pricing/)，按北京时间 UTC+8 判断，与设备所在时区无关。

| 日期／时间 | 时段 |
| --- | --- |
| 周一至周五，09:00 ≤ 时间 < 12:00 | 繁忙期 |
| 周一至周五，14:00 ≤ 时间 < 18:00 | 繁忙期 |
| 其余时间、周末及中国法定节假日全天 | 空闲期 |

空闲期 token 单价为繁忙期的 **50%**。周末即使调休补班也按空闲期处理；倒计时跳过整段周末和假期，显示下一个实际切换点。

内置 2026 年[官方放假安排](https://www.gov.cn/zhengce/content/202511/content_7047090.htm)。未收录年份的工作日繁忙窗口显示“时段待核验”；晚间和周末仍可确定为空闲。新年日历发布后需更新插件，维护者在 `src/holidays.ts` 补充区间和已核验年份。

价格同步读取官网的人民币／百万 tokens 表格，逐项验证模型、缓存命中输入、未命中输入与输出价格。页面无法访问、计价单位或表格结构无法识别时保留最近成功的数据，各模型与 token 类别的优惠比例一致时，才显示一个统一的降价标记；不一致时引导查看官网。核验时间与失败状态在二级信息中显示。自动同步校验优惠比例；节假日日历和峰谷时段规则仍由插件版本维护。

插件提示 token 计价时段，不测量实时服务器负载，不改变请求发送或服务端计费。官方规则可能调整，实际费用以 DeepSeek 为准。

## 开发与验证

需要 Node.js 22+ 和 pnpm。

```sh
pnpm install --frozen-lockfile
pnpm dev             # http://127.0.0.1:5173，交互位置预览
pnpm publish:check   # 类型、构建、逻辑测试和发布文件校验
pnpm test:ui         # 本地使用已安装的 Edge；CI 使用 Chromium
pnpm pack:plugin    # 生成 releases/dsh-fg-1.1.1.tgz
```

本地预览可切换真实时间、繁忙期、空闲期、周末、节假日、即将切换和未知年份；周围界面为位置示意，插件组件与实际安装版本共用。

已通过 55 项逻辑／发布格式测试与 13 项浏览器交互测试。已在隔离的真实 DSH `0.2.1-rc.2` Web 环境验证发布包安装、原生图标、深浅主题、弹层及禁用／重新启用；浏览器无运行错误。

| 文件 | 用途 |
| --- | --- |
| `package.json`、`cordis.patch.yml` | 插件包声明与安装层 |
| `src/client.ts` | 图标及唯一提醒的槽位注册，随卸载清理 |
| `src/period.ts`、`src/holidays.ts` | 北京时间分类与日历 |
| `src/store.ts` | 共享时钟、提醒及浏览器偏好 |
| `src/pricing*.ts` | 官方价格解析、宿主同步与浏览器缓存 |
| `src/Indicator.tsx`、`src/styles.css` | 图标、弹层与主题适配 |
| `lib/` | 预编译产物，复用宿主 React |
| `market/` | 原生索引及社区市场提交元数据 |

参考：[官方插件打包与安装](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md)、[官方 UI 槽位](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/slots.md)。

MIT License。预览页使用的第三方主题变量见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
