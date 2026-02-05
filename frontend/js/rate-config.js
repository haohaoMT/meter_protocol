/**
 * RateConfig 模块 - 管理CT/PT变比配置
 * 
 * 功能:
 * - 保存设备的CT/PT变比配置到LocalStorage
 * - 获取指定设备的变比配置
 * - 获取所有变比配置
 * - 删除指定设备的变比配置
 * - 验证设备地址和变比格式
 */

class RateConfig {
  constructor() {
    this.RATE_CONFIG_KEY = 'decoder_rate_config';
  }

  /**
   * 获取所有变比配置
   * @returns {Object} 配置对象，key 为设备地址，value 为 {ct, pt}
   */
  getAllRates() {
    try {
      const configJson = localStorage.getItem(this.RATE_CONFIG_KEY);
      
      if (!configJson) {
        return {};
      }

      const config = JSON.parse(configJson);
      
      // 验证返回的是对象
      if (!config || typeof config !== 'object' || Array.isArray(config)) {
        console.error('Invalid rate config data: not an object');
        return {};
      }

      return config;

    } catch (error) {
      console.error('Error getting rate config:', error);
      // 如果数据损坏，清除并返回空对象
      if (error instanceof SyntaxError) {
        console.warn('Rate config data corrupted, clearing...');
        this._clearCorruptedData();
      }
      return {};
    }
  }

  /**
   * 获取指定设备的变比配置
   * @param {string} deviceAddress - 设备地址
   * @returns {Object|null} {ct, pt} 或 null
   */
  getRate(deviceAddress) {
    try {
      if (!this.validateDeviceAddress(deviceAddress)) {
        console.error('Invalid device address format:', deviceAddress);
        return null;
      }

      const allRates = this.getAllRates();
      
      // 返回指定设备的配置，如果不存在则返回null
      return allRates[deviceAddress] || null;

    } catch (error) {
      console.error('Error getting rate for device:', deviceAddress, error);
      return null;
    }
  }

  /**
   * 保存变比配置
   * @param {string} deviceAddress - 设备地址
   * @param {string} ct - CT 变比，格式 "350/1"
   * @param {string} pt - PT 变比，格式 "2400/1"
   * @returns {boolean} 保存是否成功
   */
  saveRate(deviceAddress, ct, pt) {
    try {
      // 验证输入
      if (!this.validateDeviceAddress(deviceAddress)) {
        console.error('Invalid device address format:', deviceAddress);
        return false;
      }

      if (!this.validateRatio(ct)) {
        console.error('Invalid CT ratio format:', ct);
        return false;
      }

      if (!this.validateRatio(pt)) {
        console.error('Invalid PT ratio format:', pt);
        return false;
      }

      // 获取现有配置
      const allRates = this.getAllRates();

      // 添加或更新配置
      allRates[deviceAddress] = { ct, pt };

      // 保存到LocalStorage
      localStorage.setItem(this.RATE_CONFIG_KEY, JSON.stringify(allRates));
      return true;

    } catch (error) {
      console.error('Error saving rate config:', error);
      
      // 检查是否是存储空间不足的错误
      if (error.name === 'QuotaExceededError') {
        console.error('Storage quota exceeded. Please clear some history records or configurations.');
        return false;
      }
      
      return false;
    }
  }

  /**
   * 删除指定设备的变比配置
   * @param {string} deviceAddress - 设备地址
   * @returns {boolean} 删除是否成功
   */
  deleteRate(deviceAddress) {
    try {
      if (!this.validateDeviceAddress(deviceAddress)) {
        console.error('Invalid device address format:', deviceAddress);
        return false;
      }

      // 获取现有配置
      const allRates = this.getAllRates();

      // 检查配置是否存在
      if (!allRates[deviceAddress]) {
        console.warn('Rate config not found for device:', deviceAddress);
        return false;
      }

      // 删除配置
      delete allRates[deviceAddress];

      // 保存到LocalStorage
      localStorage.setItem(this.RATE_CONFIG_KEY, JSON.stringify(allRates));
      return true;

    } catch (error) {
      console.error('Error deleting rate config:', error);
      return false;
    }
  }

  /**
   * 验证设备地址格式
   * @param {string} address - 设备地址
   * @returns {boolean} 是否有效
   */
  validateDeviceAddress(address) {
    // 设备地址必须是12位十六进制字符
    const addressPattern = /^[0-9A-Fa-f]{12}$/;
    return typeof address === 'string' && addressPattern.test(address);
  }

  /**
   * 验证变比格式
   * @param {string} ratio - 变比字符串
   * @returns {boolean} 是否有效
   */
  validateRatio(ratio) {
    // 变比格式必须是 "数字/数字"
    const ratioPattern = /^\d+\/\d+$/;
    
    if (typeof ratio !== 'string' || !ratioPattern.test(ratio)) {
      return false;
    }

    // 解析变比值
    const parts = ratio.split('/');
    const numerator = parseInt(parts[0], 10);
    const denominator = parseInt(parts[1], 10);

    // 验证变比值范围
    // 分子: 1 - 100000
    // 分母: 1 - 100
    if (numerator < 1 || numerator > 100000) {
      return false;
    }

    if (denominator < 1 || denominator > 100) {
      return false;
    }

    return true;
  }

  /**
   * 清除损坏的数据（内部方法）
   * @private
   */
  _clearCorruptedData() {
    try {
      localStorage.removeItem(this.RATE_CONFIG_KEY);
      console.log('Corrupted rate config data cleared');
    } catch (error) {
      console.error('Error clearing corrupted data:', error);
    }
  }

  /**
   * 检查LocalStorage是否可用
   * @returns {boolean} LocalStorage是否可用
   */
  isStorageAvailable() {
    try {
      const testKey = '__rate_config_test__';
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
  module.exports = RateConfig;
}
