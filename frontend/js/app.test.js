/**
 * 应用控制器单元测试
 * 
 * 测试需求: 1.1 - 验证应用初始化和事件绑定
 */

// 在 Node.js 环境中加载模块
let App;
if (typeof require !== 'undefined') {
  App = require('./app.js');
}

/**
 * 模拟浏览器环境
 */
function setupMockDOM() {
  // 创建模拟的 DOM 元素
  const mockElements = {
    hexInput: { value: '', addEventListener: () => {} },
    parseBtn: { addEventListener: () => {} },
    clearBtn: { addEventListener: () => {} },
    exampleSelect: { value: '', addEventListener: () => {} },
    inputError: { textContent: '', style: { display: 'none' } },
    loadingIndicator: { style: { display: 'none' } },
    resultContainer: { innerHTML: '', appendChild: () => {} },
    exportBtn: { addEventListener: () => {} },
    resultActions: { style: { display: 'none' } },
    historyList: { innerHTML: '' },
    clearHistoryBtn: { addEventListener: () => {} },
    configRateBtn: { addEventListener: () => {} },
    rateConfigDialog: { style: { display: 'none' } },
    closeDialogBtn: { addEventListener: () => {} },
    deviceAddressInput: { value: '', addEventListener: () => {} },
    ctRatioInput: { value: '', addEventListener: () => {} },
    ptRatioInput: { value: '', addEventListener: () => {} },
    saveRateBtn: { addEventListener: () => {} },
    cancelRateBtn: { addEventListener: () => {} },
    configListContainer: { innerHTML: '' },
    deviceAddressError: { textContent: '', style: { display: 'none' } },
    ctRatioError: { textContent: '', style: { display: 'none' } },
    ptRatioError: { textContent: '', style: { display: 'none' } }
  };

  // 创建模拟的 DOM 元素工厂
  function createMockElement(tagName) {
    return {
      tagName: tagName.toUpperCase(),
      className: '',
      innerHTML: '',
      textContent: '',
      style: {},
      appendChild: function(child) { 
        this.innerHTML += (child.innerHTML || child.textContent || '');
        return child;
      },
      addEventListener: () => {},
      setAttribute: () => {},
      getAttribute: () => null
    };
  }

  // 模拟 document.getElementById
  global.document = {
    getElementById: (id) => mockElements[id],
    querySelector: (selector) => {
      if (selector === '.result-actions') return mockElements.resultActions;
      return null;
    },
    createElement: createMockElement,
    addEventListener: () => {}
  };

  // 模拟 window
  global.window = {
    dlt645698Decoder: null
  };

  return mockElements;
}

/**
 * 设置全局模拟类
 */
function setupGlobalMocks() {
  global.DecoderAdapter = class {
    constructor() {}
    loadDecoder() { return Promise.resolve(); }
    validateInput(input) {
      if (!/^[0-9a-fA-F]+$/.test(input)) {
        return { valid: false, error: '输入包含非法字符，仅支持0-9和a-f' };
      }
      return { valid: true };
    }
    decode() { return []; }
    isReady() { return true; }
  };
  
  global.Storage = class {
    constructor() {}
    getHistory() { return []; }
    saveRecord() { return true; }
    clearHistory() { return true; }
  };

  global.RateConfig = class {
    constructor() {}
    getAllRates() { return {}; }
    getRate() { return null; }
    saveRate() { return true; }
    deleteRate() { return true; }
    validateDeviceAddress() { return true; }
    validateRatio() { return true; }
  };
}

/**
 * 测试 App 类构造函数
 */
function testAppConstructor() {
  console.log('\n测试: App 构造函数');
  
  try {
    setupGlobalMocks();

    const app = new App();
    
    // 验证模块已初始化
    console.assert(app.decoder !== null, 'decoder 应该被初始化');
    console.assert(app.storage !== null, 'storage 应该被初始化');
    console.assert(app.currentResult === null, 'currentResult 初始值应该为 null');
    console.assert(app.currentInput === null, 'currentInput 初始值应该为 null');
    console.assert(typeof app.elements === 'object', 'elements 应该是一个对象');
    
    console.log('✓ App 构造函数测试通过');
    return true;
  } catch (error) {
    console.error('✗ App 构造函数测试失败:', error.message);
    return false;
  }
}

/**
 * 测试 init() 方法
 */
