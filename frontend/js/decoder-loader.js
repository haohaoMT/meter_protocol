/**
 * 解码器加载器
 * 负责加载和初始化 dlt645-698-decoder.js
 * 
 * 由于原始解码器使用 this.decode 定义，需要创建一个包装器
 */

/**
 * 加载解码器脚本
 * @returns {Promise<Object>} 返回解码器对象
 */
export async function loadDecoder() {
  return new Promise((resolve, reject) => {
    // 检查是否已经加载
    if (window.dlt645698Decoder) {
      resolve(window.dlt645698Decoder);
      return;
    }

    // 创建 script 标签加载解码器
    const script = document.createElement('script');
    script.src = '../converters/dlt645-698-decoder.js';
    script.async = true;

    script.onload = () => {
      // 解码器使用 this.decode 定义，需要创建一个对象来承载
      try {
        // 创建一个新的函数上下文来执行解码器代码
        const decoderContext = {};
        
        // 由于解码器已经通过 script 标签加载，我们需要手动执行它
        // 但是由于它使用 this.decode，我们需要一个不同的方法
        
        // 方案：通过 fetch 获取解码器代码，然后在特定上下文中执行
        fetch('../converters/dlt645-698-decoder.js')
          .then(response => response.text())
          .then(code => {
            // 创建一个函数来执行代码，并绑定 this
            const decoderFunc = new Function(code);
            decoderFunc.call(decoderContext);
            
            // 保存到全局对象
            window.dlt645698Decoder = decoderContext;
            resolve(decoderContext);
          })
          .catch(error => {
            console.error('加载解码器代码失败:', error);
            reject(new Error('无法加载解码器代码'));
          });
      } catch (error) {
        console.error('初始化解码器失败:', error);
        reject(new Error('解码器初始化失败'));
      }
    };

    script.onerror = () => {
      reject(new Error('无法加载解码器脚本文件'));
    };

    document.head.appendChild(script);
  });
}

/**
 * 获取已加载的解码器
 * @returns {Object|null} 解码器对象或 null
 */
export function getDecoder() {
  return window.dlt645698Decoder || null;
}
