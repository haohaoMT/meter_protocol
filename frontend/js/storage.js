/**
 * 存储模块 - 管理LocalStorage操作和历史记录
 * 
 * 功能:
 * - 保存查询记录到LocalStorage
 * - 获取历史记录列表
 * - 清除所有历史记录
 * - 删除单条历史记录
 * - 自动限制历史记录数量（最多10条）
 */

class Storage {
  constructor() {
    this.HISTORY_KEY = 'decoder_history';
    this.MAX_HISTORY = 10;
  }

  /**
   * 保存查询记录到LocalStorage
   * @param {Object} record - 查询记录对象
   * @param {string} record.input - 输入的十六进制数据
   * @param {Array<Object>} record.result - 解析结果数组
   * @param {number} record.timestamp - 记录时间戳
   * @returns {boolean} 保存是否成功
   */
  saveRecord(record) {
    try {
      // 验证记录对象的必需字段
      if (!record || typeof record !== 'object') {
        console.error('Invalid record: must be an object');
        return false;
      }

      if (typeof record.input !== 'string') {
        console.error('Invalid record: input must be a string');
        return false;
      }

      if (!Array.isArray(record.result)) {
        console.error('Invalid record: result must be an array');
        return false;
      }

      if (typeof record.timestamp !== 'number') {
        console.error('Invalid record: timestamp must be a number');
        return false;
      }

      // 获取现有历史记录
      const history = this.getHistory();

      // 创建新记录，添加预览文本（前50个字符）
      const newRecord = {
        timestamp: record.timestamp,
        input: record.input,
        result: record.result,
        preview: record.input.substring(0, 50)
      };

      // 将新记录添加到历史记录开头
      history.unshift(newRecord);

      // 限制历史记录数量，保留最新的MAX_HISTORY条
      if (history.length > this.MAX_HISTORY) {
        history.splice(this.MAX_HISTORY);
      }

      // 保存到LocalStorage
      localStorage.setItem(this.HISTORY_KEY, JSON.stringify(history));
      return true;

    } catch (error) {
      console.error('Error saving record:', error);
      // 检查是否是存储空间不足的错误
      if (error.name === 'QuotaExceededError') {
        // 尝试清理最旧的记录后重试
        this._cleanOldRecords();
        try {
          const history = this.getHistory();
          history.unshift({
            timestamp: record.timestamp,
            input: record.input,
            result: record.result,
            preview: record.input.substring(0, 50)
          });
          if (history.length > this.MAX_HISTORY) {
            history.splice(this.MAX_HISTORY);
          }
          localStorage.setItem(this.HISTORY_KEY, JSON.stringify(history));
          return true;
        } catch (retryError) {
          console.error('Failed to save record after cleanup:', retryError);
          return false;
        }
      }
      return false;
    }
  }

  /**
   * 获取所有历史记录
   * @returns {Array<Object>} 历史记录数组，按时间戳降序排列
   */
  getHistory() {
    try {
      const historyJson = localStorage.getItem(this.HISTORY_KEY);
      
      if (!historyJson) {
        return [];
      }

      const history = JSON.parse(historyJson);
      
      // 验证返回的是数组
      if (!Array.isArray(history)) {
        console.error('Invalid history data: not an array');
        return [];
      }

      // 确保历史记录按时间戳降序排列（最新的在前）
      history.sort((a, b) => b.timestamp - a.timestamp);

      return history;

    } catch (error) {
      console.error('Error getting history:', error);
      return [];
    }
  }

  /**
   * 清除所有历史记录
   * @returns {boolean} 清除是否成功
   */
  clearHistory() {
    try {
      localStorage.removeItem(this.HISTORY_KEY);
      return true;
    } catch (error) {
      console.error('Error clearing history:', error);
      return false;
    }
  }

  /**
   * 删除单条历史记录
   * @param {number} timestamp - 要删除的记录的时间戳
   * @returns {boolean} 删除是否成功
   */
  deleteRecord(timestamp) {
    try {
      if (typeof timestamp !== 'number') {
        console.error('Invalid timestamp: must be a number');
        return false;
      }

      const history = this.getHistory();
      
      // 过滤掉指定时间戳的记录
      const filteredHistory = history.filter(record => record.timestamp !== timestamp);

      // 如果过滤后的长度没有变化，说明没有找到该记录
      if (filteredHistory.length === history.length) {
        console.warn('Record not found with timestamp:', timestamp);
        return false;
      }

      // 保存过滤后的历史记录
      localStorage.setItem(this.HISTORY_KEY, JSON.stringify(filteredHistory));
      return true;

    } catch (error) {
      console.error('Error deleting record:', error);
      return false;
    }
  }

  /**
   * 清理最旧的记录（内部方法，用于处理存储空间不足）
   * @private
   */
  _cleanOldRecords() {
    try {
      const history = this.getHistory();
      
      // 只保留最新的一半记录
      const keepCount = Math.floor(this.MAX_HISTORY / 2);
      const cleanedHistory = history.slice(0, keepCount);
      
      localStorage.setItem(this.HISTORY_KEY, JSON.stringify(cleanedHistory));
      console.log(`Cleaned old records, kept ${keepCount} most recent records`);
      
    } catch (error) {
      console.error('Error cleaning old records:', error);
    }
  }

  /**
   * 检查LocalStorage是否可用
   * @returns {boolean} LocalStorage是否可用
   */
  isStorageAvailable() {
    try {
      const testKey = '__storage_test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch (error) {
      return false;
    }
  }
}

// 导出模块（支持ES6模块和全局变量两种方式）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Storage;
}
