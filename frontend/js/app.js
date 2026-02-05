/**
 * 应用控制器 - 协调各模块交互，处理用户事件，管理应用状态
 * 
 * 需求: 1.1 - 提供完整的前端查询页面功能
 */

// 导入工具函数（在浏览器环境中通过script标签加载）
// 导入其他模块（在浏览器环境中通过script标签加载）

/**
 * 示例数据常量
 * 需求: 6.1, 6.3, 6.4 - 提供不同协议的示例数据
 */
const EXAMPLE_DATA = {
  'dlt645-1997': {
    data: '68 AA AA AA AA AA AA 68 11 04 33 33 33 33 16',
    description: 'DLT645-1997 读取数据示例（读取当前组合有功总电能）'
  },
  'dlt645-2007': {
    data: 'fefefefe683d00c305056566047000002d43900024850101200a02000101041003cd1003cd1003d31003cd01010133200201015130010900000100043f4874ca602916',
    description: 'DLT645-2007 读取数据示例（读取总及各相功率因数数组）'
  },
  'dlt698': {
    data: 'fefefefe682c0043058264660470000000e61000080501010070040000011001000000030000005555559830000000c40416',
    description: 'DLT698.45-2017 读取数据示例（读取电能量和电压电流数据）'
  }
};

/**
 * 应用主控制器类
 */
class App {
  /**
   * 构造函数 - 初始化各模块
   */
  constructor() {
    // 初始化各个模块
    this.decoder = new DecoderAdapter();
    this.storage = new Storage();
    this.rateConfig = new RateConfig();
    
    // 当前解析结果
    this.currentResult = null;
    
    // 当前输入数据
    this.currentInput = null;
    
    // DOM 元素引用
    this.elements = {
      // 输入区域
      hexInput: null,
      parseBtn: null,
      clearBtn: null,
      exampleSelect: null,
      inputError: null,
      configRateBtn: null,
      
      // 结果区域
      loadingIndicator: null,
      resultContainer: null,
      exportBtn: null,
      resultActions: null,
      
      // 历史记录区域
      historyList: null,
      clearHistoryBtn: null,
      
      // 配置对话框区域
      rateConfigDialog: null,
      closeDialogBtn: null,
      deviceAddressInput: null,
      ctRatioInput: null,
      ptRatioInput: null,
      saveRateBtn: null,
      cancelRateBtn: null,
      configListContainer: null,
      deviceAddressError: null,
      ctRatioError: null,
      ptRatioError: null
    };
  }

  /**
   * 初始化应用
   * 绑定UI事件监听器，初始化各个模块
   * 
   * 需求: 1.1 - 初始化应用并绑定事件
   */
  async init() {
    try {
      // 获取DOM元素引用
      this._initDOMReferences();
      
      // 绑定事件监听器
      this._bindEventListeners();
      
      // 加载解码器
      await this._loadDecoder();
      
      // 加载历史记录
      this.loadHistory();
      
      console.log('应用初始化完成');
    } catch (error) {
      console.error('应用初始化失败:', error);
      this._showError('应用初始化失败: ' + error.message);
    }
  }

  /**
   * 初始化DOM元素引用
   * @private
   */
  _initDOMReferences() {
    // 输入区域
    this.elements.hexInput = document.getElementById('hexInput');
    this.elements.parseBtn = document.getElementById('parseBtn');
    this.elements.clearBtn = document.getElementById('clearBtn');
    this.elements.exampleSelect = document.getElementById('exampleSelect');
    this.elements.inputError = document.getElementById('inputError');
    this.elements.configRateBtn = document.getElementById('configRateBtn');
    
    // 结果区域
    this.elements.loadingIndicator = document.getElementById('loadingIndicator');
    this.elements.resultContainer = document.getElementById('resultContainer');
    this.elements.exportBtn = document.getElementById('exportBtn');
    this.elements.resultActions = document.querySelector('.result-actions');
    
    // 历史记录区域
    this.elements.historyList = document.getElementById('historyList');
    this.elements.clearHistoryBtn = document.getElementById('clearHistoryBtn');
    
    // 配置对话框区域
    this.elements.rateConfigDialog = document.getElementById('rateConfigDialog');
    this.elements.closeDialogBtn = document.getElementById('closeDialogBtn');
    this.elements.deviceAddressInput = document.getElementById('deviceAddressInput');
    this.elements.ctRatioInput = document.getElementById('ctRatioInput');
    this.elements.ptRatioInput = document.getElementById('ptRatioInput');
    this.elements.saveRateBtn = document.getElementById('saveRateBtn');
    this.elements.cancelRateBtn = document.getElementById('cancelRateBtn');
    this.elements.configListContainer = document.getElementById('configListContainer');
    this.elements.deviceAddressError = document.getElementById('deviceAddressError');
    this.elements.ctRatioError = document.getElementById('ctRatioError');
    this.elements.ptRatioError = document.getElementById('ptRatioError');
    
    // 验证必需的DOM元素是否存在
    const requiredElements = [
      'hexInput', 'parseBtn', 'clearBtn', 'exampleSelect', 'inputError',
      'loadingIndicator', 'resultContainer', 'exportBtn', 'resultActions',
      'historyList', 'clearHistoryBtn', 'configRateBtn', 'rateConfigDialog',
      'closeDialogBtn', 'deviceAddressInput', 'ctRatioInput', 'ptRatioInput',
      'saveRateBtn', 'cancelRateBtn', 'configListContainer',
      'deviceAddressError', 'ctRatioError', 'ptRatioError'
    ];
    
    for (const elementName of requiredElements) {
      if (!this.elements[elementName]) {
        throw new Error(`必需的DOM元素未找到: ${elementName}`);
      }
    }
  }

