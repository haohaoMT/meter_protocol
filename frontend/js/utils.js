/**
 * 工具模块 - 提供通用的工具函数
 * 
 * 包含输入验证、数据格式化、文件下载等功能
 */

/**
 * 验证十六进制字符串
 * 
 * @param {string} str - 待验证的字符串
 * @returns {boolean} - 如果是有效的十六进制字符串返回true，否则返回false
 * 
 * 需求: 1.3 - 验证用户输入是否为有效的十六进制字符串
 */
function isValidHex(str) {
  if (typeof str !== 'string') {
    return false;
  }
  
  // 空字符串被认为是无效的
  if (str.length === 0) {
    return false;
  }
  
  // 检查是否只包含十六进制字符 (0-9, a-f, A-F)
  const hexPattern = /^[0-9a-fA-F]+$/;
  return hexPattern.test(str);
}

/**
 * 清理十六进制字符串（移除空格、换行等空白字符）
 * 
 * @param {string} str - 待清理的字符串
 * @returns {string} - 清理后的字符串
 * 
 * 需求: 1.2 - 自动移除空格和换行符
 */
function cleanHexString(str) {
  if (typeof str !== 'string') {
    return '';
  }
  
  // 移除所有空白字符（空格、制表符、换行符等）
  return str.replace(/\s+/g, '');
}

/**
 * 格式化时间戳为可读的日期时间字符串
 * 
 * @param {number} timestamp - Unix时间戳（毫秒）
 * @returns {string} - 格式化后的日期时间字符串 (YYYY-MM-DD HH:mm:ss)
 * 
 * 需求: 4.5 - 显示每条历史记录的时间戳
 */
function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 字段说明映射表
 * 将字段名映射到中文说明
 */
const FIELD_DESCRIPTIONS = {
  // 电能量字段
  'kwhp': '正向有功总电能 (kWh)',
  'kwhp1': '正向有功费率1电能 (kWh)',
  'kwhp2': '正向有功费率2电能 (kWh)',
  'kwhp3': '正向有功费率3电能 (kWh)',
  'kwhp4': '正向有功费率4电能 (kWh)',
  'kwhn': '反向有功总电能 (kWh)',
  'kvarhp': '正向无功总电能 (kvarh)',
  'kvarhn': '反向无功总电能 (kvarh)',
  
  // 电压字段
  'ua': 'A相电压 (V)',
  'ub': 'B相电压 (V)',
  'uc': 'C相电压 (V)',
  
  // 电流字段
  'ia': 'A相电流 (A)',
  'ib': 'B相电流 (A)',
  'ic': 'C相电流 (A)',
  'inc': '零线电流 (A)',
  
  // 功率字段
  'pt': '总有功功率 (W)',
  'pa': 'A相有功功率 (W)',
  'pb': 'B相有功功率 (W)',
  'pc': 'C相有功功率 (W)',
  'qt': '总无功功率 (var)',
  'q1': 'A相无功功率 (var)',
  'q2': 'B相无功功率 (var)',
  'q3': 'C相无功功率 (var)',
  'st': '总视在功率 (VA)',
  'sa': 'A相视在功率 (VA)',
  'sb': 'B相视在功率 (VA)',
  'sc': 'C相视在功率 (VA)',
  
  // 功率因数
  'pft': '总功率因数',
  'pf1': 'A相功率因数',
  'pf2': 'B相功率因数',
  'pf3': 'C相功率因数',
  
  // 最大需量
  'demand_max': '正向有功总最大需量 (kW)',
  'demand_max_time': '最大需量发生时间',
  
  // 其他
  'u_unbalance_rate': '电压不平衡率 (%)',
  'i_unbalance_rate': '电流不平衡率 (%)',
  'u_thd1': 'A相电压总谐波 (%)',
  'u_thd2': 'B相电压总谐波 (%)',
  'u_thd3': 'C相电压总谐波 (%)',
  'i_thd1': 'A相电流总谐波 (%)',
  'i_thd2': 'B相电流总谐波 (%)',
  'i_thd3': 'C相电流总谐波 (%)'
};

/**
 * 获取字段的中文说明
 * 
 * @param {string} fieldName - 字段名称
 * @returns {string} - 字段的中文说明，如果未找到则返回字段名本身
 * 
 * 需求: 3.4 - 以表格形式展示解析出的数据字段和值
 */
function getFieldDescription(fieldName) {
  return FIELD_DESCRIPTIONS[fieldName] || fieldName;
}

/**
 * 下载JSON文件
 * 
 * @param {object} data - 要下载的数据对象
 * @param {string} filename - 文件名
 * 
 * 需求: 5.2 - 下载包含完整解析结果的JSON文件
 */
function downloadJSON(data, filename) {
  // 将数据转换为JSON字符串，使用缩进格式化
  const jsonStr = JSON.stringify(data, null, 2);
  
  // 创建Blob对象
  const blob = new Blob([jsonStr], { type: 'application/json' });
  
  // 创建下载链接
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  
  // 触发下载
  document.body.appendChild(link);
  link.click();
  
  // 清理
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// 导出函数（用于模块化或测试）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    isValidHex,
    cleanHexString,
    formatTimestamp,
    getFieldDescription,
    downloadJSON,
    FIELD_DESCRIPTIONS
  };
}
