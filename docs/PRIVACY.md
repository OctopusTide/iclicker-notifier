# Privacy policy

[English](#english) · [简体中文](#简体中文)

## English

iClicker Notifier works locally in Chrome. It has no extension server, analytics, advertising, or third-party tracking. The extension does not send page content or usage data to its developers or to another service.

### What the extension reads

On `https://student.iclicker.com/*`, the content script reads visible text, headings, question image references, answer-control availability, and the current page route. This lets it recognize a class starting or a question opening. It does not read passwords, submit answers, or attempt to retrieve locked content.

### What stays on your device

- **Local storage:** your enabled events, notification channels, language, tone, and volume. These settings are not synced through Chrome Sync.
- **Session storage:** tab IDs and status, timestamps, recent notification/error information, and event identifiers used to avoid duplicate alerts. Event identifiers can include a course/session route identifier and a hash derived from a question heading. Raw question text and images are not stored. Session state is temporary and is cleared when Chrome ends the browser session.
- **Memory:** visible page text and image references are processed to detect changes; question image references are compared as hashes in detector state.

Removing the extension removes its stored preferences. The extension contains no remote scripts and generates its sounds locally. Your normal use of the iClicker website remains subject to that website's own privacy policy.

### Why these permissions are needed

| Permission | Purpose |
| --- | --- |
| `https://student.iclicker.com/*` | Detect events on open iClicker Student pages and locate the relevant tab. |
| `storage` | Save settings and temporary runtime state. |
| `notifications` | Show optional desktop alerts. |
| `offscreen` | Play optional sound when the settings panel is closed. |

To report a privacy concern, open an issue in this repository without including private account details or course content.

## 简体中文

iClicker Notifier 在 Chrome 中本地运行，没有扩展服务器、统计分析、广告或第三方追踪，不会向开发者或其他服务发送页面内容及使用数据。

### 扩展读取什么

内容脚本只在 `https://student.iclicker.com/*` 读取可见文字、标题、题目图片引用、作答控件是否可用，以及当前页面路径，用于识别开课和新题状态。不会读取密码、提交答案或尝试获取被锁定的内容。

### 哪些数据保留在设备上

- **本地存储：** 提醒事件、通知方式、语言、音效和音量设置，不通过 Chrome Sync 同步。
- **会话存储：** 标签页编号及状态、时间、近期通知或错误信息，以及用于防止重复提醒的事件标识。事件标识可能包含课程或课堂的路径标识和题目标题的哈希值，不保存原始题目文字或图片。Chrome 结束浏览器会话后，这些临时状态会被清除。
- **运行内存：** 临时处理可见页面文字和图片引用以识别变化；检测器状态通过哈希值比较题目图片引用。

卸载扩展会删除其设置。扩展不包含远程脚本，提示音在本地生成。你正常访问 iClicker 网站时的数据处理仍适用该网站自己的隐私政策。

### 权限用途

| 权限 | 用途 |
| --- | --- |
| `https://student.iclicker.com/*` | 识别已打开的 iClicker 学生页面状态，并定位对应标签页。 |
| `storage` | 保存设置和临时运行状态。 |
| `notifications` | 显示可选的桌面通知。 |
| `offscreen` | 在设置面板关闭时播放可选提示音。 |

如有隐私问题，请在本仓库提交 issue，不要附上私人账户资料或课程内容。
