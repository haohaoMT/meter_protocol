#!/usr/bin/env node
/**
 * 单元测试 - Storage模块
 * 
 * 测试存储模块的所有功能:
 * - 保存查询记录
 * - 获取历史记录
 * - 清除历史记录
 * - 删除单条记录
 * - 历史记录数量限制
 * 
 * 用法：node frontend/js/storage.test.js
 */

// 模拟LocalStorage
class LocalStorageMock {
  constructor() {
    this.store = {};
  }

  getItem(key) {
    return this.store[key] || null;
  }

  setItem(key, value) {
    this.store[key] = value.toString();
  }

  removeItem(key) {
    delete this.store[key];
  }

  clear() {
    this.store = {};
  }
}

// 在Node.js环境中设置全局localStorage
if (typeof localStorage === 'undefined') {
  global.localStorage = new LocalStorageMock();
}

// 加载Storage模块
const Storage = require('./storage.js');

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

console.log('=== 测试 Storage 模块 ===\n');

// ========== saveRecord() 测试 ==========
console.log('--- saveRecord() 测试 ---');

// 每个测试前清空localStorage
localStorage.clear();
let storage = new Storage();

// 测试保存有效记录
const validRecord = {
  timestamp: Date.now(),
  input: '68 AA AA AA AA AA AA 68 11 04 33 33 33 33 16',
  result: [{ deviceKey: 'AAAAAAAAAAAA', data: {}, protocol_version: '2007' }]
};
assert(storage.saveRecord(validRecord) === true, 'saveRecord: 保存有效记录成功');
assert(storage.getHistory().length === 1, 'saveRecord: 历史记录数量为1');
assert(storage.getHistory()[0].timestamp === validRecord.timestamp, 'saveRecord: 时间戳正确保存');
assert(storage.getHistory()[0].input === validRecord.input, 'saveRecord: 输入数据正确保存');

// 测试preview字段
localStorage.clear();
storage = new Storage();
const recordWithPreview = {
  timestamp: Date.now(),
  input: '68 AA AA AA AA AA AA 68 11 04 33 33 33 33 16',
  result: []
};
storage.saveRecord(recordWithPreview);
assert(storage.getHistory()[0].preview !== undefined, 'saveRecord: preview字段存在');
assertEquals(storage.getHistory()[0].preview, recordWithPreview.input.substring(0, 50), 'saveRecord: preview为前50个字符');

// 测试无效记录
localStorage.clear();
storage = new Storage();
assert(storage.saveRecord('invalid') === false, 'saveRecord: 拒绝非对象记录');
assert(storage.saveRecord({ timestamp: Date.now(), result: [] }) === false, 'saveRecord: 拒绝缺少input字段的记录');
assert(storage.saveRecord({ timestamp: Date.now(), input: 12345, result: [] }) === false, 'saveRecord: 拒绝input非字符串的记录');
assert(storage.saveRecord({ timestamp: Date.now(), input: 'test' }) === false, 'saveRecord: 拒绝缺少result字段的记录');
assert(storage.saveRecord({ timestamp: Date.now(), input: 'test', result: 'not array' }) === false, 'saveRecord: 拒绝result非数组的记录');
assert(storage.saveRecord({ input: 'test', result: [] }) === false, 'saveRecord: 拒绝缺少timestamp字段的记录');
assert(storage.saveRecord({ timestamp: '2024-01-01', input: 'test', result: [] }) === false, 'saveRecord: 拒绝timestamp非数字的记录');

// 测试记录顺序
localStorage.clear();
storage = new Storage();
storage.saveRecord({ timestamp: 1000, input: 'first', result: [] });
storage.saveRecord({ timestamp: 2000, input: 'second', result: [] });
const history = storage.getHistory();
assert(history[0].timestamp === 2000, 'saveRecord: 新记录在前');
assert(history[1].timestamp === 1000, 'saveRecord: 旧记录在后');

// 测试数量限制（最多10条）
localStorage.clear();
storage = new Storage();
for (let i = 0; i < 11; i++) {
  storage.saveRecord({ timestamp: i, input: `record ${i}`, result: [] });
}
const limitedHistory = storage.getHistory();
assert(limitedHistory.length === 10, 'saveRecord: 历史记录限制为10条');
assert(limitedHistory.find(r => r.timestamp === 0) === undefined, 'saveRecord: 最旧记录被移除');
assert(limitedHistory.find(r => r.timestamp === 10) !== undefined, 'saveRecord: 最新记录保留');

// 测试长输入的preview截断
localStorage.clear();
storage = new Storage();
const longInput = 'A'.repeat(100);
storage.saveRecord({ timestamp: Date.now(), input: longInput, result: [] });
assert(storage.getHistory()[0].preview.length === 50, 'saveRecord: preview截断为50字符');
assert(storage.getHistory()[0].input.length === 100, 'saveRecord: 原始input保持完整');

console.log('');

// ========== getHistory() 测试 ==========
console.log('--- getHistory() 测试 ---');

// 测试空历史
localStorage.clear();
storage = new Storage();
assertDeepEquals(storage.getHistory(), [], 'getHistory: 空历史返回空数组');

// 测试返回所有记录
localStorage.clear();
storage = new Storage();
storage.saveRecord({ timestamp: 1000, input: 'first', result: [] });
storage.saveRecord({ timestamp: 2000, input: 'second', result: [] });
storage.saveRecord({ timestamp: 3000, input: 'third', result: [] });
assert(storage.getHistory().length === 3, 'getHistory: 返回所有3条记录');

