# 把《世界大战鼠》装到 iPhone / Android 上 📱

游戏本体是一个完全自包含的网页应用(PWA),有三条路径把它变成"手机上的 App",
从零成本到正式上架,按需选择。

## 方案 A:直接安装到主屏幕(0 成本,推荐先用这个)

游戏已带 PWA 配置(`manifest.webmanifest` + `sw.js` + 应用图标),安装后
**全屏运行、有自己的图标、离线也能玩**,体验和 App 几乎一样。

**iPhone(Safari):**
1. 用 Safari 打开 https://marsoceangpt.github.io/ChineseCards/
2. 点底部「分享」按钮(方框加箭头)
3. 选「添加到主屏幕」→ 完成!主屏幕上会出现 🐭 图标

**Android(Chrome):**
1. 用 Chrome 打开同一个链接
2. 菜单(⋮)→「安装应用」或「添加到主屏幕」
3. 完成!它会像普通 App 一样出现在应用列表里

分享给小朋友时,直接把链接发过去,再附上这两步说明即可。

## 方案 B:PWABuilder 一键生成商店安装包(最省事的上架路径)

[PWABuilder](https://www.pwabuilder.com)(微软官方工具)能把这个 PWA 打包成
可提交应用商店的安装包,全程网页操作,不用装开发环境:

1. 打开 pwabuilder.com,输入 `https://marsoceangpt.github.io/ChineseCards/`
2. 它会检测 PWA 配置(本仓库已配置好),然后选择打包目标:
   - **Android**:生成签名的 `.aab` 包 → 上传到 Google Play Console
     (需要 Google Play 开发者账号,一次性 $25)
   - **iOS**:生成 Xcode 工程 → 在 Mac 上用 Xcode 打开、构建、提交
     (需要 Apple Developer 账号,$99/年,以及一台 Mac)

## 方案 C:Capacitor 原生工程(想深度定制时用)

仓库已包含 `capacitor.config.json` 和 `package.json` 脚本:

```bash
npm install                 # 安装 Capacitor
npm run cap:android         # 生成 Android 工程并用 Android Studio 打开
npm run cap:ios             # 生成 iOS 工程并用 Xcode 打开(仅限 Mac)
```

然后在 Android Studio / Xcode 里像普通原生应用一样构建、签名、提交商店。
应用 ID 为 `com.marsocean.worldwarmouse`,可在 `capacitor.config.json` 修改。

## 上架前检查清单

- [ ] 准备商店素材:截图(游戏内已很上相)、简介文案(可抄 README)、
      512×512 图标(仓库里的 `icon-512.png`)
- [ ] 想好定价:免费 / 付费(商店后台设置,代码无需改动)
- [ ] 隐私政策:本游戏**不收集任何数据**(进度只存在设备本地),
      商店表单里如实勾选即可;若需要一个隐私政策页面链接,
      可以在仓库里加一个简单的 `privacy.html` 挂到 Pages 上
- [ ] Apple 要求 App 相比网页有"App 感":全屏 + 离线 + 图标已满足,
      审核通常没问题;如被拒可在 Capacitor 工程里加原生启动画面增强