async function testAppInit() {
  console.log('\n测试: App.init()');
  
  try {
    // 设置模拟 DOM
    setupMockDOM();
    setupGlobalMocks();

    const app = new App();
    
    // 测试 init 方法
    await app.init();
    
    // 验证 DOM 元素引用已设置
    console.assert(app.elements.hexInput !== null, 'hexInput 元素应该被引用');
    console.assert(app.elements.parseBtn !== null, 'parseBtn 元素应该被引用');
    
    console.log('✓ App.init() 测试通过');
    return true;
  } catch (error) {
    console.error('✗ App.init() 测试失败:', error.message);
    return false;
  }
}

/**
 * 测试私有方法 _showError 和 _clearError
 */
function testErrorDisplay() {
  console.log('\n测试: 错误显示方法');
  
  try {
    setupMockDOM();
    
    setupGlobalMocks();

    const app = new App();
    
    // 初始化 DOM 引用
    app._initDOMReferences();
    
    // 测试显示错误
    app._showError('测试错误消息');
    console.assert(app.elements.inputError.textContent === '测试错误消息', 
                   '错误消息应该被设置');
    console.assert(app.elements.inputError.style.display === 'block', 
                   '错误提示应该显示');
    
    // 测试清除错误
    app._clearError();
    console.assert(app.elements.inputError.textContent === '', 
                   '错误消息应该被清除');
    console.assert(app.elements.inputError.style.display === 'none', 
                   '错误提示应该隐藏');
    
    console.log('✓ 错误显示方法测试通过');
    return true;
  } catch (error) {
    console.error('✗ 错误显示方法测试失败:', error.message);
    return false;
  }
}

/**
 * 测试加载状态显示方法
 */
function testLoadingDisplay() {
  console.log('\n测试: 加载状态显示方法');
  
  try {
    setupMockDOM();
    
    setupGlobalMocks();

    const app = new App();
    app._initDOMReferences();
    
    // 测试显示加载状态
    app._showLoading();
    console.assert(app.elements.loadingIndicator.style.display === 'flex', 
                   '加载指示器应该显示');
    
    // 测试隐藏加载状态
    app._hideLoading();
    console.assert(app.elements.loadingIndicator.style.display === 'none', 
                   '加载指示器应该隐藏');
    
    console.log('✓ 加载状态显示方法测试通过');
    return true;
  } catch (error) {
    console.error('✗ 加载状态显示方法测试失败:', error.message);
    return false;
  }
}

/**
 * 测试 handleClear() 方法
 * 需求: 1.5 - 提供清空输入按钮
 */
function testHandleClear() {
  console.log('\n测试: App.handleClear()');
  
  try {
    setupMockDOM();
    
    setupGlobalMocks();

    const app = new App();
    app._initDOMReferences();
    
    // 设置一些初始值
    app.elements.hexInput.value = '68 AA AA AA AA AA AA 68';
    app.elements.exampleSelect.value = 'dlt645-2007';
    app.currentInput = '68AAAAAAAAAA68';
    app.elements.inputError.textContent = '错误消息';
    app.elements.inputError.style.display = 'block';
    
    // 添加 focus 方法
    app.elements.hexInput.focus = () => {};
    
    // 调用 handleClear
    app.handleClear();
    
    // 验证清空操作
    console.assert(app.elements.hexInput.value === '', '输入框应该被清空');
    console.assert(app.elements.exampleSelect.value === '', '示例选择器应该被重置');
    console.assert(app.currentInput === null, 'currentInput 应该被清空');
    console.assert(app.elements.inputError.textContent === '', '错误消息应该被清除');
    console.assert(app.elements.inputError.style.display === 'none', '错误提示应该隐藏');
    
    console.log('✓ App.handleClear() 测试通过');
    return true;
  } catch (error) {
    console.error('✗ App.handleClear() 测试失败:', error.message);
    return false;
  }
}

/**
 * 测试 handleExampleSelect() 方法
 * 需求: 6.2 - 自动填充示例数据
 */