// 测试排序（最新的在前）
localStorage.clear();
storage = new Storage();
storage.saveRecord({ timestamp: 2000, input: 'second', result: [] });
storage.saveRecord({ timestamp: 1000, input: 'first', result: [] });
storage.saveRecord({ timestamp: 3000, input: 'third', result: [] });
const sortedHistory = storage.getHistory();
assert(sortedHistory[0].timestamp === 3000, 'getHistory: 最新记录在第一位');
assert(sortedHistory[1].timestamp === 2000, 'getHistory: 中间记录在第二位');
assert(sortedHistory[2].timestamp === 1000, 'getHistory: 最旧记录在第三位');

// 测试处理损坏的数据
localStorage.clear();
storage = new Storage();
localStorage.setItem('decoder_history', 'invalid json');
assertDeepEquals(storage.getHistory(), [], 'getHistory: 处理无效JSON返回空数组');

localStorage.clear();
storage = new Storage();
localStorage.setItem('decoder_history', JSON.stringify({ not: 'an array' }));
assertDeepEquals(storage.getHistory(), [], 'getHistory: 处理非数组数据返回空数组');

console.log('');

// ========== clearHistory() 测试 ==========
console.log('--- clearHistory() 测试 ---');

// 测试清除历史
localStorage.clear();
storage = new Storage();
storage.saveRecord({ timestamp: 1000, input: 'test1', result: [] });
storage.saveRecord({ timestamp: 2000, input: 'test2', result: [] });
assert(storage.getHistory().length === 2, 'clearHistory: 清除前有2条记录');
assert(storage.clearHistory() === true, 'clearHistory: 清除成功');
assert(storage.getHistory().length === 0, 'clearHistory: 清除后无记录');

// 测试清除空历史
localStorage.clear();
storage = new Storage();
assert(storage.clearHistory() === true, 'clearHistory: 清除空历史也返回true');

console.log('');

// ========== deleteRecord() 测试 ==========
console.log('--- deleteRecord() 测试 ---');

// 测试删除指定记录
localStorage.clear();
storage = new Storage();
storage.saveRecord({ timestamp: 1000, input: 'test1', result: [] });
storage.saveRecord({ timestamp: 2000, input: 'test2', result: [] });
storage.saveRecord({ timestamp: 3000, input: 'test3', result: [] });
assert(storage.deleteRecord(2000) === true, 'deleteRecord: 删除成功');
const afterDelete = storage.getHistory();
assert(afterDelete.length === 2, 'deleteRecord: 删除后剩余2条记录');
assert(afterDelete.find(r => r.timestamp === 2000) === undefined, 'deleteRecord: 指定记录已删除');
assert(afterDelete.find(r => r.timestamp === 1000) !== undefined, 'deleteRecord: 其他记录保留');
assert(afterDelete.find(r => r.timestamp === 3000) !== undefined, 'deleteRecord: 其他记录保留');

// 测试删除不存在的记录
localStorage.clear();
storage = new Storage();
storage.saveRecord({ timestamp: 1000, input: 'test', result: [] });
assert(storage.deleteRecord(9999) === false, 'deleteRecord: 删除不存在的记录返回false');

// 测试无效的timestamp
localStorage.clear();
storage = new Storage();
assert(storage.deleteRecord('invalid') === false, 'deleteRecord: 拒绝非数字timestamp');

// 测试从空历史删除
localStorage.clear();
storage = new Storage();
assert(storage.deleteRecord(1000) === false, 'deleteRecord: 从空历史删除返回false');

console.log('');

// ========== isStorageAvailable() 测试 ==========
console.log('--- isStorageAvailable() 测试 ---');

localStorage.clear();
storage = new Storage();
assert(storage.isStorageAvailable() === true, 'isStorageAvailable: localStorage可用');

console.log('');

// ========== 边界情况测试 ==========
console.log('--- 边界情况测试 ---');

// 测试空输入字符串
localStorage.clear();
storage = new Storage();
assert(storage.saveRecord({ timestamp: Date.now(), input: '', result: [] }) === true, '边界: 接受空输入字符串');
assert(storage.getHistory()[0].preview === '', '边界: 空输入的preview为空');

// 测试空结果数组
localStorage.clear();
storage = new Storage();
storage.saveRecord({ timestamp: Date.now(), input: 'test', result: [] });
assertDeepEquals(storage.getHistory()[0].result, [], '边界: 保留空结果数组');

// 测试复杂结果对象
localStorage.clear();
storage = new Storage();
const complexResult = [
  {
    deviceKey: 'AAAAAAAAAAAA',
    data: { kwhp: '123.45', ua: '220.5' },
    protocol_version: '2007',
    data_identifiers: [{ id: '0000', description: 'test' }]
  }
];
storage.saveRecord({ timestamp: Date.now(), input: 'test', result: complexResult });
assertDeepEquals(storage.getHistory()[0].result, complexResult, '边界: 保留复杂结果对象');

// 测试相同timestamp的多条记录
localStorage.clear();
storage = new Storage();
const sameTimestamp = Date.now();
storage.saveRecord({ timestamp: sameTimestamp, input: 'first', result: [] });
storage.saveRecord({ timestamp: sameTimestamp, input: 'second', result: [] });
assert(storage.getHistory().length === 2, '边界: 允许相同timestamp的多条记录');

// 测试删除相同timestamp的记录
localStorage.clear();
storage = new Storage();
const deleteTimestamp = Date.now();
storage.saveRecord({ timestamp: deleteTimestamp, input: 'first', result: [] });
storage.saveRecord({ timestamp: deleteTimestamp, input: 'second', result: [] });
storage.deleteRecord(deleteTimestamp);
assert(storage.getHistory().filter(r => r.timestamp === deleteTimestamp).length === 0, '边界: 删除所有相同timestamp的记录');

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
