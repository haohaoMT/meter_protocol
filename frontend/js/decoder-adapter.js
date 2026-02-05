/**
 * 解码器适配器模块
 * 封装现有的 dlt645-698-decoder.js，提供统一的调用接口
 * 
 * 需求: 2.1, 2.4, 8.3
 */

class DecoderAdapter {
  constructor() {
    // 解码器模块引用
    this.decoderModule = null;
    // 加载状态
    this.loadingPromise = null;
  }

  /**
   * 异步加载解码器模块
   * 使用动态脚本加载方式，因为解码器使用 this.decode 方式定义
   * 
   * @returns {Promise<void>}
   */
  async loadDecoder() {
    // 如果已经在加载中，返回现有的 Promise
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    // 如果已经加载完成
    if (this.decoderModule) {
      return Promise.resolve();
    }

    this.loadingPromise = new Promise((resolve, reject) => {
      try {
        // 检查解码器是否已经加载到全局
        if (typeof window !== 'undefined' && window.dlt645698Decoder) {
          this.decoderModule = window.dlt645698Decoder;
          resolve();
          return;
        }

        // 在浏览器环境中，通过 fetch 加载解码器代码
        if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
          fetch('../converters/dlt645-698-decoder.js')
            .then(response => {
              if (!response.ok) {
                throw new Error('无法加载解码器文件');
              }
              return response.text();
            })
            .then(code => {
              // 创建一个对象来承载解码器
              const decoderContext = {};
              
              // 在特定上下文中执行解码器代码
              const decoderFunc = new Function(code);
              decoderFunc.call(decoderContext);
              
              // 保存到实例和全局
              this.decoderModule = decoderContext;
              window.dlt645698Decoder = decoderContext;
              
              resolve();
            })
            .catch(error => {
              console.error('加载解码器失败:', error);
              reject(new Error('无法加载解码器: ' + error.message));
            });
        } else if (typeof require !== 'undefined') {
          // Node.js 环境（用于测试）
          // 注意：解码器使用 this.decode 定义，需要特殊处理
          // 在测试环境中，我们需要创建一个上下文对象
          this.decoderModule = {};
          // 这里会在测试时通过其他方式注入
          resolve();
        } else {
          reject(new Error('不支持的运行环境'));
        }
      } catch (error) {
        console.error('加载解码器失败:', error);
        reject(error);
      }
    });