function testHandleExampleSelect() {
  console.log('\n测试: App.handleExampleSelect()');
  
  try {
    setupMockDOM();
    
    setupGlobalMocks();

    const app = new App();
    app._initDOMReferences();
    
    // 添加 focus 方法
    app.elements.hexInput.focus = () => {};
    
    // 测试选择 DLT645-2007 示例
    app.handleExampleSelect('dlt645-2007');
    console.assert(app.elements.hexInput.value !== '', '输入框应该被填充');
    console.assert(app.elements.hexInput.value.includes('68'), '应该包含帧头');
    
    // 测试选择空值
    app.elements.hexInput.value = '';
    app.handleExampleSelect('');
    console.assert(app.elements.hexInput.value === '', '选择空值时不应填充');
    
    // 测试选择 DLT698 示例
    app.handleExampleSelect('dlt698');
    console.assert(app.elements.hexInput.value !== '', '输入框应该被填充');
    console.assert(app.elements.hexInput.value.length > 20, 'DLT698 示例应该较长');
    
    console.log('✓ App.handleExampleSelect() 测试通过');
    return true;
  } catch (error) {
    console.error('✗ App.handleExampleSelect() 测试失败:', error.message);
    return false;
  }
}

/**
 * 测试 handleParse() 方法 - 空输入验证
 * 需求: 2.2 - 阻止空输入
 */
function testHandleParseEmptyInput() {
  console.log('\n测试: App.handleParse() - 空输入验证');
  
  try {
    setupMockDOM();
    
    global.DecoderAdapter = class {
      constructor() {}
      loadDecoder() { return Promise.resolve(); }
      validateInput() { return { valid: false, error: '请输入十六进制数据' }; }
    };
    
    global.Storage = class {
      constructor() {}
      getHistory() { return []; }
    };
    
    // 模拟 cleanHexString 函数
    global.cleanHexString = (str) => str.replace(/\s+/g, '');

    const app = new App();
    app._initDOMReferences();
    
    // 测试空输入
    app.elements.hexInput.value = '';
    app.handleParse();
    
    // 验证错误提示
    console.assert(app.elements.inputError.textContent === '请输入十六进制数据', 
                   '应该显示空输入错误');
    console.assert(app.elements.inputError.style.display === 'block', 
                   '错误提示应该显示');
    
    // 测试只有空格的输入
    app.elements.inputError.textContent = '';
    app.elements.inputError.style.display = 'none';
    app.elements.hexInput.value = '   ';
    app.handleParse();
    
    console.assert(app.elements.inputError.textContent === '请输入十六进制数据', 
                   '应该显示空输入错误');
    
    console.log('✓ App.handleParse() 空输入验证测试通过');
    return true;
  } catch (error) {
    console.error('✗ App.handleParse() 空输入验证测试失败:', error.message);
    return false;
  }
}

/**
 * 测试 handleParse() 方法 - 输入验证
 * 需求: 1.3 - 验证输入格式
 */
function testHandleParseInputValidation() {
  console.log('\n测试: App.handleParse() - 输入验证');
  
  try {
    setupMockDOM();
    
    global.DecoderAdapter = class {
      constructor() {}
      loadDecoder() { return Promise.resolve(); }
      validateInput(input) {
        if (!/^[0-9a-fA-F]+$/.test(input)) {
          return { valid: false, error: '输入包含非法字符，仅支持0-9和a-f' };
        }
        return { valid: true, error: null };
      }
    };
    
    global.Storage = class {
      constructor() {}
      getHistory() { return []; }
    };
    
    // 模拟 cleanHexString 函数
    global.cleanHexString = (str) => str.replace(/\s+/g, '');

    const app = new App();
    app._initDOMReferences();
    
    // 测试包含非法字符的输入
    app.elements.hexInput.value = '68GGHHII';
    app.handleParse();
    
    // 验证错误提示
    console.assert(app.elements.inputError.textContent.includes('非法字符'), 
                   '应该显示非法字符错误');
    console.assert(app.elements.inputError.style.display === 'block', 
                   '错误提示应该显示');
    
    console.log('✓ App.handleParse() 输入验证测试通过');
    return true;
  } catch (error) {
    console.error('✗ App.handleParse() 输入验证测试失败:', error.message);
    return false;
  }
}

/**
 * 测试 displayError() 方法 - 格式错误
 * 需求: 8.1 - 显示具体的格式错误信息
 */
function testDisplayErrorFormatError() {
  console.log('\n测试: App.displayError() - 格式错误');
  
  try {
    setupMockDOM();
    
    setupGlobalMocks();

    const app = new App();
    app._initDOMReferences();
    
    // 模拟格式错误
    const formatError = new Error('输入包含非法字符，仅支持0-9和a-f');
    
    // 调用 displayError
    app.displayError(formatError);
    
    // 验证结果容器被更新
    console.assert(app.elements.resultContainer.innerHTML !== '', 
                   '结果容器应该包含错误信息');
    console.assert(app.elements.resultContainer.innerHTML.includes('格式错误'), 
                   '应该显示格式错误类型');
    console.assert(app.elements.resultContainer.innerHTML.includes('非法字符'), 
                   '应该包含错误原因');
    
    // 验证导出按钮被隐藏
    console.assert(app.elements.resultActions.style.display === 'none', 
                   '导出按钮应该被隐藏');
    
    console.log('✓ App.displayError() 格式错误测试通过');
    return true;
  } catch (error) {
    console.error('✗ App.displayError() 格式错误测试失败:', error.message);
    return false;
  }
}

