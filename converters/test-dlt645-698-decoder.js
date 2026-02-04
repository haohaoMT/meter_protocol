#!/usr/bin/env node
/**
 * 测试 dlt645-698-decoder.js 转换器（645/698 协议）
 * 用法：
 *   node test-dlt645-698-decoder.js [十六进制报文]
 *   echo "十六进制报文" | node test_dtu_tianji.js
 * 不传参数时使用内置 698 示例报文。
 */
var fs = require('fs');
var path = require('path');

var conv = {};
var code = fs.readFileSync(path.join(__dirname, 'dlt645-698-decoder.js'), 'utf8');
(new Function(code)).call(conv);

var hex = process.argv[2] || process.env.HEX_DATA || '';
if (!hex) {
  hex = 'fefefefe682c0043058264660470000000e61000080501010070040000011001000000030000005555559830000000c40416fefefefe685e00c305826466047000003fd79000458501010070040001010515000000000000000015000000000000000015000000000000000015000000000000000015000000000000000001010133200201015130010900000100040932faf437c216';
  console.log('使用内置 698 示例报文\n');
}

hex = String(hex).replace(/\s+/g, '');

var result = conv.decode({ gatewayNo: '00602025120300030067', data: hex });
console.log(JSON.stringify(result, null, 2));
