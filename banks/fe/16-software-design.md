# 模块 16：软件设计

### Q16.127【高·高频】如何从零设计一个前端监控系统？需要采集哪些数据？错误怎么采集上报？整体架构是怎样的？

**考察点:** 前端监控系统采集三类数据：①错误监控（JS异常 try/catch + window.onerror + unhandledrejection + 资源加载错误）②性能监控（Performance API 拿 FP/FCP/LCP/CLS/TTFB）③用户行为（PV/UV/点击/路由跳转埋点）；架构：SDK 嵌入采集 → 上报（sendBeacon/img/批量合并）→ 服务端收集存储 → 数据清洗分析 → 可视化看板 + 告警；核心难点是采集的全面性+上报不影响性能+海量数据处理。

**参考答案要点:**
前端监控系统从零设计，分**采集什么、怎么采集、怎么上报、整体架构**四块：

**示例:**
**SDK 初始化使用**：
```javascript
import Monitor from '@my/monitor';

Monitor.init({
  appId: 'my-app',
  reportUrl: 'https://monitor.example.com/report',
  // 采样率
  sampleRate: 1.0,
  // 开启哪些监控
  jsError: true,
  resourceError: true,
  apiError: true,
  performance: true,
  behavior: ['click', 'routeChange']
});

// 主动上报
Monitor.report({ type: 'custom', msg: 'checkout_failed', userId: '123' });
```

**追问方向:**
- SourceMap 怎么反解压缩代码的错误栈？安全吗？
- sendBeacon 和 fetch keepalive 有什么区别？什么时候用哪个？
- 白屏检测有哪些方案？怎么准确判断？
- SDK 怎么保证自身报错不影响业务代码？

---