/**
 * 测试 displayError() 方法 - 空结果错误
 * 需求: 8.2 - 提示可能的原因（数据不完整、协议不匹配）
 */
function testDisplayErrorEmptyResult() {
  console.log('\n测试: App.displayError() - 空结果错误');
  
  try {
    setupMockDOM();
    
    setupGlobalMocks();

    const app = new App();
    app._initDOMReferences();
    
    // 模拟空结果错误
    const emptyResultError = new Error('未能解析出有效数据');
    
    // 调用 displayError
    app.displayError(emptyResultError);
    
    // 验证错误信息
    console.assert(app.elements.resultContainer.innerHTML.includes('未能解析'), 
                   '应该显示未能解析错误');
    console.assert(app.elements.resultContainer.innerHTML.includes('不完整') || 
                   app.elements.resultContainer.innerHTML.includes('不匹配'), 
                   '应该包含可能的原因');
    console.assert(app.elements.resultContainer.innerHTML.includes('建议'), 
                   '应该包含恢复建议');
    
    console.log('✓ App.displayError() 空结果错误测试通过');
    return true;
  } catch (error) {
    console.error('✗ App.displayError() 空结果错误测试失败:', error.message);
    return false;
  }
}

/**
 * 测试 displayError() 方法 - 解码器异常
 * 需求: 8.3 - 捕获错误并显示友好的错误消息
 */
function testDisplayErrorDecoderException() {
  console.log('\n测试: App.displayError() - 解码器异常');
  
  try {
    setupMockDOM();
    
    setupGlobalMocks();

    const app = new App();
    app._initDOMReferences();
    
    // 模拟解码器异常
    const decoderError = new Error('解码器执行异常');
    
    // 调用 displayError
    app.displayError(decoderError);
    
    // 验证错误信息
    console.assert(app.elements.resultContainer.innerHTML.includes('解码器'), 
                   '应该显示解码器错误');
    console.assert(app.elements.resultContainer.innerHTML.includes('刷新页面') || 
                   app.elements.resultContainer.innerHTML.includes('重新加载'), 
                   '应该包含刷新建议');
    
    console.log('✓ App.displayError() 解码器异常测试通过');
    return true;
  } catch (error) {
    console.error('✗ App.displayError() 解码器异常测试失败:', error.message);
    return false;
  }
}

/**
 * 测试 displayError() 方法 - 输入数据不丢失
 * 需求: 8.4 - 错误发生时保持输入数据不丢失
 */
function testDisplayErrorPreservesInput() {
  console.log('\n测试: App.displayError() - 输入数据不丢失');
  
  try {
    setupMockDOM();
    
    setupGlobalMocks();

    const app = new App();
    app._initDOMReferences();
    
    // 设置输入数据
    const testInput = '68 AA AA AA AA AA AA 68';
    app.elements.hexInput.value = testInput;
    app.currentInput = testInput.replace(/\s+/g, '');
    
    // 模拟错误
    const error = new Error('解析失败');
    
    // 调用 displayError
    app.displayError(error);
    
    // 验证输入数据未丢失
    console.assert(app.elements.hexInput.value === testInput, 
                   '输入框中的数据应该保持不变');
    console.assert(app.currentInput !== null, 
                   'currentInput 应该保持不变');
    
    console.log('✓ App.displayError() 输入数据不丢失测试通过');
    return true;
  } catch (error) {
    console.error('✗ App.displayError() 输入数据不丢失测试失败:', error.message);
    return false;
  }
}

/**
 * 测试 displayError() 方法 - 恢复建议
 * 需求: 8.5 - 提供错误恢复建议
 */