  /**
   * 绑定UI事件监听器
   * @private
   */
  _bindEventListeners() {
    // 解析按钮点击事件
    this.elements.parseBtn.addEventListener('click', () => {
      this.handleParse();
    });
    
    // 清空按钮点击事件
    this.elements.clearBtn.addEventListener('click', () => {
      this.handleClear();
    });
    
    // 示例选择器变化事件
    this.elements.exampleSelect.addEventListener('change', (e) => {
      this.handleExampleSelect(e.target.value);
    });
    
    // 导出按钮点击事件
    this.elements.exportBtn.addEventListener('click', () => {
      this.exportResult();
    });
    
    // 清除历史按钮点击事件
    this.elements.clearHistoryBtn.addEventListener('click', () => {
      this.handleClearHistory();
    });
    
    // 配置变比按钮点击事件
    this.elements.configRateBtn.addEventListener('click', () => {
      this.openConfigDialog();
    });
    
    // 关闭对话框按钮点击事件
    this.elements.closeDialogBtn.addEventListener('click', () => {
      this.closeConfigDialog();
    });
    
    // 取消按钮点击事件
    this.elements.cancelRateBtn.addEventListener('click', () => {
      this.closeConfigDialog();
    });
    
    // 保存配置按钮点击事件
    this.elements.saveRateBtn.addEventListener('click', () => {
      this.saveRateConfig();
    });
    
    // 点击对话框背景关闭对话框
    this.elements.rateConfigDialog.addEventListener('click', (e) => {
      if (e.target === this.elements.rateConfigDialog) {
        this.closeConfigDialog();
      }
    });
    
    // 输入框回车键快捷解析（Ctrl+Enter）
    this.elements.hexInput.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        this.handleParse();
      }
    });
    
    // 输入框内容变化时清除错误提示
    this.elements.hexInput.addEventListener('input', () => {
      this._clearError();
    });
  }

  /**
   * 加载解码器模块
   * @private
   */
  async _loadDecoder() {
    try {
      await this.decoder.loadDecoder();
      console.log('解码器加载成功');
    } catch (error) {
      console.error('解码器加载失败:', error);
      throw new Error('解码器加载失败，请刷新页面重试');
    }
  }

  /**
   * 处理解析请求
   * 
   * 需求: 2.1, 2.2 - 调用解码器解析数据，阻止空输入
   */
  async handleParse() {
    try {
      // 清除之前的错误提示
      this._clearError();
      
      // 获取输入数据
      const rawInput = this.elements.hexInput.value;
      
      // 验证输入不为空
      if (!rawInput || rawInput.trim().length === 0) {
        this._showError('请输入十六进制数据');
        return;
      }
      
      // 清理输入数据（移除空格和换行符）
      const cleanedInput = cleanHexString(rawInput);
      
      // 使用解码器验证输入
      const validation = this.decoder.validateInput(cleanedInput);
      if (!validation.valid) {
        this._showError(validation.error);
        return;
      }
      
      // 保存当前输入
      this.currentInput = cleanedInput;
      
      // 显示加载状态
      this._showLoading();
      
      // 隐藏之前的结果
      this.elements.resultContainer.innerHTML = '';
      this.elements.resultActions.style.display = 'none';
      
      // 使用 setTimeout 避免阻塞 UI
      setTimeout(async () => {
        try {
          // 调用解码器解析数据
          const result = await this.decoder.decode(cleanedInput);
          
          // 需求 6.1: 在解析完成后应用变比
          const resultWithRate = this.applyRateToResult(result);
          
          // 隐藏加载状态
          this._hideLoading();
          
          // 保存当前结果
          this.currentResult = resultWithRate;
          
          // 显示结果
          this.displayResult(resultWithRate);
          
          // 保存到历史记录
          this.storage.saveRecord({
            timestamp: Date.now(),
            input: rawInput, // 保存原始输入（包含格式）
            result: resultWithRate
          });
          
          // 刷新历史记录显示
          this.loadHistory();
          
        } catch (error) {
          // 隐藏加载状态
          this._hideLoading();
          
          // 显示错误
          this.displayError(error);
        }
      }, 100);
      
    } catch (error) {
      console.error('解析过程出错:', error);
      this._hideLoading();
      this._showError('解析过程出错: ' + error.message);
    }
  }

  /**
   * 处理清空输入
   * 
   * 需求: 1.5 - 提供清空输入按钮
   */
  handleClear() {
    // 清空输入框
    this.elements.hexInput.value = '';
    
    // 清除错误提示
    this._clearError();
    
    // 清空当前输入
    this.currentInput = null;
    
    // 重置示例选择器
    this.elements.exampleSelect.value = '';
    
    // 聚焦到输入框
    this.elements.hexInput.focus();
  }

  /**
   * 处理示例数据选择
   * 
   * 需求: 6.2 - 自动填充示例数据
   */
  handleExampleSelect(exampleType) {
    // 如果选择了空值（"选择示例..."），不做任何操作
    if (!exampleType) {
      return;
    }
    
    // 获取示例数据
    const example = EXAMPLE_DATA[exampleType];
    
    if (!example) {
      console.error('未找到示例数据:', exampleType);
      this._showError('未找到示例数据');
      return;
    }
    
    // 填充输入框
    this.elements.hexInput.value = example.data;
    
    // 清除错误提示
    this._clearError();
    
    // 聚焦到输入框
    this.elements.hexInput.focus();
    
    // 可选：显示示例说明（作为提示）
    console.log('已加载示例:', example.description);
  }

  /**
   * 显示解析结果
   * 
   * 需求: 2.3, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6 - 显示解码结果
   */
  displayResult(result) {
    // 清空结果容器
    this.elements.resultContainer.innerHTML = '';
    
    // 验证结果
    if (!result || !Array.isArray(result) || result.length === 0) {
      this.elements.resultContainer.innerHTML = '<p class="no-result">无解析结果</p>';
      return;
    }
    
    // 遍历每个解析结果（可能有多个设备）
    result.forEach((item, index) => {
      const resultDiv = this._createResultHTML(item, index);
      this.elements.resultContainer.appendChild(resultDiv);
    });
    
    // 显示导出按钮
    this.elements.resultActions.style.display = 'flex';
  }

  /**
   * 创建单个结果的HTML元素
   * @private
   * @param {Object} item - 解析结果项
   * @param {number} index - 结果索引
   * @returns {HTMLElement} 结果HTML元素
   */
  _createResultHTML(item, index) {
    const resultDiv = document.createElement('div');
    resultDiv.className = 'result-item';
    
    // 创建协议信息部分
    const protocolInfo = this._createProtocolInfo(item);
    resultDiv.appendChild(protocolInfo);
    
    // 创建数据标识部分
    if (item.data_identifiers && item.data_identifiers.length > 0) {
      const identifiersSection = this._createDataIdentifiers(item.data_identifiers);
      resultDiv.appendChild(identifiersSection);
    }
    
    // 创建解析数据部分（按类别分组）
    if (item.data && Object.keys(item.data).length > 0) {
      const dataSection = this._createDataSection(item.data);
      resultDiv.appendChild(dataSection);
    }
    
    // 创建未解析OAD部分（仅698协议）
    if (item.unparsed_oads && item.unparsed_oads.length > 0) {
      const unparsedSection = this._createUnparsedOADs(item.unparsed_oads);
      resultDiv.appendChild(unparsedSection);
    }
    
    return resultDiv;
  }

  /**
   * 创建协议信息HTML
   * @private
   * @param {Object} item - 解析结果项
   * @returns {HTMLElement}
   * 
   * 需求: 3.1, 3.2 - 按协议版本分组显示结果，显示设备地址信息
   * 需求: 6.3, 6.5 - 显示变比应用标注
   */
  _createProtocolInfo(item) {
    const infoDiv = document.createElement('div');
    infoDiv.className = 'protocol-info';
    
    // 协议版本标签
    const protocolLabel = document.createElement('span');
    protocolLabel.className = `protocol-badge protocol-${item.protocol_version}`;
    
    let protocolName = '';
    switch (item.protocol_version) {
      case '1997':
        protocolName = 'DLT645-1997';
        break;
      case '2007':
        protocolName = 'DLT645-2007';
        break;
      case '698':
        protocolName = 'DLT698.45-2017';
        break;
      default:
        protocolName = `协议版本: ${item.protocol_version}`;
    }
    protocolLabel.textContent = protocolName;
    
    // 设备地址
    const deviceInfo = document.createElement('p');
    deviceInfo.className = 'device-info';
    deviceInfo.innerHTML = `<strong>设备地址:</strong> <span class="device-key">${item.deviceKey || '未知'}</span>`;
    
    // 解析时间
    const timeInfo = document.createElement('p');
    timeInfo.className = 'time-info';
    timeInfo.innerHTML = `<strong>解析时间:</strong> <span class="parse-time">${item.time || formatTimestamp(Date.now())}</span>`;
    
    // 需求 6.3, 6.4, 6.5: 显示变比应用标注
    const rateInfo = document.createElement('p');
    rateInfo.className = 'rate-info';
    
    if (item.rateApplied === true && item.rateConfig) {
      // 需求 6.3: 已应用变比
      rateInfo.innerHTML = `<strong>变比状态:</strong> <span class="rate-applied">已应用变比</span> (CT: ${item.rateConfig.ct}, PT: ${item.rateConfig.pt})`;
    } else if (item.rateApplied === false) {
      // 需求 6.5: 未应用变比
      if (item.rateError) {
        // 需求 6.6: 变比应用失败
        rateInfo.innerHTML = `<strong>变比状态:</strong> <span class="rate-not-applied">变比应用失败</span> (${item.rateError})`;
      } else {
        rateInfo.innerHTML = `<strong>变比状态:</strong> <span class="rate-not-applied">未应用变比</span> (无配置)`;
      }
    }
    
    infoDiv.appendChild(protocolLabel);
    infoDiv.appendChild(deviceInfo);
    infoDiv.appendChild(timeInfo);
    
    // 只有当有变比信息时才添加
    if (item.rateApplied !== undefined) {
      infoDiv.appendChild(rateInfo);
    }
    
    return infoDiv;
  }

  /**
   * 创建数据标识HTML
   * @private
   * @param {Array} identifiers - 数据标识列表
   * @returns {HTMLElement}
   * 
   * 需求: 3.3 - 显示数据标识及其描述
   */
  _createDataIdentifiers(identifiers) {
    const section = document.createElement('div');
    section.className = 'data-identifiers-section';
    
    const title = document.createElement('h4');
    title.textContent = '数据标识';
    section.appendChild(title);
    
    const list = document.createElement('ul');
    list.className = 'data-identifiers';
    
    identifiers.forEach(identifier => {
      const item = document.createElement('li');
      item.innerHTML = `<strong>${identifier.id}:</strong> ${identifier.description || '无描述'}`;
      list.appendChild(item);
    });
    
    section.appendChild(list);
    return section;
  }

  /**
   * 创建解析数据HTML（按类别分组）
   * @private
   * @param {Object} data - 解析出的数据字段
   * @returns {HTMLElement}
   * 
   * 需求: 3.4, 3.5 - 以表格形式展示数据，区分显示不同类型的数据
   */
  _createDataSection(data) {
    const section = document.createElement('div');
    section.className = 'parsed-data-section';
    
    const title = document.createElement('h4');
    title.textContent = '解析数据';
    section.appendChild(title);
    
    // 按类别分组数据
    const categories = this._categorizeData(data);
    
    // 为每个类别创建表格
    for (const [categoryName, fields] of Object.entries(categories)) {
      if (fields.length === 0) continue;
      
      const categoryDiv = document.createElement('div');
      categoryDiv.className = 'data-category';
      
      const categoryTitle = document.createElement('h5');
      categoryTitle.textContent = categoryName;
      categoryDiv.appendChild(categoryTitle);
      
      const table = this._createDataTable(fields);
      categoryDiv.appendChild(table);
      
      section.appendChild(categoryDiv);
    }
    
    return section;
  }

  /**
   * 将数据字段按类别分组
   * @private
   * @param {Object} data - 解析出的数据字段
   * @returns {Object} 分类后的数据
   * 
   * 需求: 3.5 - 区分显示电能量、电压电流、功率、功率因数等不同类型的数据
   */
  _categorizeData(data) {
    const categories = {
      '电能量': [],
      '电压': [],
      '电流': [],
      '功率': [],
      '功率因数': [],
      '最大需量': [],
      '其他': []
    };
    
    // 定义字段分类规则
    const categoryRules = {
      '电能量': ['kwh', 'kvar'],
      '电压': ['ua', 'ub', 'uc', 'u_'],
      '电流': ['ia', 'ib', 'ic', 'inc', 'i_'],
      '功率': ['pt', 'pa', 'pb', 'pc', 'qt', 'q1', 'q2', 'q3', 'st', 'sa', 'sb', 'sc'],
      '功率因数': ['pf'],
      '最大需量': ['demand']
    };
    
    // 遍历数据字段并分类
    for (const [fieldName, fieldValue] of Object.entries(data)) {
      let categorized = false;
      
      // 检查字段属于哪个类别
      for (const [categoryName, patterns] of Object.entries(categoryRules)) {
        for (const pattern of patterns) {
          if (fieldName.toLowerCase().includes(pattern.toLowerCase())) {
            categories[categoryName].push({ name: fieldName, value: fieldValue });
            categorized = true;
            break;
          }
        }
        if (categorized) break;
      }
      
      // 如果没有匹配任何类别，放入"其他"
      if (!categorized) {
        categories['其他'].push({ name: fieldName, value: fieldValue });
      }
    }
    
    return categories;
  }

  /**
   * 创建数据表格
   * @private
   * @param {Array} fields - 字段数组 [{name, value}]
   * @returns {HTMLElement}
   * 
   * 需求: 3.4 - 以表格形式展示解析出的数据字段和值
   */
  _createDataTable(fields) {
    const table = document.createElement('table');
    table.className = 'data-table';
    
    // 创建表头
    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr>
        <th>字段</th>
        <th>值</th>
        <th>说明</th>
      </tr>
    `;
    table.appendChild(thead);
    
    // 创建表体
    const tbody = document.createElement('tbody');
    
    fields.forEach(field => {
      const row = document.createElement('tr');
      
      // 字段名
      const nameCell = document.createElement('td');
      nameCell.className = 'field-name';
      nameCell.textContent = field.name;
      
      // 字段值
      const valueCell = document.createElement('td');
      valueCell.className = 'field-value';
      valueCell.textContent = field.value;
      
      // 字段说明
      const descCell = document.createElement('td');
      descCell.className = 'field-description';
      descCell.textContent = getFieldDescription(field.name);
      
      row.appendChild(nameCell);
      row.appendChild(valueCell);
      row.appendChild(descCell);
      
      tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    return table;
  }

  /**
   * 创建未解析OAD部分HTML
   * @private
   * @param {Array} unparsedOADs - 未解析的OAD列表
   * @returns {HTMLElement}
   * 
   * 需求: 3.6 - 单独列出未解析的OAD
   */
  _createUnparsedOADs(unparsedOADs) {
    const section = document.createElement('div');
    section.className = 'unparsed-oads-section';
    
    const title = document.createElement('h4');
    title.textContent = '未解析的OAD';
    title.className = 'warning-title';
    section.appendChild(title);
    
    const list = document.createElement('ul');
    list.className = 'unparsed-oads-list';
    
    unparsedOADs.forEach(oad => {
      const item = document.createElement('li');
      item.textContent = oad;
      list.appendChild(item);
    });
    
    section.appendChild(list);
    
    const note = document.createElement('p');
    note.className = 'unparsed-note';
    note.textContent = '注：以上OAD暂未被解析器识别，可能需要更新解码器版本。';
    section.appendChild(note);
    
    return section;
  }

  /**
   * 显示错误信息
   * 
   * 需求: 2.4, 8.1, 8.2, 8.3, 8.4, 8.5 - 显示错误信息和可能的原因，保持输入数据不丢失，提供恢复建议
   */
  displayError(error) {
    console.error('解析错误:', error);
    
    // 分类错误类型并生成相应的错误消息和建议
    const errorInfo = this._classifyError(error);
    
    // 清空结果容器
    this.elements.resultContainer.innerHTML = '';
    
    // 创建错误显示元素
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-display';
    
    // 错误标题
    const errorTitle = document.createElement('h3');
    errorTitle.className = 'error-title';
    errorTitle.innerHTML = '<span class="error-icon">⚠️</span> 解析失败';
    errorDiv.appendChild(errorTitle);
    
    // 错误消息
    const errorMessage = document.createElement('div');
    errorMessage.className = 'error-message-detail';
    errorMessage.innerHTML = `<strong>错误信息:</strong> ${errorInfo.message}`;
    errorDiv.appendChild(errorMessage);
    
    // 可能的原因
    if (errorInfo.reasons && errorInfo.reasons.length > 0) {
      const reasonsDiv = document.createElement('div');
      reasonsDiv.className = 'error-reasons';
      
      const reasonsTitle = document.createElement('p');
      reasonsTitle.innerHTML = '<strong>可能的原因:</strong>';
      reasonsDiv.appendChild(reasonsTitle);
      
      const reasonsList = document.createElement('ul');
      errorInfo.reasons.forEach(reason => {
        const reasonItem = document.createElement('li');
        reasonItem.textContent = reason;
        reasonsList.appendChild(reasonItem);
      });
      reasonsDiv.appendChild(reasonsList);
      
      errorDiv.appendChild(reasonsDiv);
    }
    
    // 恢复建议
    if (errorInfo.suggestions && errorInfo.suggestions.length > 0) {
      const suggestionsDiv = document.createElement('div');
      suggestionsDiv.className = 'error-suggestions';
      
      const suggestionsTitle = document.createElement('p');
      suggestionsTitle.innerHTML = '<strong>恢复建议:</strong>';
      suggestionsDiv.appendChild(suggestionsTitle);
      
      const suggestionsList = document.createElement('ul');
      errorInfo.suggestions.forEach(suggestion => {
        const suggestionItem = document.createElement('li');
        suggestionItem.textContent = suggestion;
        suggestionsList.appendChild(suggestionItem);
      });
      suggestionsDiv.appendChild(suggestionsList);
      
      errorDiv.appendChild(suggestionsDiv);
    }
    
    // 添加快捷操作按钮
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'error-actions';
    
    // 尝试示例按钮
    const tryExampleBtn = document.createElement('button');
    tryExampleBtn.className = 'btn-secondary';
    tryExampleBtn.textContent = '尝试示例数据';
    tryExampleBtn.addEventListener('click', () => {
      // 加载第一个示例
      this.elements.exampleSelect.value = 'dlt645-2007';
      this.handleExampleSelect('dlt645-2007');
    });
    actionsDiv.appendChild(tryExampleBtn);
    
    // 重新解析按钮（如果有输入数据）
    if (this.currentInput) {
      const retryBtn = document.createElement('button');
      retryBtn.className = 'btn-primary';
      retryBtn.textContent = '重新解析';
      retryBtn.addEventListener('click', () => {
        this.handleParse();
      });
      actionsDiv.appendChild(retryBtn);
    }
    
    errorDiv.appendChild(actionsDiv);
    
    // 显示错误信息
    this.elements.resultContainer.appendChild(errorDiv);
    
    // 确保输入数据不丢失（需求 8.4）
    // 输入框中的数据已经保留，不需要额外操作
    
    // 隐藏导出按钮（因为没有有效结果）
    this.elements.resultActions.style.display = 'none';
  }

  /**
   * 分类错误类型并生成错误信息
   * @private
   * @param {Error|Object} error - 错误对象
   * @returns {Object} 包含 message, reasons, suggestions 的对象
   * 
   * 需求: 8.1, 8.2, 8.5 - 显示具体的格式错误信息，提示可能的原因，提供错误恢复建议
   */
  _classifyError(error) {
    let message = '';
    let reasons = [];
    let suggestions = [];
    
    // 获取错误消息
    const errorMessage = error.message || error.toString();
    
    // 1. 格式错误（需求 8.1）
    if (errorMessage.includes('非法字符') || errorMessage.includes('十六进制') || errorMessage.includes('格式')) {
      message = '输入数据格式错误';
      reasons = [
        '输入包含非十六进制字符（仅支持 0-9 和 a-f）',
        '数据格式不符合要求'
      ];
      suggestions = [
        '检查输入数据，确保只包含十六进制字符（0-9, a-f, A-F）',
        '移除所有空格和特殊字符后重试',
        '尝试使用示例数据验证功能是否正常'
      ];
    }
    // 2. 空结果错误（需求 8.2）
    else if (errorMessage.includes('空结果') || errorMessage.includes('无效数据') || errorMessage.includes('未能解析')) {
      message = '未能解析出有效数据';
      reasons = [
        '输入数据可能不完整',
        '数据可能不符合任何已知协议格式',
        '数据帧可能损坏或截断',
        '协议版本可能不匹配'
      ];
      suggestions = [
        '检查输入数据是否完整（包含起始符和结束符）',
        '确认数据来源和协议版本',
        '尝试使用完整的数据帧',
        '参考示例数据的格式'
      ];
    }
    // 3. 解码器执行异常（需求 8.3）
    else if (errorMessage.includes('解码器') || errorMessage.includes('decoder') || errorMessage.includes('执行异常')) {
      message = '解码器执行异常';
      reasons = [
        '解码器内部处理出错',
        '数据格式与解码器不兼容',
        '解码器模块加载失败'
      ];
      suggestions = [
        '刷新页面重新加载解码器',
        '检查浏览器控制台是否有详细错误信息',
        '尝试使用示例数据验证解码器是否正常',
        '如果问题持续，请联系技术支持'
      ];
    }
    // 4. 数据过大错误（需求 9.3, 9.4）
    else if (errorMessage.includes('超过') || errorMessage.includes('过大') || errorMessage.includes('限制')) {
      message = '输入数据超过大小限制';
      reasons = [
        '输入数据超过 100KB 限制'
      ];
      suggestions = [
        '减少输入数据量',
        '分批处理大量数据',
        '检查是否包含了不必要的数据'
      ];
    }
    // 5. 其他未知错误
    else {
      message = errorMessage || '解析过程中发生未知错误';
      reasons = [
        '可能是网络问题',
        '可能是浏览器兼容性问题',
        '可能是数据格式问题'
      ];
      suggestions = [
        '检查数据格式是否正确',
        '尝试刷新页面后重试',
        '尝试使用示例数据验证功能',
        '如果问题持续，请联系技术支持'
      ];
    }
    
    return {
      message,
      reasons,
      suggestions
    };
  }

  /**
   * 加载历史记录
   * 
   * 需求: 1.1, 1.2 - 从LocalStorage加载历史记录并显示，处理空列表情况
   */
  loadHistory() {
    try {
      // 从 Storage 模块获取历史记录
      const history = this.storage.getHistory();
      
      // 清空历史记录列表
      this.elements.historyList.innerHTML = '';
      
      // 处理空列表情况
      if (!history || history.length === 0) {
        const emptyItem = document.createElement('li');
        emptyItem.className = 'history-empty';
        emptyItem.textContent = '暂无历史记录';
        this.elements.historyList.appendChild(emptyItem);
        return;
      }
      
      // 渲染历史记录列表（最多10条，已在Storage模块中限制）
      history.forEach(record => {
        const historyItem = this._renderHistoryItem(record);
        this.elements.historyList.appendChild(historyItem);
      });
      
    } catch (error) {
      console.error('加载历史记录失败:', error);
      // 显示错误提示但不影响其他功能
      this.elements.historyList.innerHTML = '<li class="history-empty">加载历史记录失败</li>';
    }
  }

  /**
   * 渲染单条历史记录
   * @private
   * @param {Object} record - 历史记录对象
   * @returns {HTMLElement} 历史记录 DOM 元素
   * 
   * 需求: 1.4 - 显示时间戳、输入数据预览和协议版本信息
   */
  _renderHistoryItem(record) {
    const li = document.createElement('li');
    li.className = 'history-item';
    
    // 添加 data 属性用于标识（用于高亮选中项）
    li.dataset.timestamp = record.timestamp;
    
    // 创建内容容器
    const contentDiv = document.createElement('div');
    contentDiv.className = 'history-item-content';
    
    // 创建输入数据预览（前50个字符）
    const previewDiv = document.createElement('div');
    previewDiv.className = 'history-item-preview';
    const preview = record.preview || record.input.substring(0, 50);
    previewDiv.textContent = preview + (record.input.length > 50 ? '...' : '');
    
    // 创建时间戳和协议版本信息
    const timeDiv = document.createElement('div');
    timeDiv.className = 'history-item-time';
    
    // 格式化时间戳
    const timeStr = formatTimestamp(record.timestamp);
    
    // 从解析结果中提取协议版本
    let protocolStr = '';
    if (record.result && Array.isArray(record.result) && record.result.length > 0) {
      const protocols = record.result.map(item => {
        switch (item.protocol_version) {
          case '1997':
            return 'DLT645-1997';
          case '2007':
            return 'DLT645-2007';
          case '698':
            return 'DLT698.45';
          default:
            return item.protocol_version;
        }
      });
      // 去重并显示
      const uniqueProtocols = [...new Set(protocols)];
      protocolStr = ' | ' + uniqueProtocols.join(', ');
    }
    
    timeDiv.textContent = timeStr + protocolStr;
    
    // 组装内容
    contentDiv.appendChild(previewDiv);
    contentDiv.appendChild(timeDiv);
    li.appendChild(contentDiv);
    
    // 绑定点击事件监听器
    li.addEventListener('click', () => {
      this.handleHistoryItemClick(record);
    });
    
    return li;
  }

  /**
   * 处理历史记录项点击
   * @param {Object} record - 历史记录对象
   * 
   * 需求: 2.1, 2.2, 2.3, 2.4 - 加载历史记录到输入框和结果区域
   */
  handleHistoryItemClick(record) {
    try {
      // 需求 2.3: 清除错误提示
      this._clearError();
      
      // 需求 2.1: 填充输入框
      if (this.elements.hexInput) {
        this.elements.hexInput.value = record.input;
      }
      
      // 需求 2.2: 显示解析结果
      if (record.result && Array.isArray(record.result)) {
        // 保存当前结果
        this.currentResult = record.result;
        this.currentInput = record.input;
        
        // 显示结果
        this.displayResult(record.result);
      }
      
      // 需求 2.4: 高亮选中的历史记录项
      this._highlightHistoryItem(record.timestamp);
      
    } catch (error) {
      console.error('加载历史记录失败:', error);
      this._showError('加载历史记录失败: ' + error.message);
    }
  }

  /**
   * 高亮指定的历史记录项
   * @private
   * @param {number} timestamp - 要高亮的记录的时间戳
   */
  _highlightHistoryItem(timestamp) {
    // 移除所有历史记录项的高亮样式
    const allHistoryItems = this.elements.historyList.querySelectorAll('.history-item');
    allHistoryItems.forEach(item => {
      item.classList.remove('history-item-selected');
    });
    
    // 为当前点击的项添加高亮样式
    allHistoryItems.forEach(item => {
      if (item.dataset && item.dataset.timestamp === String(timestamp)) {
        item.classList.add('history-item-selected');
      }
    });
  }

  /**
   * 处理清除历史记录
   * 
   * 需求: 3.1, 3.2, 3.3, 3.4 - 显示确认对话框，清除历史记录，更新UI，处理取消操作
   */
  handleClearHistory() {
    try {
      // 需求 3.1: 显示确认对话框
      const confirmed = window.confirm('确定要清除所有历史记录吗？此操作不可恢复。');
      
      // 需求 3.4: 处理取消操作
      if (!confirmed) {
        console.log('用户取消了清除历史记录操作');
        return;
      }
      
      // 需求 3.2: 调用 Storage 模块清除历史记录
      const success = this.storage.clearHistory();
      
      if (!success) {
        // 需求 3.5: 清除操作失败时显示错误提示
        this._showError('清除历史记录失败，请重试');
        return;
      }
      
      // 需求 3.3: 更新 UI 显示"暂无历史记录"
      this.loadHistory();
      
      console.log('历史记录已清除');
      
    } catch (error) {
      console.error('清除历史记录时出错:', error);
      this._showError('清除历史记录失败: ' + error.message);
    }
  }

  /**
   * 打开变比配置对话框
   * 
   * 需求: 4.1, 4.2, 4.3 - 显示配置对话框，显示输入框，加载现有配置列表
   */
  openConfigDialog() {
    try {
      // 显示对话框
      this.elements.rateConfigDialog.style.display = 'flex';
      
      // 清空输入框
      this.elements.deviceAddressInput.value = '';
      this.elements.ctRatioInput.value = '';
      this.elements.ptRatioInput.value = '';
      
      // 清除错误提示
      this._clearConfigErrors();
      
      // 加载现有配置列表
      this._renderConfigList();
      
      // 聚焦到设备地址输入框
      this.elements.deviceAddressInput.focus();
      
      console.log('配置对话框已打开');
      
    } catch (error) {
      console.error('打开配置对话框失败:', error);
      this._showError('打开配置对话框失败: ' + error.message);
    }
  }

  /**
   * 关闭变比配置对话框
   * 
   * 需求: 4.8 - 隐藏对话框，清空输入框
   */
  closeConfigDialog() {
    try {
      // 隐藏对话框
      this.elements.rateConfigDialog.style.display = 'none';
      
      // 清空输入框
      this.elements.deviceAddressInput.value = '';
      this.elements.ctRatioInput.value = '';
      this.elements.ptRatioInput.value = '';
      
      // 清除错误提示
      this._clearConfigErrors();
      
      console.log('配置对话框已关闭');
      
    } catch (error) {
      console.error('关闭配置对话框失败:', error);
    }
  }

  /**
   * 清除配置对话框的错误提示
   * @private
   */
  _clearConfigErrors() {
    if (this.elements.deviceAddressError) {
      this.elements.deviceAddressError.textContent = '';
      this.elements.deviceAddressError.classList.remove('show');
      this.elements.deviceAddressInput.classList.remove('error');
    }
    
    if (this.elements.ctRatioError) {
      this.elements.ctRatioError.textContent = '';
      this.elements.ctRatioError.classList.remove('show');
      this.elements.ctRatioInput.classList.remove('error');
    }
    
    if (this.elements.ptRatioError) {
      this.elements.ptRatioError.textContent = '';
      this.elements.ptRatioError.classList.remove('show');
      this.elements.ptRatioInput.classList.remove('error');
    }
  }

  /**
   * 渲染配置列表
   * @private
   * 
   * 需求: 5.1, 5.2 - 按设备地址排序显示所有配置，包含设备地址、CT、PT和操作按钮
   */
  _renderConfigList() {
    try {
      // 获取所有配置
      const allRates = this.rateConfig.getAllRates();
      
      // 清空配置列表容器
      this.elements.configListContainer.innerHTML = '';
      
      // 获取设备地址列表并排序
      const deviceAddresses = Object.keys(allRates).sort();
      
      // 处理空列表情况
      if (deviceAddresses.length === 0) {
        const emptyP = document.createElement('p');
        emptyP.className = 'config-empty';
        emptyP.textContent = '暂无配置';
        this.elements.configListContainer.appendChild(emptyP);
        return;
      }
      
      // 渲染每个配置项
      deviceAddresses.forEach(deviceAddress => {
        const config = allRates[deviceAddress];
        const configItem = this._renderConfigItem(deviceAddress, config);
        this.elements.configListContainer.appendChild(configItem);
      });
      
    } catch (error) {
      console.error('渲染配置列表失败:', error);
      this.elements.configListContainer.innerHTML = '<p class="config-empty">加载配置失败</p>';
    }
  }

  /**
   * 渲染单个配置项
   * @private
   * @param {string} deviceAddress - 设备地址
   * @param {Object} config - 配置对象 {ct, pt}
   * @returns {HTMLElement} 配置项DOM元素
   * 
   * 需求: 5.2 - 包含设备地址、CT、PT和操作按钮
   */
  _renderConfigItem(deviceAddress, config) {
    const div = document.createElement('div');
    div.className = 'config-item';
    
    // 创建配置项头部（设备地址和操作按钮）
    const header = document.createElement('div');
    header.className = 'config-item-header';
    
    const addressSpan = document.createElement('span');
    addressSpan.className = 'config-item-address';
    addressSpan.textContent = deviceAddress;
    
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'config-item-actions';
    
    // 编辑按钮
    const editBtn = document.createElement('button');
    editBtn.className = 'config-item-edit';
    editBtn.textContent = '编辑';
    editBtn.addEventListener('click', () => {
      this.editRateConfig(deviceAddress);
    });
    
    // 删除按钮
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'config-item-delete';
    deleteBtn.textContent = '删除';
    deleteBtn.addEventListener('click', () => {
      this.deleteRateConfig(deviceAddress);
    });
    
    actionsDiv.appendChild(editBtn);
    actionsDiv.appendChild(deleteBtn);
    
    header.appendChild(addressSpan);
    header.appendChild(actionsDiv);
    
    // 创建配置详情（CT和PT）
    const details = document.createElement('div');
    details.className = 'config-item-details';
    
    const ctDetail = document.createElement('div');
    ctDetail.className = 'config-item-detail';
    ctDetail.innerHTML = '<strong>CT 变比:</strong> <span>' + config.ct + '</span>';
    
    const ptDetail = document.createElement('div');
    ptDetail.className = 'config-item-detail';
    ptDetail.innerHTML = '<strong>PT 变比:</strong> <span>' + config.pt + '</span>';
    
    details.appendChild(ctDetail);
    details.appendChild(ptDetail);
    
    // 组装配置项
    div.appendChild(header);
    div.appendChild(details);
    
    return div;
  }

  /**
   * 编辑变比配置
   * @param {string} deviceAddress - 设备地址
   * 
   * 需求: 5.3 - 加载配置到输入框，聚焦输入框
   */
  editRateConfig(deviceAddress) {
    try {
      // 获取指定设备的配置
      const config = this.rateConfig.getRate(deviceAddress);
      
      if (!config) {
        console.error('未找到设备配置:', deviceAddress);
        return;
      }
      
      // 填充到输入框
      this.elements.deviceAddressInput.value = deviceAddress;
      this.elements.ctRatioInput.value = config.ct;
      this.elements.ptRatioInput.value = config.pt;
      
      // 清除错误提示
      this._clearConfigErrors();
      
      // 聚焦输入框（聚焦到设备地址输入框）
      this.elements.deviceAddressInput.focus();
      
      console.log('已加载配置到输入框:', deviceAddress);
      
    } catch (error) {
      console.error('编辑配置失败:', error);
    }
  }

  /**
   * 保存变比配置
   * 
   * 需求: 4.4, 4.5, 4.6, 4.7, 7.1, 9.2, 9.3 - 验证输入，保存配置，更新列表，显示错误提示
   */
  saveRateConfig() {
    try {
      // 清除之前的错误提示
      this._clearConfigErrors();
      
      // 获取输入框的值
      const deviceAddress = this.elements.deviceAddressInput.value.trim();
      const ct = this.elements.ctRatioInput.value.trim();
      const pt = this.elements.ptRatioInput.value.trim();
      
      // 验证输入
      let hasError = false;
      
      // 需求 4.4: 验证设备地址格式
      if (!deviceAddress) {
        this._showConfigError('deviceAddress', '请输入设备地址');
        hasError = true;
      } else if (!this.rateConfig.validateDeviceAddress(deviceAddress)) {
        this._showConfigError('deviceAddress', '设备地址必须是 12 位十六进制字符');
        hasError = true;
      }
      
      // 需求 4.5: 验证 CT 变比格式
      if (!ct) {
        this._showConfigError('ct', '请输入 CT 变比');
        hasError = true;
      } else if (!this.rateConfig.validateRatio(ct)) {
        this._showConfigError('ct', 'CT 变比格式不正确，应为 "数字/数字"（如 350/1）');
        hasError = true;
      }
      
      // 需求 4.6: 验证 PT 变比格式
      if (!pt) {
        this._showConfigError('pt', '请输入 PT 变比');
        hasError = true;
      } else if (!this.rateConfig.validateRatio(pt)) {
        this._showConfigError('pt', 'PT 变比格式不正确，应为 "数字/数字"（如 2400/1）');
        hasError = true;
      }
      
      // 如果有验证错误，停止保存
      if (hasError) {
        return;
      }
      
      // 需求 4.7, 7.1: 调用 RateConfig 模块保存配置
      const success = this.rateConfig.saveRate(deviceAddress, ct, pt);
      
      if (!success) {
        // 需求 9.3: 保存失败时显示错误对话框并保留用户输入
        alert('保存配置失败，请检查存储空间或重试');
        return;
      }
      
      // 保存成功
      console.log('变比配置已保存:', { deviceAddress, ct, pt });
      
      // 更新配置列表
      this._renderConfigList();
      
      // 清空输入框（保存成功后）
      this.elements.deviceAddressInput.value = '';
      this.elements.ctRatioInput.value = '';
      this.elements.ptRatioInput.value = '';
      
      // 聚焦到设备地址输入框，方便继续添加
      this.elements.deviceAddressInput.focus();
      
    } catch (error) {
      console.error('保存变比配置时出错:', error);
      // 需求 9.3: 保存失败时显示错误对话框并保留用户输入
      alert('保存配置失败: ' + error.message);
    }
  }

  /**
   * 显示配置输入框的错误提示
   * @private
   * @param {string} field - 字段名称 ('deviceAddress', 'ct', 'pt')
   * @param {string} message - 错误消息
   * 
   * 需求: 9.2 - 在输入框旁边显示错误提示
   */
  _showConfigError(field, message) {
    let errorElement = null;
    let inputElement = null;
    
    switch (field) {
      case 'deviceAddress':
        errorElement = this.elements.deviceAddressError;
        inputElement = this.elements.deviceAddressInput;
        break;
      case 'ct':
        errorElement = this.elements.ctRatioError;
        inputElement = this.elements.ctRatioInput;
        break;
      case 'pt':
        errorElement = this.elements.ptRatioError;
        inputElement = this.elements.ptRatioInput;
        break;
    }
    
    if (errorElement && inputElement) {
      errorElement.textContent = message;
      errorElement.classList.add('show');
      inputElement.classList.add('error');
    }
  }

  /**
   * 删除变比配置
   * @param {string} deviceAddress - 设备地址
   * 
   * 需求: 5.4, 5.5, 5.6 - 显示确认对话框，删除配置，更新列表
   */
  deleteRateConfig(deviceAddress) {
    try {
      // 需求 5.4: 显示确认对话框
      const confirmed = window.confirm('确定要删除设备 ' + deviceAddress + ' 的变比配置吗？');
      
      // 需求 5.6: 处理取消操作
      if (!confirmed) {
        console.log('用户取消了删除配置操作');
        return;
      }
      
      // 需求 5.5: 调用 RateConfig 模块删除配置
      const success = this.rateConfig.deleteRate(deviceAddress);
      
      if (!success) {
        alert('删除配置失败，请重试');
        return;
      }
      
      console.log('配置已删除:', deviceAddress);
      
      // 更新配置列表
      this._renderConfigList();
      
    } catch (error) {
      console.error('删除配置失败:', error);
      alert('删除配置失败: ' + error.message);
    }
  }

  /**
   * 在解析结果中应用变比
   * @param {Array} result - 解析结果数组
   * @returns {Array} 应用变比后的结果数组
   * 
   * 需求: 6.1, 6.2, 6.6 - 获取变比配置，传递给解码器，标记是否应用了变比
   */
  applyRateToResult(result) {
    try {
      // 验证输入
      if (!result || !Array.isArray(result)) {
        console.error('Invalid result format for rate application');
        return result;
      }

      // 遍历每个解析结果项
      result.forEach(item => {
        try {
          // 获取设备地址
          const deviceAddress = item.deviceKey;
          
          if (!deviceAddress) {
            console.warn('Result item missing deviceKey, skipping rate application');
            item.rateApplied = false;
            return;
          }

          // 需求 6.1: 获取设备地址的变比配置
          const rateConfig = this.rateConfig.getRate(deviceAddress);

          if (rateConfig) {
            // 需求 6.2: 如果存在配置，应用变比
            // 注意：解码器在解析时已经应用了 deviceRates 中的配置
            // 这里我们需要手动应用变比到数据
            this._applyRateToData(item.data, rateConfig);
            
            // 需求 6.3: 标记已应用变比
            item.rateApplied = true;
            item.rateConfig = rateConfig;
            
            console.log('Rate applied to device:', deviceAddress, rateConfig);
          } else {
            // 需求 6.4, 6.5: 无配置时标记未应用变比
            item.rateApplied = false;
            console.log('No rate config found for device:', deviceAddress);
          }
        } catch (error) {
          // 需求 6.6: 处理变比应用失败的情况
          console.error('Error applying rate to result item:', error);
          item.rateApplied = false;
          item.rateError = error.message;
        }
      });

      return result;
    } catch (error) {
      console.error('Error in applyRateToResult:', error);
      return result;
    }
  }

  /**
   * 应用变比到数据对象
   * @private
   * @param {Object} data - 数据对象
   * @param {Object} rateConfig - 变比配置 {ct, pt}
   */
  _applyRateToData(data, rateConfig) {
    if (!data || !rateConfig) {
      return;
    }

    // 解析变比值
    const ct = this._parseRatio(rateConfig.ct);
    const pt = this._parseRatio(rateConfig.pt);

    if (ct === null || pt === null) {
      console.error('Invalid rate config format:', rateConfig);
      return;
    }

    // 应用变比到电能量数据（需要乘以 PT * CT）
    const energyFields = [
      'kwhp', 'kwhp1', 'kwhp2', 'kwhp3', 'kwhp4',  // 正向有功
      'kwhn', 'kwhn1', 'kwhn2', 'kwhn3', 'kwhn4',  // 反向有功
      'kvarhp', 'kvarhn',                           // 无功
      'kvar1', 'kvar1_1', 'kvar1_2', 'kvar1_3', 'kvar1_4',  // 组合无功1
      'kvar2', 'kvar2_1', 'kvar2_2', 'kvar2_3', 'kvar2_4'   // 组合无功2
    ];

    energyFields.forEach(field => {
      if (data[field] !== undefined && data[field] !== null) {
        const value = parseFloat(data[field]);
        if (!isNaN(value)) {
          data[field] = (value * pt * ct).toFixed(2);
        }
      }
    });

    // 应用变比到电压数据（需要乘以 PT）
    const voltageFields = ['ua', 'ub', 'uc', 'u_a', 'u_b', 'u_c'];
    voltageFields.forEach(field => {
      if (data[field] !== undefined && data[field] !== null) {
        const value = parseFloat(data[field]);
        if (!isNaN(value)) {
          data[field] = (value * pt).toFixed(2);
        }
      }
    });

    // 应用变比到电流数据（需要乘以 CT）
    const currentFields = ['ia', 'ib', 'ic', 'inc', 'i_a', 'i_b', 'i_c', 'i_n'];
    currentFields.forEach(field => {
      if (data[field] !== undefined && data[field] !== null) {
        const value = parseFloat(data[field]);
        if (!isNaN(value)) {
          data[field] = (value * ct).toFixed(2);
        }
      }
    });

    // 应用变比到功率数据（需要乘以 PT * CT）
    const powerFields = [
      'pt', 'pa', 'pb', 'pc',  // 有功功率
      'qt', 'qa', 'qb', 'qc',  // 无功功率
      'st', 'sa', 'sb', 'sc',  // 视在功率
      'p_t', 'p_a', 'p_b', 'p_c',
      'q_t', 'q_a', 'q_b', 'q_c',
      's_t', 's_a', 's_b', 's_c'
    ];

    powerFields.forEach(field => {
      if (data[field] !== undefined && data[field] !== null) {
        const value = parseFloat(data[field]);
        if (!isNaN(value)) {
          data[field] = (value * pt * ct).toFixed(2);
        }
      }
    });

    // 功率因数不需要应用变比
  }

  /**
   * 解析变比字符串为数值
   * @private
   * @param {string} ratio - 变比字符串，如 "350/1"
   * @returns {number|null} 变比数值，如果解析失败返回 null
   */
  _parseRatio(ratio) {
    if (!ratio || typeof ratio !== 'string') {
      return null;
    }

    const parts = ratio.split('/');
    if (parts.length !== 2) {
      return null;
    }

    const numerator = parseFloat(parts[0]);
    const denominator = parseFloat(parts[1]);

    if (isNaN(numerator) || isNaN(denominator) || denominator === 0) {
      return null;
    }

    return numerator / denominator;
  }

  /**
   * 导出结果为JSON
   * 
   * 需求: 5.1, 5.2 - 提供导出为JSON格式的功能
   */
  exportResult() {
    try {
      if (!this.currentResult) {
        alert('没有可导出的结果');
        return;
      }

      // 创建导出数据
      const exportData = {
        timestamp: Date.now(),
        input: this.currentInput,
        result: this.currentResult
      };

      // 转换为JSON字符串
      const jsonStr = JSON.stringify(exportData, null, 2);

      // 创建Blob对象
      const blob = new Blob([jsonStr], { type: 'application/json' });

      // 创建下载链接
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'decoder-result-' + Date.now() + '.json';

      // 触发下载
      document.body.appendChild(a);
      a.click();

      // 清理
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log('结果已导出为JSON');
    } catch (error) {
      console.error('导出结果失败:', error);
      alert('导出失败: ' + error.message);
    }
  }

  /**
   * 显示错误提示
   * @private
   */
  _showError(message) {
    if (this.elements.inputError) {
      this.elements.inputError.textContent = message;
      this.elements.inputError.style.display = 'block';
    }
  }

  /**
   * 清除错误提示
   * @private
   */
  _clearError() {
    if (this.elements.inputError) {
      this.elements.inputError.textContent = '';
      this.elements.inputError.style.display = 'none';
    }
  }

  /**
   * 显示加载状态
   * @private
   */
  _showLoading() {
    if (this.elements.loadingIndicator) {
      this.elements.loadingIndicator.style.display = 'flex';
    }
  }

  /**
   * 隐藏加载状态
   * @private
   */
  _hideLoading() {
    if (this.elements.loadingIndicator) {
      this.elements.loadingIndicator.style.display = 'none';
    }
  }
}

// 当DOM加载完成后初始化应用（仅在浏览器环境中）
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', async () => {
    const app = new App();
    await app.init();
    
    // 将app实例挂载到window对象，方便调试
    if (typeof window !== 'undefined') {
      window.app = app;
    }
  });
}

// 导出（用于测试）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = App;
}
