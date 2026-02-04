# 电能表通信协议解析器

电能表通信协议数据解析工具，支持 DL/T 645-1997、DL/T 645-2007 和 DL/T 698.45-2017 协议。

## 支持的协议

- **DL/T 645-1997** - 多功能电能表通信协议（旧版）
- **DL/T 645-2007** - 多功能电能表通信协议
- **DL/T 698.45-2017** - 电能信息采集与管理系统 第 4-5 部分：面向对象的数据交换协议

## 功能特性

- 解析电能量数据（正向/反向有功、无功电能）
- 解析实时测量数据（电压、电流、功率、功率因数）
- 解析最大需量及发生时间
- 支持 CT/PT 倍率自动换算
- 兼容 Nashorn JavaScript 引擎（ECMAScript 5.1）

## 文件结构

```
meter_protocol/
├── converters/
│   ├── dlt645-698-decoder.js          # 主解析器
│   └── test-dlt645-698-decoder.js     # 测试脚本
├── protocol/                           # 协议文档
│   ├── DL:T 698.45-2017.pdf
│   ├── DLT645-1997.pdf
│   └── DLT645-2007.pdf
└── README.md
```

## 使用方法

### 基本用法

```javascript
// 加载解析器
var decoder = require('./converters/dlt645-698-decoder.js');

// 解析报文
var result = decoder.decode({
    gatewayNo: '网关编号',
    data: '十六进制报文数据'
});

console.log(result);
```

### 测试脚本

```bash
# 使用命令行参数
node converters/test-dlt645-698-decoder.js [十六进制报文]

# 使用管道输入
echo "十六进制报文" | node converters/test-dlt645-698-decoder.js

# 使用内置示例
node converters/test-dlt645-698-decoder.js
```

## 配置 CT/PT 倍率

在 `dlt645-698-decoder.js` 文件顶部配置设备倍率：

```javascript
var deviceRates = {
    "设备地址": { 
        "ct": "电流互感器变比(如 350/1)", 
        "pt": "电压互感器变比(如 2400/1)" 
    }
};
```

## 输出数据格式

解析后的数据包含以下字段（根据报文内容动态生成）：

### 电能量
- `kwhp` - 正向有功总电能 (kWh)
- `kwhp1-4` - 正向有功费率1-4电能
- `kwhn` - 反向有功总电能
- `kvarhp` - 正向无功总电能 (kvarh)

### 实时测量
- `ua`, `ub`, `uc` - 三相电压 (V)
- `ia`, `ib`, `ic` - 三相电流 (A)
- `pt`, `pa`, `pb`, `pc` - 总及各相有功功率 (W)
- `qt`, `q1`, `q2`, `q3` - 总及各相无功功率 (var)
- `pft`, `pf1`, `pf2`, `pf3` - 总及各相功率因数

### 最大需量
- `demand_max` - 正向有功最大需量 (kW)

## 协议参考

详细协议规范请参考 `protocol/` 目录下的 PDF 文档。

## 注意事项

- 代码基于 ECMAScript 5.1 标准，兼容 Nashorn 引擎
- 不支持 ES2020 的 BigInt，使用手动解析处理大整数
- CT/PT 倍率需根据现场实际配置
