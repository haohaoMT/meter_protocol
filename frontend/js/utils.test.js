#!/usr/bin/env node
/**
 * 单元测试 - utils.js 工具模块
 * 
 * 用法：node frontend/js/utils.test.js
 */

const fs = require('fs');
const path = require('path');

// 加载 utils.js 模块
const utils = require('./utils.js');

// 测试计数器
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

// 测试辅助函数
function assert(condition, testName) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`✓ ${testName}`);
  } else {
    failedTests++;
    console.log(`✗ ${testName}`);
  }
}

function assertEquals(actual, expected, testName) {
  totalTests++;
  if (actual === expected) {
    passedTests++;
    console.log(`✓ ${testName}`);
  } else {
    failedTests++;
    console.log(`✗ ${testName}`);
    console.log(`  Expected: ${expected}`);
    console.log(`  Actual: ${actual}`);
  }
}

function assertDeepEquals(actual, expected, testName) {
  totalTests++;
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr === expectedStr) {
    passedTests++;
    console.log(`✓ ${testName}`);
  } else {
    failedTests++;
    console.log(`✗ ${testName}`);
    console.log(`  Expected: ${expectedStr}`);
    console.log(`  Actual: ${actualStr}`);
  }
}

console.log('=== 测试 utils.js 工具模块 ===\n');

// ========== isValidHex() 测试 ==========
console.log('--- isValidHex() 测试 ---');

// 有效的十六进制字符串
assert(utils.isValidHex('0123456789abcdef'), 'isValidHex: 有效的小写十六进制');
assert(utils.isValidHex('0123456789ABCDEF'), 'isValidHex: 有效的大写十六进制');
assert(utils.isValidHex('aAbBcCdDeEfF0123456789'), 'isValidHex: 有效的混合大小写十六进制');
assert(utils.isValidHex('68'), 'isValidHex: 短的有效十六进制');
assert(utils.isValidHex('fefefefe682c00430582646604700000'), 'isValidHex: 长的有效十六进制');

// 无效的十六进制字符串
assert(!utils.isValidHex(''), 'isValidHex: 空字符串应返回false');
assert(!utils.isValidHex('123g'), 'isValidHex: 包含非法字符g');
assert(!utils.isValidHex('12 34'), 'isValidHex: 包含空格');
assert(!utils.isValidHex('12\n34'), 'isValidHex: 包含换行符');
assert(!utils.isValidHex('12\t34'), 'isValidHex: 包含制表符');
assert(!utils.isValidHex('12-34'), 'isValidHex: 包含连字符');
assert(!utils.isValidHex('0x1234'), 'isValidHex: 包含0x前缀');
assert(!utils.isValidHex('hello'), 'isValidHex: 纯文本字符串');

// 边界情况
assert(!utils.isValidHex(null), 'isValidHex: null应返回false');
assert(!utils.isValidHex(undefined), 'isValidHex: undefined应返回false');
assert(!utils.isValidHex(123), 'isValidHex: 数字应返回false');
assert(!utils.isValidHex({}), 'isValidHex: 对象应返回false');
assert(!utils.isValidHex([]), 'isValidHex: 数组应返回false');

console.log('');

// ========== cleanHexString() 测试 ==========
console.log('--- cleanHexString() 测试 ---');

// 清理空白字符
assertEquals(utils.cleanHexString('12 34 56'), '123456', 'cleanHexString: 移除空格');
assertEquals(utils.cleanHexString('12\n34\n56'), '123456', 'cleanHexString: 移除换行符');
assertEquals(utils.cleanHexString('12\t34\t56'), '123456', 'cleanHexString: 移除制表符');
assertEquals(utils.cleanHexString('12 \n\t 34 \n\t 56'), '123456', 'cleanHexString: 移除混合空白字符');
assertEquals(utils.cleanHexString('  1234  '), '1234', 'cleanHexString: 移除首尾空格');
assertEquals(utils.cleanHexString('\n\n1234\n\n'), '1234', 'cleanHexString: 移除首尾换行符');

// 无空白字符的情况
assertEquals(utils.cleanHexString('1234567890abcdef'), '1234567890abcdef', 'cleanHexString: 无空白字符保持不变');
assertEquals(utils.cleanHexString(''), '', 'cleanHexString: 空字符串返回空字符串');