    return this.loadingPromise;
  }

  /**
   * 验证输入数据
   * 
   * @param {string} hexData - 十六进制字符串
   * @returns {{valid: boolean, error: string|null}} 验证结果
   * 
   * 需求: 1.3, 2.2, 8.1, 9.3
   */
  validateInput(hexData) {
    // 检查是否为空
    if (!hexData || hexData.trim().length === 0) {
      return {
        valid: false,
        error: '请输入十六进制数据'
      };
    }

    // 清理空白字符
    const cleaned = hexData.replace(/\s+/g, '');

    // 检查是否为有效的十六进制字符串
    const hexPattern = /^[0-9a-fA-F]+$/;
    if (!hexPattern.test(cleaned)) {
      return {
        valid: false,
        error: '输入包含非法字符，仅支持0-9和a-f'
      };
    }

    // 检查长度是否为偶数（每个字节需要2个十六进制字符）
    if (cleaned.length % 2 !== 0) {
      return {
        valid: false,
        error: '十六进制数据长度必须为偶数'
      };
    }

    // 检查数据大小限制（100KB = 100 * 1024 字节 = 204800 十六进制字符）
    const maxSize = 100 * 1024 * 2; // 100KB in hex characters
    if (cleaned.length > maxSize) {
      return {
        valid: false,
        error: '输入数据超过100KB限制'
      };
    }

    // 检查最小长度（至少需要一个完整的帧头）
    // DLT645 最小帧: 68(1) + 地址(6) + 68(1) + 控制码(1) + 数据长度(1) + 校验(1) + 16(1) = 12字节 = 24字符
    // DLT698 最小帧: 68(1) + 长度(2) + ... 至少也需要10字节以上
    if (cleaned.length < 20) {
      return {
        valid: false,
        error: '数据长度过短，无法构成有效的协议帧'
      };
    }

    return {
      valid: true,
      error: null
    };
  }

  /**
   * 解析十六进制数据
   * 
   * @param {string} hexData - 十六进制字符串
   * @param {string} gatewayNo - 网关编号（可选）
   * @returns {Promise<Array<Object>>} 解析结果数组的 Promise
   * 
   * 返回格式:
   * [{
   *   deviceKey: string,           // 设备地址
   *   data: {                      // 解析出的数据字段
   *     kwhp: string,              // 正向有功总电能
   *     ua: string,                // A相电压
   *     ia: string,                // A相电流
   *     // ... 其他字段
   *   },
   *   time: string,                // 解析时间戳
   *   protocol_version: string,    // 协议版本 ('1997', '2007', '698')
   *   data_identifiers: [          // 数据标识列表
   *     {
   *       id: string,              // 标识码
   *       description: string      // 标识描述
   *     }
   *   ],
   *   unparsed_oads: string[]      // 未解析的OAD（仅698协议）
   * }]
   * 
   * 需求: 2.1, 2.3, 2.4, 8.3
   */
  async decode(hexData, gatewayNo = '') {
    try {
      // 确保解码器已加载
      await this.loadDecoder();

      // 验证输入
      const validation = this.validateInput(hexData);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // 检查解码器是否已加载
      if (!this.decoderModule || typeof this.decoderModule.decode !== 'function') {
        throw new Error('解码器未正确加载，请刷新页面重试');
      }

      // 清理输入数据（移除空格和换行符）
      const cleanedData = hexData.replace(/\s+/g, '');

      // 调用解码器
      const msg = {
        data: cleanedData,
        gatewayNo: gatewayNo || ''
      };

      const result = this.decoderModule.decode(msg);

      // 检查结果
      if (!result) {
        throw new Error('解码器返回空结果');
      }

      // 检查是否为空数组
      if (Array.isArray(result) && result.length === 0) {
        throw new Error('未能解析出有效数据，可能原因：数据不完整、协议不匹配或数据格式错误');
      }

      // 验证结果格式
      if (!Array.isArray(result)) {
        throw new Error('解码器返回格式错误');
      }

      // 验证每个结果对象的必需字段
      for (let i = 0; i < result.length; i++) {
        const item = result[i];
        if (!item.deviceKey || !item.data || !item.protocol_version) {
          throw new Error(`解析结果第${i + 1}项缺少必需字段`);
        }
      }

      return result;

    } catch (error) {
      // 捕获并重新抛出错误，确保错误信息清晰
      if (error.message) {
        throw error;
      } else {
        throw new Error('解析过程中发生未知错误: ' + String(error));
      }
    }
  }

  /**
   * 获取错误的友好提示信息
   * 
   * @param {Error} error - 错误对象
   * @returns {string} 友好的错误提示
   * 
   * 需求: 8.2, 8.3, 8.5
   */
  getErrorMessage(error) {
    const errorMsg = error.message || String(error);

    // 根据错误类型返回友好提示
    if (errorMsg.includes('请输入十六进制数据')) {
      return '请输入十六进制数据';
    }

    if (errorMsg.includes('非法字符')) {
      return '输入包含非法字符，仅支持0-9和a-f。建议：检查输入是否包含空格或特殊字符';
    }

    if (errorMsg.includes('长度必须为偶数')) {
      return '十六进制数据长度必须为偶数。建议：检查是否缺少字符';
    }

    if (errorMsg.includes('超过100KB限制')) {
      return '输入数据超过100KB限制。建议：分批处理或减少数据量';
    }

    if (errorMsg.includes('数据长度过短')) {
      return '数据长度过短，无法构成有效的协议帧。建议：检查数据是否完整';
    }

    if (errorMsg.includes('解码器未正确加载')) {
      return '解码器未正确加载，请刷新页面重试';
    }

    if (errorMsg.includes('未能解析出有效数据')) {
      return '未能解析出有效数据。可能原因：\n' +
             '• 数据不完整（缺少帧头或帧尾）\n' +
             '• 协议不匹配（不是DLT645或DLT698协议）\n' +
             '• 数据格式错误（校验和错误）\n' +
             '建议：使用示例数据测试或检查数据来源';
    }

    if (errorMsg.includes('解码器返回空结果')) {
      return '解码器返回空结果。建议：检查数据格式是否正确';
    }

    if (errorMsg.includes('解码器返回格式错误')) {
      return '解码器返回格式错误。建议：联系技术支持';
    }

    if (errorMsg.includes('缺少必需字段')) {
      return '解析结果格式不完整。建议：联系技术支持';
    }

    // 默认错误提示
    return '解析失败：' + errorMsg + '\n建议：检查数据格式或使用示例数据测试';
  }

  /**
   * 检查解码器是否已准备好
   * 
   * @returns {boolean} 解码器是否可用
   */
  isReady() {
    return this.decoderModule !== null && 
           typeof this.decoderModule.decode === 'function';
  }
}

// 导出（用于模块化或测试）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DecoderAdapter;
}

// 浏览器环境下的全局导出
if (typeof window !== 'undefined') {
  window.DecoderAdapter = DecoderAdapter;
}