function testDisplayErrorRecoverySuggestions() {
  console.log('\n测试: App.displayError() - 恢复建议');
  
  try {
    setupMockDOM();
    
    setupGlobalMocks();

    const app = new App();
    app._initDOMReferences();
    
    // 模拟错误
    const error = new Error('解析失败');
    
    // 调用 displayError
    app.displayError(error);
    
    // 验证包含恢复建议
    console.assert(app.elements.resultContainer.innerHTML.includes('建议'), 
                   '应该包含恢复建议标题');
    console.assert(app.elements.resultContainer.innerHTML.includes('检查') || 
                   app.elements.resultContainer.innerHTML.includes('尝试'), 
                   '应该包含具体的建议内容');
    
    // 验证包含快捷操作按钮
    console.assert(app.elements.resultContainer.innerHTML.includes('示例'), 
                   '应该包含尝试示例按钮');
    
    console.log('✓ App.displayError() 恢复建议测试通过');
    return true;
  } catch (error) {
    console.error('✗ App.displayError() 恢复建议测试失败:', error.message);
    return false;
  }
}

/**
 * 测试 _classifyError() 方法 - 错误分类
 * 需求: 8.1, 8.2, 8.3 - 正确分类不同类型的错误
 */
function testClassifyError() {
  console.log('\n测试: App._classifyError() - 错误分类');
  
  try {
    setupMockDOM();
    
    setupGlobalMocks();

    const app = new App();
    app._initDOMReferences();
    
    // 测试格式错误分类
    const formatError = new Error('输入包含非法字符');
    const formatResult = app._classifyError(formatError);
    console.assert(formatResult.message.includes('格式'), 
                   '应该识别为格式错误');
    console.assert(formatResult.reasons.length > 0, 
                   '应该包含错误原因');
    console.assert(formatResult.suggestions.length > 0, 
                   '应该包含恢复建议');
    
    // 测试空结果错误分类
    const emptyError = new Error('未能解析出有效数据');
    const emptyResult = app._classifyError(emptyError);
    console.assert(emptyResult.message.includes('未能解析'), 
                   '应该识别为空结果错误');
    console.assert(emptyResult.reasons.some(r => r.includes('不完整') || r.includes('不匹配')), 
                   '应该包含数据不完整或协议不匹配的原因');
    
    // 测试解码器异常分类
    const decoderError = new Error('解码器执行异常');
    const decoderResult = app._classifyError(decoderError);
    console.assert(decoderResult.message.includes('解码器'), 
                   '应该识别为解码器异常');
    console.assert(decoderResult.suggestions.some(s => s.includes('刷新')), 
                   '应该建议刷新页面');
    
    // 测试数据过大错误分类
    const sizeError = new Error('输入数据超过100KB限制');
    const sizeResult = app._classifyError(sizeError);
    console.assert(sizeResult.message.includes('限制'), 
                   '应该识别为大小限制错误');
    
    console.log('✓ App._classifyError() 错误分类测试通过');
    return true;
  } catch (error) {
    console.error('✗ App._classifyError() 错误分类测试失败:', error.message);
    return false;
  }
}

/**
 * 运行所有测试
 */
async function runAllTests() {
  console.log('=== 开始运行 App 单元测试 ===\n');
  
  const results = [];
  
  results.push(testAppConstructor());
  results.push(await testAppInit());
  results.push(testErrorDisplay());
  results.push(testLoadingDisplay());
  results.push(testHandleClear());
  results.push(testHandleExampleSelect());
  results.push(testHandleParseEmptyInput());
  results.push(testHandleParseInputValidation());
  results.push(testDisplayErrorFormatError());
  results.push(testDisplayErrorEmptyResult());
  results.push(testDisplayErrorDecoderException());
  results.push(testDisplayErrorPreservesInput());
  results.push(testDisplayErrorRecoverySuggestions());
  results.push(testClassifyError());
  
  const passed = results.filter(r => r === true).length;
  const total = results.length;
  
  console.log(`\n=== 测试完成: ${passed}/${total} 通过 ===`);
  
  if (passed === total) {
    console.log('✓ 所有测试通过！');
    process.exit(0);
  } else {
    console.log('✗ 部分测试失败');
    process.exit(1);
  }
}

// 如果直接运行此文件，执行测试
if (require.main === module) {
  runAllTests();
}

// 导出测试函数
module.exports = {
  testAppConstructor,
  testAppInit,
  testErrorDisplay,
  testLoadingDisplay,
  testHandleClear,
  testHandleExampleSelect,
  testHandleParseEmptyInput,
  testHandleParseInputValidation,
  testDisplayErrorFormatError,
  testDisplayErrorEmptyResult,
  testDisplayErrorDecoderException,
  testDisplayErrorPreservesInput,
  testDisplayErrorRecoverySuggestions,
  testClassifyError,
  runAllTests
};