// 边界情况
assertEquals(utils.cleanHexString(null), '', 'cleanHexString: null返回空字符串');
assertEquals(utils.cleanHexString(undefined), '', 'cleanHexString: undefined返回空字符串');

// 实际使用场景
const multilineHex = `68 2c 00 43 05 82 64 66 04 70 00 00 00 e6 10 00 08 05 01 01 00 70 04 00 00 01 10 01 00 00 00 03 00 00 00 55 55 55 98 30 00 00 00 c4 04 16`;
const cleanedHex = utils.cleanHexString(multilineHex);
assertEquals(cleanedHex, '682c0043058264660470000000e61000080501010070040000011001000000030000005555559830000000c40416', 'cleanHexString: 清理多行十六进制数据');

console.log('');

// ========== formatTimestamp() 测试 ==========
console.log('--- formatTimestamp() 测试 ---');

// 测试特定时间戳
const timestamp1 = new Date('2024-01-15 10:30:45').getTime();
assertEquals(utils.formatTimestamp(timestamp1), '2024-01-15 10:30:45', 'formatTimestamp: 格式化标准时间戳');

const timestamp2 = new Date('2024-12-31 23:59:59').getTime();
assertEquals(utils.formatTimestamp(timestamp2), '2024-12-31 23:59:59', 'formatTimestamp: 格式化年末时间戳');

const timestamp3 = new Date('2024-01-01 00:00:00').getTime();
assertEquals(utils.formatTimestamp(timestamp3), '2024-01-01 00:00:00', 'formatTimestamp: 格式化年初时间戳');

// 测试当前时间（只验证格式）
const now = Date.now();
const formatted = utils.formatTimestamp(now);
const pattern = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
assert(pattern.test(formatted), 'formatTimestamp: 当前时间格式正确');

console.log('');

// ========== getFieldDescription() 测试 ==========
console.log('--- getFieldDescription() 测试 ---');

// 测试已知字段
assertEquals(utils.getFieldDescription('kwhp'), '正向有功总电能 (kWh)', 'getFieldDescription: 电能量字段');
assertEquals(utils.getFieldDescription('ua'), 'A相电压 (V)', 'getFieldDescription: 电压字段');
assertEquals(utils.getFieldDescription('ia'), 'A相电流 (A)', 'getFieldDescription: 电流字段');
assertEquals(utils.getFieldDescription('pt'), '总有功功率 (W)', 'getFieldDescription: 功率字段');
assertEquals(utils.getFieldDescription('pft'), '总功率因数', 'getFieldDescription: 功率因数字段');
assertEquals(utils.getFieldDescription('demand_max'), '正向有功总最大需量 (kW)', 'getFieldDescription: 最大需量字段');

// 测试未知字段（应返回字段名本身）
assertEquals(utils.getFieldDescription('unknown_field'), 'unknown_field', 'getFieldDescription: 未知字段返回字段名');
assertEquals(utils.getFieldDescription(''), '', 'getFieldDescription: 空字段名返回空字符串');

// 测试所有定义的字段都有描述
const fieldCount = Object.keys(utils.FIELD_DESCRIPTIONS).length;
assert(fieldCount > 30, `getFieldDescription: 字段描述表包含${fieldCount}个字段`);

console.log('');

// ========== downloadJSON() 测试 ==========
console.log('--- downloadJSON() 测试 ---');

// downloadJSON() 函数依赖浏览器环境（document, Blob, URL），在Node.js环境中无法直接测试
// 这里只验证函数存在
assert(typeof utils.downloadJSON === 'function', 'downloadJSON: 函数存在');
console.log('  注意: downloadJSON() 需要在浏览器环境中测试');

console.log('');

// ========== 测试总结 ==========
console.log('=== 测试总结 ===');
console.log(`总测试数: ${totalTests}`);
console.log(`通过: ${passedTests}`);
console.log(`失败: ${failedTests}`);

if (failedTests === 0) {
  console.log('\n✓ 所有测试通过！');
  process.exit(0);
} else {
  console.log(`\n✗ ${failedTests} 个测试失败`);
  process.exit(1);
}
