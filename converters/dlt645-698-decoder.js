// Nashorn 是基于 ECMAScript 5.1 的，不支持 ES2020 的 BigInt
// ========== 可配置项（放在最上面便于修改）==========
// 设备 CT/PT 倍率，setRate 使用；key 为 deviceKey（表地址等）
// 格式：pt = 电压互感器变比(一次/二次)，ct = 电流互感器变比(一次/二次)，如 PT 2200:1、CT 600:1 写 "2200/1"、"600/1"
var deviceRates = {
    "012400042520": { "ct": "350/1", "pt": "2400/1" },
    // 请验证现场电表显示的实际读数，确认是否需要应用倍率
};

// ========== DL/T 645 协议（2007 和 1997）==========

// --- 645 协议数据标识描述函数 ---

// 获取2007协议数据标识描述
function getDataIdentifierDescription2007(mark) {
    var descriptions = {
        // 基础电能类数据标识
        '00010000': '正向有功总电能',
        '00010100': '正向有功费率1电能',
        '00010200': '正向有功费率2电能',
        '00010300': '正向有功费率3电能',
        '00010400': '正向有功费率4电能',
        '00020000': '反向有功总电能',
        '00030000': '正向无功总电能',
        '00040000': '反向无功总电能',

        // 最大需量类数据标识
        '01010000': '正向有功总最大需量及发生时间',
        '0101ff00': '正向有功最大需量及发生时间数据块',

        // 电能数据块标识
        '0001ff00': '正向有功电能数据块',
        '0002ff00': '反向有功电能数据块',
        '0003ff00': '组合无功1电能数据块',
        '0004ff00': '组合无功2电能数据块',

        // 实时数据块标识
        '0201ff00': '电压数据块',
        '0202ff00': '电流数据块',
        '0203ff00': '瞬时有功功率数据块',
        '0204ff00': '瞬时无功功率数据块',
        '0205ff00': '瞬时视在功率数据块',
        '0206ff00': '功率因数数据块',

        // 特殊数据标识
        '02800001': '零线电流'
    };
    return descriptions[mark] || '未知数据标识(' + mark + ')';
}

// 获取1997协议数据标识描述
function getDataIdentifierDescription1997(mark) {
    var descriptions = {
        '9010': '正向有功总电能',
        '9011': '正向有功费率1电能',
        '9012': '正向有功费率2电能',
        '9013': '正向有功费率3电能',
        '9014': '正向有功费率4电能',
        '901f': '正向有功总电能数据块',
        '9020': '反向有功总电能',
        '902f': '反向有功总电能数据块',
        '9110': '正向无功总电能',
        '911f': '正向无功总电能数据块',
        '9120': '反向无功总电能',
        '912f': '反向无功总电能数据块',
        'b611': 'A相电压',
        'b612': 'B相电压',
        'b613': 'C相电压',
        'b621': 'A相电流',
        'b622': 'B相电流',
        'b623': 'C相电流',
        'b630': '瞬时有功功率',
        'b631': 'A相有功功率',
        'b632': 'B相有功功率',
        'b633': 'C相有功功率',
        'b640': '瞬时无功功率',
        'b641': 'A相无功功率',
        'b642': 'B相无功功率',
        'b643': 'C相无功功率',
        'b650': '总功率因数',
        'b651': 'A相功率因数',
        'b652': 'B相功率因数',
        'b653': 'C相功率因数',
        'a010': '正向有功总最大需量',
        'a01f': '有功最大需量数据块',
        'b010': '正向有功总最大需量发生时间',
        'b01f': '正向有功最大需量发生时间数据块'
    };
    return descriptions[mark] || '未知数据标识(' + mark + ')';
}

// --- 645 协议数据解析函数 ---

// 从每个字节中减去 0x33，并反转顺序（645 协议专用）
function parseData(datas, start, size) {
    var dataBytes = [];
    for (var i = start + size - 2; i >= start; i -= 2) {
        var value = parseInt(datas.slice(i, i + 2), 16) - 0x33;
        if (value < 0) {
            value = 0xFF;
        }
        // 补零
        var s = value.toString(16);
        while (s.length < 2) {
            s = '0' + s
        }
        dataBytes.push(s);
    }
    return dataBytes.join('');
}

// 从末尾到开头反转每两个字节（645 协议专用）
function parseDataReverse(datas, start, size) {
    var dataBytes = [];
    for (var i = start + size - 2; i >= start; i -= 2) {
        dataBytes.push(datas.slice(i, i + 2));
    }
    return dataBytes.join('');
}

// 通过切片和格式化解析电能数据（645 协议专用）
// point 从前到后的小数点位置
function parseEnergyDataBySlice(datas, start, size, point) {
    var dataValue = parseData(datas, start, size);
    var integerPart = dataValue.slice(0, point);
    var decimalPart = dataValue.slice(point);
    var value = parseFloat(integerPart + '.' + decimalPart);
    // 根据第一个十六进制数字检查负值
    if (parseInt(dataValue[0], 16) >= 8) {
        value = -parseFloat(dataValue.slice(1, point) + '.' + decimalPart);
    }
    return value.toString();
}

// ========== DL/T 698.45-2017 协议（面向对象数据交换）==========

// --- 698 协议数据标识描述函数 ---

// 698 协议 OAD 描述映射
// OAD 格式：OI(2字节) + 属性标识(1字节) + 元素索引(1字节)
// 索引 00 = 数组（一次性获取所有元素），索引 01-0N = 单个元素
//
// 电能量类（Class ID 1）：
//   属性 02 = 数值，索引 00=数组(总+费率1-4) 01=总 02=费率1 03=费率2 04=费率3 05=费率4
//   属性 04 = 扩展精度总及费率数组(5×long64)，索引 00=全部（旧格式，兼容）
//   OI: 0010=正向有功 0020=反向有功 0030=组合无功1 0040=组合无功2 0070=正向无功
//
// 瞬时变量类（Class ID 3）：
//   属性 02 = 数值，索引 00=数组(A/B/C三相) 01/02/03=A/B/C相
//   OI: 2000=电压 2001=电流 2002=电压相角 200B=电压谐波 200C=电流谐波
//
// 功率类（Class ID 4）：
//   属性 02 = 数值，索引 00=数组(总/A/B/C四相) 01/02/03/04=总/A/B/C相
//   OI: 2004=有功功率 2005=无功功率 2006=视在功率 200A=功率因数
//
// 不平衡率类：
//   属性 02 = 数值，索引 00=单值
//   OI: 2026=电压不平衡率 2027=电流不平衡率
//
// 最大需量类（Class ID 2）：
//   属性 02 = 结构体(数值+时间)，索引 00=数组(总+费率1-4) 01=总
//   OI: 1010=正向有功最大需量 1020=反向有功最大需量 1030=组合无功1最大需量 1040=组合无功2最大需量
function getDataIdentifierDescription698(oad) {
    var descriptions = {
        // 电能量类 - 属性04（扩展精度数组，旧格式兼容）
        '00100400': '正向有功总及费率(扩展精度数组)',
        '00200400': '反向有功总及费率(扩展精度数组)',
        '00300400': '组合无功1总及费率(扩展精度数组)',
        '00400400': '组合无功2总及费率(扩展精度数组)',
        '00500400': '第一象限无功总及费率(扩展精度数组)',
        '00600400': '第二象限无功总及费率(扩展精度数组)',
        '00700400': '正向无功总及费率(扩展精度数组)',
        '00800400': '组合无功3总及费率(扩展精度数组)',
        // 电能量类 - 属性02数组（索引00）
        '00100200': '正向有功总及各费率电能量数组',
        '00200200': '反向有功总及各费率电能量数组',
        '00300200': '组合无功1总及各费率电能量数组',
        '00400200': '组合无功2总及各费率电能量数组',
        // 电能量类 - 属性02单值（索引01-05）
        '00100201': '正向有功总电能',
        '00100202': '正向有功费率1电能',
        '00100203': '正向有功费率2电能',
        '00100204': '正向有功费率3电能',
        '00100205': '正向有功费率4电能',
        '00200201': '反向有功总电能',
        '00300201': '正向无功总电能(组合无功1)',
        '00400201': '反向无功总电能(组合无功2)',
        // 瞬时变量类 - 电压（数组和单值）
        '20000200': '三相电压数组',
        '20000201': 'A相电压',
        '20000202': 'B相电压',
        '20000203': 'C相电压',
        // 瞬时变量类 - 电流（数组和单值）
        '20010200': '三相电流数组',
        '20010201': 'A相电流',
        '20010202': 'B相电流',
        '20010203': 'C相电流',
        // 瞬时变量类 - 电压相角
        '20020200': '三相电压相角数组',
        // 功率类 - 有功功率（数组和单值）
        '20040200': '总及各相有功功率数组',
        '20040201': '总有功功率',
        '20040202': 'A相有功功率',
        '20040203': 'B相有功功率',
        '20040204': 'C相有功功率',
        // 功率类 - 无功功率（数组和单值）
        '20050200': '总及各相无功功率数组',
        '20050201': '总无功功率',
        '20050202': 'A相无功功率',
        '20050203': 'B相无功功率',
        '20050204': 'C相无功功率',
        // 功率类 - 视在功率（数组和单值）
        '20060200': '总及各相视在功率数组',
        '20060201': '总视在功率',
        '20060202': 'A相视在功率',
        '20060203': 'B相视在功率',
        '20060204': 'C相视在功率',
        // 功率类 - 功率因数（数组和单值）
        '200A0200': '总及各相功率因数数组',
        '200A0201': '总功率因数',
        '200A0202': 'A相功率因数',
        '200A0203': 'B相功率因数',
        '200A0204': 'C相功率因数',
        // 瞬时变量类 - 不平衡率
        '20260200': '电压不平衡率',
        '20270200': '电流不平衡率',
        // 瞬时变量类 - 谐波（数组和单值）
        '200B0200': '三相电压波形失真度(总谐波)数组',
        '200B0201': 'A相电压总谐波',
        '200B0202': 'B相电压总谐波',
        '200B0203': 'C相电压总谐波',
        '200C0200': '三相电流波形失真度(总谐波)数组',
        '200C0201': 'A相电流总谐波',
        '200C0202': 'B相电流总谐波',
        '200C0203': 'C相电流总谐波',
        // 最大需量类（数组和单值）
        '10100200': '正向有功总及各费率最大需量数组',
        '10100201': '正向有功总最大需量',
        '10200200': '反向有功总及各费率最大需量数组',
        '10300200': '组合无功1总及各费率最大需量数组',
        '10300201': '组合无功1总最大需量',
        '10400200': '组合无功2总及各费率最大需量数组',
        '10400201': '组合无功2总最大需量',
        // 时间类
        '40000200': '当前时间'
    };
    return descriptions[oad] || '未知OAD(' + oad + ')';
}

// --- 698 协议数据解析函数 ---

// 解析 698 协议 long64-unsigned（8 字节大端）为 kWh，高精度除以 10000
// 注意：Nashorn 不支持 BigInt，使用手动解析避免精度问题
function parse698Long64UnsignedKwh(hexStr) {
    if (!hexStr || hexStr.length < 16) return null;
    try {
        // 方法1：尝试使用 BigInt（如果支持）
        if (typeof BigInt !== 'undefined') {
            var val = BigInt('0x' + hexStr);
            return (Number(val) / 10000).toFixed(4).replace(/\.?0+$/, '') || '0';
        }
        
        // 方法2：手动解析（兼容 Nashorn）
        // 将 16 位十六进制拆分为高 8 位和低 8 位
        var high = parseInt(hexStr.substr(0, 8), 16);  // 高 32 位
        var low = parseInt(hexStr.substr(8, 8), 16);   // 低 32 位
        
        // 计算：high * 2^32 + low，然后除以 10000
        // 为避免精度问题，分别计算整数部分和小数部分
        var highValue = high * 429496.7296;  // high * (2^32 / 10000)
        var lowValue = low / 10000;
        var total = highValue + lowValue;
        
        return total.toFixed(4).replace(/\.?0+$/, '') || '0';
    } catch (e) {
        return null;
    }
}

// 解析 698 协议 long/short 数值（4B 大端 / 2B 大端），按 divisor 折算
function parse698Num(hexStr, byteLen, divisor) {
    if (!hexStr || hexStr.length < byteLen * 2) return null;
    divisor = divisor || 1;
    try {
        var val = parseInt(hexStr.substr(0, byteLen * 2), 16);
        if (byteLen <= 2 && val >= 0x8000) val -= 0x10000;
        if (byteLen === 4 && val >= 0x80000000) val -= 0x100000000;
        return (val / divisor).toString();
    } catch (e) {
        return null;
    }
}

// 解析 698 APDU 中单个 OAD 的值（GetResponse 85 01 + OAD + 01 01 + 数据类型 + 数据）
// 用于解析单个数值，如 00100201（正向有功总电能）、20000201（A相电压）等
function parse698SingleValue(apduHex, oadHex, divisor) {
    var apdu = apduHex.toLowerCase();
    // 尝试两种格式：
    // 格式1：OAD + 01 01 + 数据类型 + 数据（标准格式）
    // 格式2：OAD + 00 01 + 数据类型 + 数据（APDU 类型 10 00 等）
    var marker1 = oadHex.toLowerCase() + '0101';
    var marker2 = oadHex.toLowerCase() + '0001';
    var idx = apdu.indexOf(marker1);
    var marker = marker1;
    if (idx === -1) {
        idx = apdu.indexOf(marker2);
        marker = marker2;
    }
    if (idx === -1) return null;
    var dataStart = idx + marker.length;
    if (dataStart + 2 > apdu.length) return null;
    var typeHex = apdu.substr(dataStart, 2);
    var byteLen = 0;
    var dataOffset = dataStart + 2;
    // 数据类型：05=double-long(4B) 06=double-long-unsigned(4B) 09=long(4B) 10=short(2B) 15=long64(8B) 16=long64-unsigned(8B)
    if (typeHex === '05' || typeHex === '06') byteLen = 4; // double-long / double-long-unsigned
    else if (typeHex === '09') byteLen = 4; // long
    else if (typeHex === '10') byteLen = 2; // short
    else if (typeHex === '15' || typeHex === '16') {
        // long64，用于电能量
        if (dataOffset + 16 > apdu.length) return null;
        var valueHex = apdu.substr(dataOffset, 16);
        return parse698Long64UnsignedKwh(valueHex);
    }
    else return null;
    if (dataOffset + byteLen * 2 > apdu.length) return null;
    var valueHex = apdu.substr(dataOffset, byteLen * 2);
    return parse698Num(valueHex, byteLen, divisor || 1);
}

// 解析 698 APDU 中数组类型 OAD 的值（GetResponse 85 01 + OAD + 结果标识 + 数据类型 + 数组数据）
// 用于解析数组，如 00100200（正向有功总及费率数组）、20000200（三相电压数组）等
// 返回数组，如 ['12345.67', '3456.78', ...]
function parse698ArrayValue(apduHex, oadHex, divisor) {
    var apdu = apduHex.toLowerCase();
    // 尝试两种格式：
    // 格式1：OAD + 01 01 + 数组数据（结果标识01=成功 + 数据类型01=array）
    // 格式2：OAD + 00 01 + 数组数据（结果标识00=成功 + 数据类型01=array，APDU 类型 10 00 等）
    var marker1 = oadHex.toLowerCase() + '0101';
    var marker2 = oadHex.toLowerCase() + '0001';
    var idx = apdu.indexOf(marker1);
    var marker = marker1;
    if (idx === -1) {
        idx = apdu.indexOf(marker2);
        marker = marker2;
    }
    if (idx === -1) return null;
    // dataStart 指向数组长度（已经跳过了 OAD + 结果标识 + 数据类型）
    var dataStart = idx + marker.length;
    if (dataStart + 2 > apdu.length) return null;
    
    // 读取数组长度
    var arrayLen = parseInt(apdu.substr(dataStart, 2), 16);
    if (arrayLen === 0 || arrayLen > 20) return null; // 合理范围检查
    
    // 读取元素类型（可能是统一类型，也可能每个元素都有类型）
    var elemTypeOffset = dataStart + 2;
    if (elemTypeOffset + 2 > apdu.length) return null;
    var elemTypeHex = apdu.substr(elemTypeOffset, 2);
    var byteLen = 0;
    // 元素数据类型：05=double-long(4B) 06=short(2B) 09=long(4B) 10=short(2B) 12=long-unsigned(2B) 15=long64(8B) 16=long64-unsigned(8B)
    if (elemTypeHex === '06' || elemTypeHex === '10' || elemTypeHex === '12') byteLen = 2;
    else if (elemTypeHex === '05' || elemTypeHex === '09') byteLen = 4;
    else if (elemTypeHex === '15' || elemTypeHex === '16') byteLen = 8;
    else return null;
    
    // 先尝试格式2：每个元素带类型标识（数组长度 + (元素类型 + 数据) × N）
    // 这是更常见的格式
    var result = [];
    var dataOffset = dataStart + 2;  // 跳过数组长度
    var format2Success = true;
    for (var i = 0; i < arrayLen; i++) {
        if (dataOffset + 2 > apdu.length) {
            format2Success = false;
            break;
        }
        var elemType2 = apdu.substr(dataOffset, 2);
        var byteLen2 = 0;
        if (elemType2 === '06' || elemType2 === '10' || elemType2 === '12') byteLen2 = 2;
        else if (elemType2 === '05' || elemType2 === '09') byteLen2 = 4;
        else if (elemType2 === '15' || elemType2 === '16') byteLen2 = 8;
        else {
            format2Success = false;
            break;
        }
        
        dataOffset += 2;
        if (dataOffset + byteLen2 * 2 > apdu.length) {
            format2Success = false;
            break;
        }
        var valueHex = apdu.substr(dataOffset, byteLen2 * 2);
        var val = null;
        if (byteLen2 === 8) {
            val = parse698Long64UnsignedKwh(valueHex);
        } else {
            val = parse698Num(valueHex, byteLen2, divisor || 1);
        }
        if (val !== null) result.push(val);
        dataOffset += byteLen2 * 2;
    }
    
    // 如果格式2成功且解析出了数据，返回结果
    if (format2Success && result.length > 0) {
        return result;
    }
    
    // 尝试格式1：统一元素类型（数组长度 + 元素类型 + 数据数据数据...）
    result = [];
    dataOffset = elemTypeOffset + 2;
    for (var i = 0; i < arrayLen; i++) {
        var elemOffset = dataOffset + i * byteLen * 2;
        if (elemOffset + byteLen * 2 > apdu.length) {
            break;
        }
        var valueHex = apdu.substr(elemOffset, byteLen * 2);
        var val = null;
        if (byteLen === 8) {
            // long64，用于电能量
            val = parse698Long64UnsignedKwh(valueHex);
        } else {
            val = parse698Num(valueHex, byteLen, divisor || 1);
        }
        if (val !== null) result.push(val);
    }
    
    return result.length > 0 ? result : null;
}

// 从 698 APDU 中解析 GetResponse(85 01) 某 OAD 的 array of long64-unsigned（5 个元素）
// oadHex: '00100400' 正向有功, '00700400' 正向无功 等
function parse698EnergyArray(apduHex, oadHex, fieldNames) {
    var result = {};
    var apdu = apduHex.toLowerCase();
    var marker = oadHex.toLowerCase() + '01010515';
    var idx = apdu.indexOf(marker);
    if (idx === -1) return result;
    var ok = (idx >= 4 && apdu.substr(idx - 4, 2) === '85' && apdu.substr(idx - 2, 2) === '01') ||
             (idx >= 6 && apdu.substr(idx - 6, 2) === '85' && apdu.substr(idx - 4, 2) === '01');
    if (!ok) return result;
    var dataStart = idx + marker.length;
    for (var i = 0; i < 5; i++) {
        var offset = i === 0 ? dataStart : dataStart + 16 + (i - 1) * 18;
        if (offset + (i === 0 ? 16 : 18) > apduHex.length) break;
        if (i > 0 && apduHex.substr(offset, 2).toLowerCase() !== '15') break;
        var valueHex = apduHex.substr(i === 0 ? offset : offset + 2, 16);
        var val = parse698Long64UnsignedKwh(valueHex);
        if (val != null) result[fieldNames[i]] = val;
    }
    return result;
}

// 解析 698 APDU 中 GetResponse 的 array of long(09)/short(06)：OAD + 01 01 + len + type + 数据
// type 09=4 字节/元素，06=2 字节/元素；divisor 为数值折算分母（如 100 表示 0.01 单位）
function parse698MeasurementArray(apduHex, oadHex, fieldNames, divisor) {
    var result = {};
    var apdu = apduHex.toLowerCase();
    var marker = oadHex.toLowerCase() + '0101';
    var idx = apdu.indexOf(marker);
    if (idx === -1) return result;
    var ok = (idx >= 4 && apdu.substr(idx - 4, 2) === '85' && apdu.substr(idx - 2, 2) === '01') ||
             (idx >= 6 && apdu.substr(idx - 6, 2) === '85' && apdu.substr(idx - 4, 2) === '01');
    if (!ok) return result;
    var dataStart = idx + marker.length;
    if (dataStart + 4 > apdu.length) return result;
    var len = parseInt(apdu.substr(dataStart, 2), 16);
    var typeHex = apdu.substr(dataStart + 2, 2);
    var bytePerElem = (typeHex === '09') ? 4 : (typeHex === '06') ? 2 : 0;
    if (!bytePerElem || len > fieldNames.length) return result;
    var charPerElem = bytePerElem * 2;
    dataStart += 4;
    for (var i = 0; i < len && (dataStart + i * charPerElem + charPerElem) <= apdu.length; i++) {
        var valueHex = apdu.substr(dataStart + i * charPerElem, charPerElem);
        var val = parse698Num(valueHex, bytePerElem, divisor || 1);
        if (val != null) result[fieldNames[i]] = val;
    }
    return result;
}

// 解析 698 APDU 中的电能量类 OAD（00100400/00700400/00300400/00500400 等，同结构 5×long64）
function parse698ForwardActiveEnergy(apduHex) {
    var result = {};
    var r;
    // 属性04格式（扩展精度数组）
    // 协议标准：Scaler = -4，单位 kWh/kvarh，分辨率 0.0001
    // parse698Long64UnsignedKwh 函数内部除以 10000，符合标准
    r = parse698EnergyArray(apduHex, '00100400', ['kwhp', 'kwhp1', 'kwhp2', 'kwhp3', 'kwhp4']);
    for (var k in r) result[k] = r[k];
    r = parse698EnergyArray(apduHex, '00200400', ['kwhn', 'kwhn1', 'kwhn2', 'kwhn3', 'kwhn4']);
    for (var k in r) result[k] = r[k];
    r = parse698EnergyArray(apduHex, '00600400', ['kvar4', 'kvar4_1', 'kvar4_2', 'kvar4_3', 'kvar4_4']);
    for (var k in r) result[k] = r[k];
    r = parse698EnergyArray(apduHex, '00700400', ['kvarhp', 'kvarhp1', 'kvarhp2', 'kvarhp3', 'kvarhp4']);
    for (var k in r) result[k] = r[k];
    r = parse698EnergyArray(apduHex, '00300400', ['kvar1', 'kvar1_1', 'kvar1_2', 'kvar1_3', 'kvar1_4']);
    for (var k in r) result[k] = r[k];
    r = parse698EnergyArray(apduHex, '00500400', ['kvar2', 'kvar2_1', 'kvar2_2', 'kvar2_3', 'kvar2_4']);
    for (var k in r) result[k] = r[k];
    r = parse698EnergyArray(apduHex, '00800400', ['kvar3', 'kvar3_1', 'kvar3_2', 'kvar3_3', 'kvar3_4']);
    for (var k in r) result[k] = r[k];
    
    // 属性02数组格式（索引00，标准格式）
    // 协议标准：Scaler = -2，单位 kWh/kvarh，分辨率 0.01
    var arr;
    arr = parse698ArrayValue(apduHex, '00100200', 100);
    if (arr && arr.length >= 1) result.kwhp = arr[0];
    if (arr && arr.length >= 2) result.kwhp1 = arr[1];
    if (arr && arr.length >= 3) result.kwhp2 = arr[2];
    if (arr && arr.length >= 4) result.kwhp3 = arr[3];
    if (arr && arr.length >= 5) result.kwhp4 = arr[4];
    
    arr = parse698ArrayValue(apduHex, '00200200', 100);
    if (arr && arr.length >= 1) result.kwhn = arr[0];
    if (arr && arr.length >= 2) result.kwhn1 = arr[1];
    if (arr && arr.length >= 3) result.kwhn2 = arr[2];
    if (arr && arr.length >= 4) result.kwhn3 = arr[3];
    if (arr && arr.length >= 5) result.kwhn4 = arr[4];
    
    arr = parse698ArrayValue(apduHex, '00300200', 100);
    if (arr && arr.length >= 1) result.kvarhp = arr[0];
    
    arr = parse698ArrayValue(apduHex, '00400200', 100);
    if (arr && arr.length >= 1) result.kvarhn = arr[0];
    
    // 属性02单值格式（索引01-05，标准格式）
    // 协议标准：Scaler = -2，单位 kWh/kvarh，分辨率 0.01
    var v;
    v = parse698SingleValue(apduHex, '00100201', 100); if (v) result.kwhp = v;
    v = parse698SingleValue(apduHex, '00100202', 100); if (v) result.kwhp1 = v;
    v = parse698SingleValue(apduHex, '00100203', 100); if (v) result.kwhp2 = v;
    v = parse698SingleValue(apduHex, '00100204', 100); if (v) result.kwhp3 = v;
    v = parse698SingleValue(apduHex, '00100205', 100); if (v) result.kwhp4 = v;
    v = parse698SingleValue(apduHex, '00200201', 100); if (v) result.kwhn = v;
    v = parse698SingleValue(apduHex, '00300201', 100); if (v) result.kvarhp = v;
    v = parse698SingleValue(apduHex, '00400201', 100); if (v) result.kvarhn = v;
    
    return result;
}

// 从 698 APDU 中提取所有 GetResponse(85 01) 的 OAD（4 字节），用于返回未解析项
function extract698OadsFromApdu(apduHex) {
    var apdu = apduHex.toLowerCase();
    var oads = [];
    var idx = 0;
    while ((idx = apdu.indexOf('8501', idx)) >= 0) {
        if (idx + 14 <= apdu.length) {
            var oad = apdu.substr(idx + 6, 8);  // 85 01(4 字符) + PIID(2 字符) 后取 OAD 4 字节=8 字符
            var resultType = apdu.substr(idx + 14, 2);
            if (resultType === '01') {
                oads.push(oad);
            }
        }
        idx += 2;
    }
    return oads;
}

// 解析 698 APDU 中的电压、电流、有功功率、无功功率、视在功率、功率因数、不平衡率、谐波（测量量，OI 20xx，属性 02）
function parse698VoltageCurrentPower(apduHex) {
    var result = {};
    var v, arr;
    
    // 电压（OI 2000）- 数组格式（索引00，三相）
    // 协议标准：Scaler = -1，单位 V，分辨率 0.1 V
    // 尝试完整 OAD 格式（20000200）和简化格式（200002）
    arr = parse698ArrayValue(apduHex, '20000200', 10);
    if (!arr) arr = parse698ArrayValue(apduHex, '200002', 10);
    if (arr && arr.length >= 1) result.ua = arr[0];
    if (arr && arr.length >= 2) result.ub = arr[1];
    if (arr && arr.length >= 3) result.uc = arr[2];
    // 电压 - 单值格式（索引01/02/03，A/B/C相）
    v = parse698SingleValue(apduHex, '20000201', 10); if (v) result.ua = v;
    v = parse698SingleValue(apduHex, '20000202', 10); if (v) result.ub = v;
    v = parse698SingleValue(apduHex, '20000203', 10); if (v) result.uc = v;
    
    // 电流（OI 2001）- 数组格式（索引00，三相）
    // 协议标准：Scaler = -3，单位 A，分辨率 0.001 A
    // 尝试完整 OAD 格式（20010200）和简化格式（200102）
    arr = parse698ArrayValue(apduHex, '20010200', 1000);
    if (!arr) arr = parse698ArrayValue(apduHex, '200102', 1000);
    if (arr && arr.length >= 1) result.ia = arr[0];
    if (arr && arr.length >= 2) result.ib = arr[1];
    if (arr && arr.length >= 3) result.ic = arr[2];
    // 电流 - 单值格式（索引01/02/03，A/B/C相）
    v = parse698SingleValue(apduHex, '20010201', 1000); if (v) result.ia = v;
    v = parse698SingleValue(apduHex, '20010202', 1000); if (v) result.ib = v;
    v = parse698SingleValue(apduHex, '20010203', 1000); if (v) result.ic = v;
    
    // 有功功率（OI 2004）- 数组格式（索引00，总+三相）
    // 协议标准：Scaler = -1，单位 W，分辨率 0.1 W
    arr = parse698ArrayValue(apduHex, '20040200', 10);
    if (arr && arr.length >= 1) result.pt = arr[0];
    if (arr && arr.length >= 2) result.pa = arr[1];
    if (arr && arr.length >= 3) result.pb = arr[2];
    if (arr && arr.length >= 4) result.pc = arr[3];
    // 有功功率 - 单值格式（索引01/02/03/04，总/A/B/C相）
    v = parse698SingleValue(apduHex, '20040201', 10); if (v) result.pt = v;
    v = parse698SingleValue(apduHex, '20040202', 10); if (v) result.pa = v;
    v = parse698SingleValue(apduHex, '20040203', 10); if (v) result.pb = v;
    v = parse698SingleValue(apduHex, '20040204', 10); if (v) result.pc = v;
    
    // 无功功率（OI 2005）- 数组格式（索引00，总+三相）
    // 协议标准：Scaler = -1，单位 var，分辨率 0.1 var
    arr = parse698ArrayValue(apduHex, '20050200', 10);
    if (arr && arr.length >= 1) result.qt = arr[0];
    if (arr && arr.length >= 2) result.q1 = arr[1];
    if (arr && arr.length >= 3) result.q2 = arr[2];
    if (arr && arr.length >= 4) result.q3 = arr[3];
    // 无功功率 - 单值格式（索引01/02/03/04，总/A/B/C相）
    v = parse698SingleValue(apduHex, '20050201', 10); if (v) result.qt = v;
    v = parse698SingleValue(apduHex, '20050202', 10); if (v) result.q1 = v;
    v = parse698SingleValue(apduHex, '20050203', 10); if (v) result.q2 = v;
    v = parse698SingleValue(apduHex, '20050204', 10); if (v) result.q3 = v;
    
    // 视在功率（OI 2006）- 数组格式（索引00，总+三相）
    // 协议标准：Scaler = -1，单位 VA，分辨率 0.1 VA
    arr = parse698ArrayValue(apduHex, '20060200', 10);
    if (arr && arr.length >= 1) result.st = arr[0];
    if (arr && arr.length >= 2) result.sa = arr[1];
    if (arr && arr.length >= 3) result.sb = arr[2];
    if (arr && arr.length >= 4) result.sc = arr[3];
    // 视在功率 - 单值格式（索引01/02/03/04，总/A/B/C相）
    v = parse698SingleValue(apduHex, '20060201', 10); if (v) result.st = v;
    v = parse698SingleValue(apduHex, '20060202', 10); if (v) result.sa = v;
    v = parse698SingleValue(apduHex, '20060203', 10); if (v) result.sb = v;
    v = parse698SingleValue(apduHex, '20060204', 10); if (v) result.sc = v;
    
    // 功率因数（OI 200A）- 数组格式（索引00，总+三相）
    // 协议标准：Scaler = -3，无单位，分辨率 0.001
    arr = parse698ArrayValue(apduHex, '200A0200', 1000);
    if (arr && arr.length >= 1) result.pft = arr[0];
    if (arr && arr.length >= 2) result.pf1 = arr[1];
    if (arr && arr.length >= 3) result.pf2 = arr[2];
    if (arr && arr.length >= 4) result.pf3 = arr[3];
    // 功率因数 - 单值格式（索引01/02/03/04，总/A/B/C相）
    v = parse698SingleValue(apduHex, '200A0201', 1000); if (v) result.pft = v;
    v = parse698SingleValue(apduHex, '200A0202', 1000); if (v) result.pf1 = v;
    v = parse698SingleValue(apduHex, '200A0203', 1000); if (v) result.pf2 = v;
    v = parse698SingleValue(apduHex, '200A0204', 1000); if (v) result.pf3 = v;
    
    // 不平衡率（OI 2026/2027，索引00）
    // 协议标准：Scaler = -2，单位 %，分辨率 0.01 %
    v = parse698SingleValue(apduHex, '20260200', 100); if (v) result.u_unbalance_rate = v;
    v = parse698SingleValue(apduHex, '20270200', 100); if (v) result.i_unbalance_rate = v;
    
    // 电压谐波/波形失真度（OI 200B）- 数组格式（索引00，三相）
    // 协议标准：Scaler = -2，单位 %，分辨率 0.01 %
    arr = parse698ArrayValue(apduHex, '200B0200', 100);
    if (arr && arr.length >= 1) result.u_thd1 = arr[0];
    if (arr && arr.length >= 2) result.u_thd2 = arr[1];
    if (arr && arr.length >= 3) result.u_thd3 = arr[2];
    // 电压谐波 - 单值格式（索引01/02/03，A/B/C相）
    v = parse698SingleValue(apduHex, '200B0201', 100); if (v) result.u_thd1 = v;
    v = parse698SingleValue(apduHex, '200B0202', 100); if (v) result.u_thd2 = v;
    v = parse698SingleValue(apduHex, '200B0203', 100); if (v) result.u_thd3 = v;
    
    // 电流谐波/波形失真度（OI 200C）- 数组格式（索引00，三相）
    // 协议标准：Scaler = -2，单位 %，分辨率 0.01 %
    arr = parse698ArrayValue(apduHex, '200C0200', 100);
    if (arr && arr.length >= 1) result.i_thd1 = arr[0];
    if (arr && arr.length >= 2) result.i_thd2 = arr[1];
    if (arr && arr.length >= 3) result.i_thd3 = arr[2];
    // 电流谐波 - 单值格式（索引01/02/03，A/B/C相）
    v = parse698SingleValue(apduHex, '200C0201', 100); if (v) result.i_thd1 = v;
    v = parse698SingleValue(apduHex, '200C0202', 100); if (v) result.i_thd2 = v;
    v = parse698SingleValue(apduHex, '200C0203', 100); if (v) result.i_thd3 = v;
    
    return result;
}

// 解析 698 APDU 中的最大需量类 OAD（1010/1020/1030/1040，属性 02）
// 协议标准：Scaler = -4，单位 kW/kvar，分辨率 0.0001
// 注意：最大需量返回的可能是单个值（double-long）而不是结构体数组
function parse698MaxDemand(apduHex) {
    var result = {};
    var v;
    
    // 正向有功最大需量（OI 1010）- 单值格式
    v = parse698SingleValue(apduHex, '10100200', 10000); if (v) result.demand_max = v;
    v = parse698SingleValue(apduHex, '10100201', 10000); if (v) result.demand_max = v;
    
    // 反向有功最大需量（OI 1020）- 单值格式
    v = parse698SingleValue(apduHex, '10200200', 10000); if (v) result.demand_max_reverse = v;
    v = parse698SingleValue(apduHex, '10200201', 10000); if (v) result.demand_max_reverse = v;
    
    // 组合无功1最大需量（OI 1030）- 单值格式
    v = parse698SingleValue(apduHex, '10300200', 10000); if (v) result.demand_max_reactive1 = v;
    v = parse698SingleValue(apduHex, '10300201', 10000); if (v) result.demand_max_reactive1 = v;
    
    // 组合无功2最大需量（OI 1040）- 单值格式
    v = parse698SingleValue(apduHex, '10400200', 10000); if (v) result.demand_max_reactive2 = v;
    v = parse698SingleValue(apduHex, '10400201', 10000); if (v) result.demand_max_reactive2 = v;
    
    return result;
}

// ========== 通用工具函数 ==========

// 安全乘法（用于倍率计算）
function safeMultiply(value, multiplier) {
    return value ? (parseFloat((parseFloat(value) * multiplier).toFixed(3))).toString() : null;
}

// 设置设备倍率（CT/PT）
function setRate(data, deviceKey) {
    if (!data || !deviceKey) {
        return;
    }

    var ct = 1;
    var pt = 1;

    if (deviceRates[deviceKey]) {
        var rates = deviceRates[deviceKey];
        ct = parseFloat(rates.ct.split('/')[0]) / parseFloat(rates.ct.split('/')[1]);
        pt = parseFloat(rates.pt.split('/')[0]) / parseFloat(rates.pt.split('/')[1]);
    } else {
        return;
    }

    // 正向有功总电能（需要乘以PT和CT的倍率）
    if (data.kwhp) data.kwhp = safeMultiply(data.kwhp, pt * ct);
    // 正向有功费率1电能（需要乘以PT和CT的倍率）
    if (data.kwhp1) data.kwhp1 = safeMultiply(data.kwhp1, pt * ct);
    // 正向有功费率2电能（需要乘以PT和CT的倍率）
    if (data.kwhp2) data.kwhp2 = safeMultiply(data.kwhp2, pt * ct);
    // 正向有功费率3电能（需要乘以PT和CT的倍率）
    if (data.kwhp3) data.kwhp3 = safeMultiply(data.kwhp3, pt * ct);
    // 正向有功费率4电能（需要乘以PT和CT的倍率）
    if (data.kwhp4) data.kwhp4 = safeMultiply(data.kwhp4, pt * ct);
    // 反向有功总电能（需要乘以PT和CT的倍率）
    if (data.kwhn) data.kwhn = safeMultiply(data.kwhn, pt * ct);
    if (data.kwhn1) data.kwhn1 = safeMultiply(data.kwhn1, pt * ct);
    if (data.kwhn2) data.kwhn2 = safeMultiply(data.kwhn2, pt * ct);
    if (data.kwhn3) data.kwhn3 = safeMultiply(data.kwhn3, pt * ct);
    if (data.kwhn4) data.kwhn4 = safeMultiply(data.kwhn4, pt * ct);
    // 正向无功总电能（需要乘以PT和CT的倍率）
    if (data.kvarhp) data.kvarhp = safeMultiply(data.kvarhp, pt * ct);
    // 反向无功总电能（需要乘以PT和CT的倍率）
    if (data.kvarhn) data.kvarhn = safeMultiply(data.kvarhn, pt * ct);
    // 组合无功1/2 总及费率（需要乘以PT和CT的倍率）
    if (data.kvar1) data.kvar1 = safeMultiply(data.kvar1, pt * ct);
    if (data.kvar1_1) data.kvar1_1 = safeMultiply(data.kvar1_1, pt * ct);
    if (data.kvar1_2) data.kvar1_2 = safeMultiply(data.kvar1_2, pt * ct);
    if (data.kvar1_3) data.kvar1_3 = safeMultiply(data.kvar1_3, pt * ct);
    if (data.kvar1_4) data.kvar1_4 = safeMultiply(data.kvar1_4, pt * ct);
    if (data.kvar2) data.kvar2 = safeMultiply(data.kvar2, pt * ct);
    if (data.kvar2_1) data.kvar2_1 = safeMultiply(data.kvar2_1, pt * ct);
    if (data.kvar2_2) data.kvar2_2 = safeMultiply(data.kvar2_2, pt * ct);
    if (data.kvar2_3) data.kvar2_3 = safeMultiply(data.kvar2_3, pt * ct);
    if (data.kvar2_4) data.kvar2_4 = safeMultiply(data.kvar2_4, pt * ct);
    if (data.kvar3) data.kvar3 = safeMultiply(data.kvar3, pt * ct);
    if (data.kvar3_1) data.kvar3_1 = safeMultiply(data.kvar3_1, pt * ct);
    if (data.kvar3_2) data.kvar3_2 = safeMultiply(data.kvar3_2, pt * ct);
    if (data.kvar3_3) data.kvar3_3 = safeMultiply(data.kvar3_3, pt * ct);
    if (data.kvar3_4) data.kvar3_4 = safeMultiply(data.kvar3_4, pt * ct);
    if (data.kvar4) data.kvar4 = safeMultiply(data.kvar4, pt * ct);
    if (data.kvar4_1) data.kvar4_1 = safeMultiply(data.kvar4_1, pt * ct);
    if (data.kvar4_2) data.kvar4_2 = safeMultiply(data.kvar4_2, pt * ct);
    if (data.kvar4_3) data.kvar4_3 = safeMultiply(data.kvar4_3, pt * ct);
    if (data.kvar4_4) data.kvar4_4 = safeMultiply(data.kvar4_4, pt * ct);
    // A相电压（需要乘以PT的倍率）
    if (data.ua) data.ua = safeMultiply(data.ua, pt);
    // B相电压（需要乘以PT的倍率）
    if (data.ub) data.ub = safeMultiply(data.ub, pt);
    // C相电压（需要乘以PT的倍率）
    if (data.uc) data.uc = safeMultiply(data.uc, pt);
    // A相电流（需要乘以CT的倍率）
    if (data.ia) data.ia = safeMultiply(data.ia, ct);
    // B相电流（需要乘以CT的倍率）
    if (data.ib) data.ib = safeMultiply(data.ib, ct);
    // C相电流（需要乘以CT的倍率）
    if (data.ic) data.ic = safeMultiply(data.ic, ct);
    // 总有功功率（需要乘以PT和CT的倍率）
    if (data.pt) data.pt = safeMultiply(data.pt, pt * ct);
    // A相有功功率（需要乘以PT和CT的倍率）
    if (data.pa) data.pa = safeMultiply(data.pa, pt * ct);
    // B相有功功率（需要乘以PT和CT的倍率）
    if (data.pb) data.pb = safeMultiply(data.pb, pt * ct);
    // C相有功功率（需要乘以PT和CT的倍率）
    if (data.pc) data.pc = safeMultiply(data.pc, pt * ct);
    // 总无功功率（需要乘以PT和CT的倍率）
    if (data.qt) data.qt = safeMultiply(data.qt, pt * ct);
    // A相无功功率（需要乘以PT和CT的倍率）
    if (data.q1) data.q1 = safeMultiply(data.q1, pt * ct);
    // B相无功功率（需要乘以PT和CT的倍率）
    if (data.q2) data.q2 = safeMultiply(data.q2, pt * ct);
    // C相无功功率（需要乘以PT和CT的倍率）
    if (data.q3) data.q3 = safeMultiply(data.q3, pt * ct);
    // 总视在功率（需要乘以PT和CT的倍率）
    if (data.st) data.st = safeMultiply(data.st, pt * ct);
    // A相视在功率（需要乘以PT和CT的倍率）
    if (data.sa) data.sa = safeMultiply(data.sa, pt * ct);
    // B相视在功率（需要乘以PT和CT的倍率）
    if (data.sb) data.sb = safeMultiply(data.sb, pt * ct);
    // C相视在功率（需要乘以PT和CT的倍率）
    if (data.sc) data.sc = safeMultiply(data.sc, pt * ct);

    // 功率因数、不平衡率、谐波含量不应用倍率（无量纲或百分比）
    // pft, pf1, pf2, pf3, u_unbalance_rate, i_unbalance_rate, u_thd1, u_thd2, u_thd3, i_thd1, i_thd2, i_thd3

    // 最大需量类数据（需要乘以PT和CT的倍率）
    if (data.demand_max) data.demand_max = safeMultiply(data.demand_max, pt * ct);
    if (data.demand_max_rate1) data.demand_max_rate1 = safeMultiply(data.demand_max_rate1, pt * ct);
    if (data.demand_max_rate2) data.demand_max_rate2 = safeMultiply(data.demand_max_rate2, pt * ct);
    if (data.demand_max_rate3) data.demand_max_rate3 = safeMultiply(data.demand_max_rate3, pt * ct);
    if (data.demand_max_rate4) data.demand_max_rate4 = safeMultiply(data.demand_max_rate4, pt * ct);
}

// ========== 主解码函数 ==========

// 解码函数，用于解析消息数据
// 支持 DL/T 698.45-2017 和 DL/T 645（2007/1997）协议
this.decode = function (msg) {
    var resultDatas = [];
    var gatewayNo = msg.gatewayNo;
    var datas = msg.data.replace(/\s+/g, '');
    //console.log('datas: ' + datas);

    // --- 1. 数据预处理和帧分割 ---
    var packets = [];
    var startFlag = '68';
    var endFlag = '16';
    var currentIndex = 0;
    var workArea = datas;

    // 去除常见前导码（如 'fefefefe'）
    var knownPreambles = ["fefefefe"];
    for (var p = 0; p < knownPreambles.length; p++) {
        if (workArea.toLowerCase().startsWith(knownPreambles[p])) {
            workArea = workArea.substring(knownPreambles[p].length);
            break;
        }
    }

    while (currentIndex < workArea.length) {
        var frameStartOffset = workArea.indexOf(startFlag, currentIndex);

        if (frameStartOffset === -1) {
            break;
        }

        // 区分 698 与 645：645 帧在 68 后第 8 字节处有第二个 68；698 帧 68 后紧跟 2 字节长度（小端）
        var secondByteHex = workArea.substr(frameStartOffset + 2, 2);
        var is698 = (frameStartOffset + 6 <= workArea.length) && /^[0-9a-fA-F]{2}$/.test(secondByteHex) && (secondByteHex !== '68');
        var is645 = (frameStartOffset + 18 <= workArea.length) && workArea.substr(frameStartOffset + 14, 2) === '68';

        if (is698) {
            // DL/T 698.45：68 + L(2B 小端) + ...，L 不含起始和结束符，总帧长 = 1 + L + 1 字节
            var Llow = parseInt(workArea.substr(frameStartOffset + 2, 2), 16);
            var Lhigh = parseInt(workArea.substr(frameStartOffset + 4, 2), 16);
            var frameLen698 = (1 + Llow + (Lhigh << 8) + 1) * 2;
            if (frameStartOffset + frameLen698 <= workArea.length) {
                var p698 = workArea.substr(frameStartOffset, frameLen698);
                if (p698.endsWith(endFlag)) {
                    packets.push({ type: '698', data: p698 });
                    currentIndex = frameStartOffset + frameLen698;
                    continue;
                }
            }
        }

        if (is645 && frameStartOffset + 20 <= workArea.length) {
            var lengthByteHex = workArea.substr(frameStartOffset + 18, 2);
            if (!/^[0-9a-fA-F]{2}$/.test(lengthByteHex)) {
                currentIndex = frameStartOffset + 2;
                if (currentIndex >= workArea.length) break;
                continue;
            }
            var dataLength = parseInt(lengthByteHex, 16);
            var expectedFrameByteLength = 12 + dataLength;
            var expectedFrameCharLength = expectedFrameByteLength * 2;

            if (frameStartOffset + expectedFrameCharLength <= workArea.length) {
                var potentialPacket = workArea.substr(frameStartOffset, expectedFrameCharLength);
                if (potentialPacket.startsWith(startFlag) && potentialPacket.endsWith(endFlag) && potentialPacket.length === expectedFrameCharLength) {
                    packets.push({ type: '645', data: potentialPacket });
                    currentIndex = frameStartOffset + expectedFrameCharLength;
                    continue;
                }
            }
        }

        currentIndex = frameStartOffset + 2;
        if (currentIndex >= workArea.length) break;
    }

    // 处理每个数据包
    for (var k = 0; k < packets.length; k++) {
        var pktType = packets[k].type || '645';
        var packet = packets[k].data || packets[k];

        // --- 2. DL/T 698.45-2017 协议处理 ---
        if (pktType === '698') {
            var Llow698 = parseInt(packet.substr(2, 2), 16);
            var Lhigh698 = parseInt(packet.substr(4, 2), 16);
            var L698 = Llow698 + (Lhigh698 << 8);
            var ctrl698 = packet.substr(6, 2);
            var serverAddrChar = parseInt(packet.substr(8, 2), 16);
            var addrLen698 = (serverAddrChar & 0x0F) + 1;
            var headerLen698 = (8 + addrLen698) * 2; // 68+L(2)+Ctrl+SAC+Addr+Client+HCS(2)=14 字节起
            var apduLen698 = L698 - (8 + addrLen698) - 2; // L 含 FCS(2)，APDU = L - 帧头 - FCS
            if (apduLen698 <= 0 || headerLen698 + apduLen698 * 2 > packet.length - 6) {
                continue;
            }
            var apduHex = packet.substr(headerLen698, apduLen698 * 2);
            var serverAddr698 = packet.substr(10, addrLen698 * 2);
            var deviceNo698 = '';
            for (var r = serverAddr698.length - 2; r >= 0; r -= 2) {
                deviceNo698 += serverAddr698.substr(r, 2);
            }
            
            // 检查是否是 ReportNotification (90 00) 类型
            // ReportNotification 内部包含 GetResponse (85 01) 数据
            var apduType = apduHex.substr(0, 4).toLowerCase();
            if (apduType === '9000') {
                // ReportNotification 格式：90 00 + PIID + 若干个 GetResponse
                // 查找内部的 GetResponse 数据
                var getResponseIdx = apduHex.toLowerCase().indexOf('8501');
                if (getResponseIdx >= 0) {
                    // 提取从 GetResponse 开始的数据作为新的 APDU
                    apduHex = apduHex.substr(getResponseIdx);
                }
            }
            
            // 解析电能量、测量量和最大需量数据
            var energy698 = parse698ForwardActiveEnergy(apduHex);
            var meas698 = parse698VoltageCurrentPower(apduHex);
            var demand698 = parse698MaxDemand(apduHex);
            var data698 = {};
            var ids698 = [];
            for (var ek in energy698) data698[ek] = energy698[ek];
            for (var mk in meas698) data698[mk] = meas698[mk];
            for (var dk in demand698) data698[dk] = demand698[dk];
            
            // 提取所有 OAD 并记录未知的
            var allOads = extract698OadsFromApdu(apduHex);
            var unparsedOads = [];
            // 创建已解析 OAD 的映射（根据实际解析到的数据字段）
            var parsedOadMap = {};
            if (energy698.kwhp != null) { parsedOadMap['00100201'] = true; parsedOadMap['00100200'] = true; parsedOadMap['00100400'] = true; }
            if (energy698.kwhp1 != null) parsedOadMap['00100202'] = true;
            if (energy698.kwhp2 != null) parsedOadMap['00100203'] = true;
            if (energy698.kwhp3 != null) parsedOadMap['00100204'] = true;
            if (energy698.kwhp4 != null) parsedOadMap['00100205'] = true;
            if (energy698.kwhn != null) { parsedOadMap['00200201'] = true; parsedOadMap['00200200'] = true; parsedOadMap['00200400'] = true; }
            if (energy698.kvarhp != null) { parsedOadMap['00300201'] = true; parsedOadMap['00300200'] = true; parsedOadMap['00700400'] = true; }
            if (energy698.kvarhn != null) { parsedOadMap['00400201'] = true; parsedOadMap['00400200'] = true; }
            if (energy698.kvar1 != null) parsedOadMap['00300400'] = true;
            if (energy698.kvar2 != null) parsedOadMap['00500400'] = true;
            if (energy698.kvar3 != null) parsedOadMap['00800400'] = true;
            if (energy698.kvar4 != null) parsedOadMap['00600400'] = true;
            if (meas698.ua != null || meas698.ub != null || meas698.uc != null) { parsedOadMap['20000200'] = true; parsedOadMap['20000201'] = true; parsedOadMap['20000202'] = true; parsedOadMap['20000203'] = true; }
            if (meas698.ia != null || meas698.ib != null || meas698.ic != null) { parsedOadMap['20010200'] = true; parsedOadMap['20010201'] = true; parsedOadMap['20010202'] = true; parsedOadMap['20010203'] = true; }
            if (meas698.pt != null || meas698.pa != null || meas698.pb != null || meas698.pc != null) { parsedOadMap['20040200'] = true; parsedOadMap['20040201'] = true; parsedOadMap['20040202'] = true; parsedOadMap['20040203'] = true; parsedOadMap['20040204'] = true; }
            if (meas698.qt != null || meas698.q1 != null || meas698.q2 != null || meas698.q3 != null) { parsedOadMap['20050200'] = true; parsedOadMap['20050201'] = true; parsedOadMap['20050202'] = true; parsedOadMap['20050203'] = true; parsedOadMap['20050204'] = true; }
            if (meas698.st != null || meas698.sa != null || meas698.sb != null || meas698.sc != null) { parsedOadMap['20060200'] = true; parsedOadMap['20060201'] = true; parsedOadMap['20060202'] = true; parsedOadMap['20060203'] = true; parsedOadMap['20060204'] = true; }
            if (meas698.pft != null || meas698.pf1 != null || meas698.pf2 != null || meas698.pf3 != null) { parsedOadMap['200a0200'] = true; parsedOadMap['200a0201'] = true; parsedOadMap['200a0202'] = true; parsedOadMap['200a0203'] = true; parsedOadMap['200a0204'] = true; }
            if (meas698.u_unbalance_rate != null) parsedOadMap['20260200'] = true;
            if (meas698.i_unbalance_rate != null) parsedOadMap['20270200'] = true;
            if (meas698.u_thd1 != null || meas698.u_thd2 != null || meas698.u_thd3 != null) { parsedOadMap['200b0200'] = true; parsedOadMap['200b0201'] = true; parsedOadMap['200b0202'] = true; parsedOadMap['200b0203'] = true; }
            if (meas698.i_thd1 != null || meas698.i_thd2 != null || meas698.i_thd3 != null) { parsedOadMap['200c0200'] = true; parsedOadMap['200c0201'] = true; parsedOadMap['200c0202'] = true; parsedOadMap['200c0203'] = true; }
            if (demand698.demand_max != null) { parsedOadMap['10100200'] = true; parsedOadMap['10100201'] = true; }
            if (demand698.demand_max_reverse != null) { parsedOadMap['10200200'] = true; parsedOadMap['10200201'] = true; }
            if (demand698.demand_max_reactive1 != null) { parsedOadMap['10300200'] = true; parsedOadMap['10300201'] = true; }
            if (demand698.demand_max_reactive2 != null) { parsedOadMap['10400200'] = true; parsedOadMap['10400201'] = true; }
            
            for (var oi = 0; oi < allOads.length; oi++) {
                var oadLower = allOads[oi].toLowerCase();
                // 如果 OAD 已被解析，跳过
                if (parsedOadMap[oadLower]) continue;
                var desc = getDataIdentifierDescription698(allOads[oi]);
                // 如果描述中包含"未知OAD"，说明这个 OAD 未定义
                if (desc.indexOf('未知OAD') >= 0) {
                    unparsedOads.push(allOads[oi]);
                }
            }
            if (unparsedOads.length > 0) {
                data698.unparsed_oads = unparsedOads;
            }
            
            // 记录已解析的 OAD（根据实际解析到的数据字段）
            if (energy698.kwhp != null) ids698.push({ id: '正向有功总电能', description: getDataIdentifierDescription698('00100201') });
            if (energy698.kwhp1 != null) ids698.push({ id: '正向有功费率1电能', description: getDataIdentifierDescription698('00100202') });
            if (energy698.kwhp2 != null) ids698.push({ id: '正向有功费率2电能', description: getDataIdentifierDescription698('00100203') });
            if (energy698.kwhp3 != null) ids698.push({ id: '正向有功费率3电能', description: getDataIdentifierDescription698('00100204') });
            if (energy698.kwhp4 != null) ids698.push({ id: '正向有功费率4电能', description: getDataIdentifierDescription698('00100205') });
            if (energy698.kwhn != null) ids698.push({ id: '反向有功总电能', description: getDataIdentifierDescription698('00200201') });
            if (energy698.kvarhp != null) ids698.push({ id: '正向无功总电能', description: getDataIdentifierDescription698('00300201') });
            if (energy698.kvarhn != null) ids698.push({ id: '反向无功总电能', description: getDataIdentifierDescription698('00400201') });
            if (energy698.kvar1 != null) ids698.push({ id: '组合无功1总电能', description: getDataIdentifierDescription698('00300400') });
            if (energy698.kvar2 != null) ids698.push({ id: '第一象限无功总电能', description: getDataIdentifierDescription698('00500400') });
            if (energy698.kvar3 != null) ids698.push({ id: '组合无功3总电能', description: getDataIdentifierDescription698('00800400') });
            if (energy698.kvar4 != null) ids698.push({ id: '第二象限无功总电能', description: getDataIdentifierDescription698('00600400') });
            
            if (meas698.ua != null) ids698.push({ id: 'A相电压', description: getDataIdentifierDescription698('20000201') });
            if (meas698.ub != null) ids698.push({ id: 'B相电压', description: getDataIdentifierDescription698('20000202') });
            if (meas698.uc != null) ids698.push({ id: 'C相电压', description: getDataIdentifierDescription698('20000203') });
            if (meas698.ia != null) ids698.push({ id: 'A相电流', description: getDataIdentifierDescription698('20010201') });
            if (meas698.ib != null) ids698.push({ id: 'B相电流', description: getDataIdentifierDescription698('20010202') });
            if (meas698.ic != null) ids698.push({ id: 'C相电流', description: getDataIdentifierDescription698('20010203') });
            if (meas698.pt != null) ids698.push({ id: '总有功功率', description: getDataIdentifierDescription698('20040201') });
            if (meas698.pa != null) ids698.push({ id: 'A相有功功率', description: getDataIdentifierDescription698('20040202') });
            if (meas698.pb != null) ids698.push({ id: 'B相有功功率', description: getDataIdentifierDescription698('20040203') });
            if (meas698.pc != null) ids698.push({ id: 'C相有功功率', description: getDataIdentifierDescription698('20040204') });
            if (meas698.qt != null) ids698.push({ id: '总无功功率', description: getDataIdentifierDescription698('20050201') });
            if (meas698.q1 != null) ids698.push({ id: 'A相无功功率', description: getDataIdentifierDescription698('20050202') });
            if (meas698.q2 != null) ids698.push({ id: 'B相无功功率', description: getDataIdentifierDescription698('20050203') });
            if (meas698.q3 != null) ids698.push({ id: 'C相无功功率', description: getDataIdentifierDescription698('20050204') });
            if (meas698.st != null) ids698.push({ id: '总视在功率', description: getDataIdentifierDescription698('20060201') });
            if (meas698.sa != null) ids698.push({ id: 'A相视在功率', description: getDataIdentifierDescription698('20060202') });
            if (meas698.sb != null) ids698.push({ id: 'B相视在功率', description: getDataIdentifierDescription698('20060203') });
            if (meas698.sc != null) ids698.push({ id: 'C相视在功率', description: getDataIdentifierDescription698('20060204') });
            if (meas698.pft != null) ids698.push({ id: '总功率因数', description: getDataIdentifierDescription698('200A0201') });
            if (meas698.pf1 != null) ids698.push({ id: 'A相功率因数', description: getDataIdentifierDescription698('200A0202') });
            if (meas698.pf2 != null) ids698.push({ id: 'B相功率因数', description: getDataIdentifierDescription698('200A0203') });
            if (meas698.pf3 != null) ids698.push({ id: 'C相功率因数', description: getDataIdentifierDescription698('200A0204') });
            if (meas698.u_unbalance_rate != null) ids698.push({ id: '电压不平衡率', description: getDataIdentifierDescription698('20260200') });
            if (meas698.i_unbalance_rate != null) ids698.push({ id: '电流不平衡率', description: getDataIdentifierDescription698('20270200') });
            if (meas698.u_thd1 != null) ids698.push({ id: 'A相电压总谐波', description: getDataIdentifierDescription698('200B0201') });
            if (meas698.u_thd2 != null) ids698.push({ id: 'B相电压总谐波', description: getDataIdentifierDescription698('200B0202') });
            if (meas698.u_thd3 != null) ids698.push({ id: 'C相电压总谐波', description: getDataIdentifierDescription698('200B0203') });
            if (meas698.i_thd1 != null) ids698.push({ id: 'A相电流总谐波', description: getDataIdentifierDescription698('200C0201') });
            if (meas698.i_thd2 != null) ids698.push({ id: 'B相电流总谐波', description: getDataIdentifierDescription698('200C0202') });
            if (meas698.i_thd3 != null) ids698.push({ id: 'C相电流总谐波', description: getDataIdentifierDescription698('200C0203') });
            
            // 记录最大需量类数据
            if (demand698.demand_max != null) ids698.push({ id: '正向有功总最大需量', description: getDataIdentifierDescription698('10100200') });
            if (demand698.demand_max_reverse != null) ids698.push({ id: '反向有功总最大需量', description: getDataIdentifierDescription698('10200200') });
            if (demand698.demand_max_reactive1 != null) ids698.push({ id: '组合无功1总最大需量', description: getDataIdentifierDescription698('10300200') });
            if (demand698.demand_max_reactive2 != null) ids698.push({ id: '组合无功2总最大需量', description: getDataIdentifierDescription698('10400200') });
            
            // 添加未解析的 OAD 到标识列表
            if (unparsedOads.length > 0) {
                for (var ui = 0; ui < unparsedOads.length; ui++) {
                    ids698.push({ id: unparsedOads[ui], description: getDataIdentifierDescription698(unparsedOads[ui]) });
                }
            }
            
            if (Object.keys(data698).length > 0) {
                setRate(data698, deviceNo698);
                resultDatas.push({
                    deviceKey: deviceNo698 || '698',
                    data: data698,
                    time: (new Date()).getTime().toString(),
                    protocol_version: '698',
                    data_identifiers: ids698.length ? ids698 : [{ id: '698', description: '698数据' }]
                });
            }
            continue;
        }

        // --- 3. DL/T 645 协议处理（2007 和 1997）---
        var checkSum = 0;
        for (var i = 0; i < packet.length - 4; i += 2) {
            checkSum += parseInt(packet.substr(i, 2), 16);
        }
        checkSum %= 256;

        var checkSumHex = packet.substr(packet.length - 4, 2);
        if (checkSum !== parseInt(checkSumHex, 16)) {
            continue;
        }

        var address = parseDataReverse(packet, 2, 12);
        //console.log('地址: ' + address);

        // 设置设备编号， address 加上 gatewayNo 后六位，先判断是否有gatewayNo和是否大于6位
        var deviceNo = address;
        //if (gatewayNo != null && gatewayNo.length >= 6) {
        //    deviceNo = address + '_' + gatewayNo.substring(gatewayNo.length - 6);
        //}

        var obj = {
            // deviceKey: address,
            deviceKey: deviceNo,
            data: {},
            time: (new Date()).getTime().toString(),
            protocol_version: '',
            data_identifiers: []
        };

        // 控制码
        var controlCode = packet.substr(16, 2);
        //console.log('控制码: ' + controlCode);

        // 2007 协议
        if (controlCode === '91') {
            obj.protocol_version = '2007';

            // 数据长度
            var dataLengthHex = packet.substr(18, 2);
            var dataLength = parseInt(dataLengthHex, 16);
            //console.log('数据长度: ' + dataLength);

            // 数据域
            var data = packet.substr(20, dataLength * 2);
            //console.log('数据: ' + data);

            // 数据标识（mark）和数据定义
            var mark = parseData(data, 0, 8);
            var dataDef = data.substring(8);
            obj.data_identifiers.push({
                id: mark,
                description: getDataIdentifierDescription2007(mark)
            });
            //console.log('标识 (Mark): ' + mark);
            //console.log('数据 (Data): ' + dataDef);

            // 根据数据标识处理数据
            switch (mark) {
                case '00010000':
                    //console.log('数据标识：正向有功总电能');
                    var energyData1 = parseEnergyDataBySlice(dataDef, 0, 8, 6);
                    //console.log('解析数据：' + energyData1);
                    obj.data['kwhp'] = energyData1;
                    break;
                case '00010100':
                    //console.log('数据标识：正向有功费率 1 电能');
                    var energyData1_1 = parseEnergyDataBySlice(dataDef, 0, 8, 6);
                    //console.log('解析数据：' + energyData1_1);
                    obj.data['kwhp1'] = energyData1_1;
                    break;
                case '00010200':
                    //console.log('数据标识：正向有功费率 2 电能');
                    var energyData1_2 = parseEnergyDataBySlice(dataDef, 0, 8, 6);
                    //console.log('解析数据：' + energyData1_2);
                    obj.data['kwhp2'] = energyData1_2;
                    break;
                case '00010300':
                    //console.log('数据标识：正向有功费率 3 电能');
                    var energyData1_3 = parseEnergyDataBySlice(dataDef, 0, 8, 6);
                    //console.log('解析数据：' + energyData1_3);
                    obj.data['kwhp3'] = energyData1_3;
                    break;
                case '00010400':
                    //console.log('数据标识：正向有功费率 4 电能');
                    var energyData1_4 = parseEnergyDataBySlice(dataDef, 0, 8, 6);
                    //console.log('解析数据：' + energyData1_4);
                    obj.data['kwhp4'] = energyData1_4;
                    break;
                case '0001ff00':
                    //console.log('数据标识：正向有功电能数据块');
                    var dataBlockLength = 8;
                    var dataBlockCount = dataDef.length / dataBlockLength;
                    //console.log('数据块数量：' + dataBlockCount);
                    var energyBlocks = [];
                    for (var j = 0; j < dataBlockCount; j++) {
                        var blockData = dataDef.substr(j * dataBlockLength, dataBlockLength);
                        var energyData = parseEnergyDataBySlice(blockData, 0, dataBlockLength, 6);
                        //console.log('解析数据：' + energyData);
                        energyBlocks.push(energyData);
                    }
                    obj.data['kwhp'] = energyBlocks[0];
                    obj.data['kwhp1'] = energyBlocks[1];
                    obj.data['kwhp2'] = energyBlocks[2];
                    obj.data['kwhp3'] = energyBlocks[3];
                    obj.data['kwhp4'] = energyBlocks[4];
                    break;
                case '00020000':
                    //console.log('数据标识：反向有功总电能');
                    var energyData2 = parseEnergyDataBySlice(dataDef, 0, 8, 6);
                    //console.log('解析数据：' + energyData2);
                    obj.data['kwhn'] = energyData2;
                    break;
                case '0002ff00':
                    //console.log('数据标识：反向有功电能数据块');
                    var dataBlockLength2 = 8;
                    var dataBlockCount2 = dataDef.length / dataBlockLength2;
                    //console.log('数据块数量：' + dataBlockCount2);
                    var energyBlocks = [];
                    for (var j = 0; j < dataBlockCount2; j++) {
                        var blockData = dataDef.substr(j * dataBlockLength2, dataBlockLength2);
                        var energyData = parseEnergyDataBySlice(blockData, 0, dataBlockLength2, 6);
                        //console.log('解析数据：' + energyData);
                        energyBlocks.push(energyData);
                    }
                    obj.data['kwhn'] = energyBlocks[0];
                    break;
                case '00030000':
                    //console.log('数据标识：组合无功 1 总电能'); (通常可视为正向无功总电能)
                    var energyData2 = parseEnergyDataBySlice(dataDef, 0, 8, 6);
                    //console.log('解析数据：' + energyData2);
                    obj.data['kvarhp'] = energyData2;
                    break;
                case '0003ff00':
                    //console.log('数据标识：组合无功 1 电能数据块');(通常可视为正向无功总电能)
                    var dataBlockLength2 = 8;
                    var dataBlockCount2 = dataDef.length / dataBlockLength2;
                    //console.log('数据块数量：' + dataBlockCount2);
                    var energyBlocks = [];
                    for (var j = 0; j < dataBlockCount2; j++) {
                        var blockData = dataDef.substr(j * dataBlockLength2, dataBlockLength2);
                        var energyData = parseEnergyDataBySlice(blockData, 0, dataBlockLength2, 6);
                        //console.log('解析数据：' + energyData);
                        energyBlocks.push(energyData);
                    }
                    obj.data['kvarhp'] = energyBlocks[0];
                    break;
                case '00040000':
                    //console.log('数据标识：组合无功 2 总电能'); (通常可视为反向无功总电能)
                    var energyData2 = parseEnergyDataBySlice(dataDef, 0, 8, 6);
                    //console.log('解析数据：' + energyData2);
                    obj.data['kvarhn'] = energyData2;
                    break;
                case '0004ff00':
                    //console.log('数据标识：组合无功 2 电能数据块');(通常可视为反向无功总电能)
                    var dataBlockLength2 = 8;
                    var dataBlockCount2 = dataDef.length / dataBlockLength2;
                    //console.log('数据块数量：' + dataBlockCount2);
                    var energyBlocks = [];
                    for (var j = 0; j < dataBlockCount2; j++) {
                        var blockData = dataDef.substr(j * dataBlockLength2, dataBlockLength2);
                        var energyData = parseEnergyDataBySlice(blockData, 0, dataBlockLength2, 6);
                        //console.log('解析数据：' + energyData);
                        energyBlocks.push(energyData);
                    }
                    obj.data['kvarhn'] = energyBlocks[0];
                    break;
                case '01010000':
                    //console.log('数据标识：正向有功总最大需量及发生时间');
                    var demandValue = parseEnergyDataBySlice(dataDef, 0, 6, 2);
                    //console.log('最大需量值：' + demandValue);
                    obj.data['demand_max'] = demandValue;

                    // 解析发生时间 (后5个字节，格式：YYMMDDHHmm)
                    var timeData = parseData(dataDef, 6, 10);
                    //console.log('时间数据：' + timeData);
                    if (timeData && timeData.length >= 10) {
                        var year = '20' + timeData.slice(0, 2);
                        var month = timeData.slice(2, 4);
                        var day = timeData.slice(4, 6);
                        var hour = timeData.slice(6, 8);
                        var minute = timeData.slice(8, 10);
                        var timeStr = year + '-' + month + '-' + day + ' ' + hour + ':' + minute;
                        //console.log('发生时间：' + timeStr);
                        obj.data['demand_max_time'] = timeStr;
                    }
                    break;
                case '0101ff00':
                    //console.log('数据标识：正向有功最大需量及发生时间数据块');
                    var demandBlockLength = 16; // 每个最大需量数据块：3字节需量值 + 5字节时间 = 8字节，但实际可能是16字节
                    var demandBlockCount = dataDef.length / demandBlockLength;
                    //console.log('最大需量数据块数量：' + demandBlockCount);

                    // 定义最大需量字段名和时间字段名的对应关系
                    var demandFields = [
                        { value: 'demand_max', time: 'demand_max_time' },          // 总最大需量
                        { value: 'demand_max_rate1', time: 'demand_max_rate1_time' }, // 费率1最大需量
                        { value: 'demand_max_rate2', time: 'demand_max_rate2_time' }, // 费率2最大需量
                        { value: 'demand_max_rate3', time: 'demand_max_rate3_time' }, // 费率3最大需量
                        { value: 'demand_max_rate4', time: 'demand_max_rate4_time' }, // 费率4最大需量
                    ];

                    for (var j = 0; j < demandBlockCount && j < demandFields.length; j++) {
                        var blockData = dataDef.substr(j * demandBlockLength, demandBlockLength);

                        // 解析最大需量值 (前3个字节，保留2位小数)
                        var demandValue = parseEnergyDataBySlice(blockData, 0, 6, 2);
                        //console.log('最大需量值[' + j + ']：' + demandValue);
                        obj.data[demandFields[j].value] = demandValue;

                        // 解析发生时间 (后5个字节，格式：YYMMDDHHmm)
                        var timeData = parseData(blockData, 6, 10);
                        //console.log('时间数据[' + j + ']：' + timeData);
                        if (timeData && timeData.length >= 10) {
                            var year = '20' + timeData.slice(0, 2);
                            var month = timeData.slice(2, 4);
                            var day = timeData.slice(4, 6);
                            var hour = timeData.slice(6, 8);
                            var minute = timeData.slice(8, 10);
                            var timeStr = year + '-' + month + '-' + day + ' ' + hour + ':' + minute;
                            //console.log('发生时间[' + j + ']：' + timeStr);
                            obj.data[demandFields[j].time] = timeStr;
                        }
                    }
                    break;
                case '0201ff00':
                    //console.log('数据标识：电压数据块');
                    var dataBlockLength4 = 4;
                    var dataBlockCount4 = dataDef.length / dataBlockLength4;
                    //console.log('数据块数量：' + dataBlockCount4);
                    var voltageBlocks = [];
                    for (var j = 0; j < dataBlockCount4; j++) {
                        var blockData = dataDef.substr(j * dataBlockLength4, dataBlockLength4);
                        var voltageData = parseEnergyDataBySlice(blockData, 0, dataBlockLength4, 3);
                        //console.log('解析数据：' + voltageData);
                        voltageBlocks.push(voltageData);
                    }
                    obj.data['ua'] = voltageBlocks[0];
                    obj.data['ub'] = voltageBlocks[1];
                    obj.data['uc'] = voltageBlocks[2];
                    break;
                case '0202ff00':
                    //console.log('数据标识：电流数据块');
                    var dataBlockLength4 = 6;
                    var dataBlockCount4 = dataDef.length / dataBlockLength4;
                    //console.log('数据块数量：' + dataBlockCount4);
                    var voltageBlocks = [];
                    for (var j = 0; j < dataBlockCount4; j++) {
                        var blockData = dataDef.substr(j * dataBlockLength4, dataBlockLength4);
                        var voltageData = parseEnergyDataBySlice(blockData, 0, dataBlockLength4, 3);
                        //console.log('解析数据：' + voltageData);
                        voltageBlocks.push(voltageData);
                    }
                    obj.data['ia'] = voltageBlocks[0];
                    obj.data['ib'] = voltageBlocks[1];
                    obj.data['ic'] = voltageBlocks[2];
                    break;
                case '0203ff00':
                    //console.log('数据标识：瞬时有功功率数据块');
                    var dataBlockLength4 = 6;
                    var dataBlockCount4 = dataDef.length / dataBlockLength4;
                    //console.log('数据块数量：' + dataBlockCount4);
                    var voltageBlocks = [];
                    for (var j = 0; j < dataBlockCount4; j++) {
                        var blockData = dataDef.substr(j * dataBlockLength4, dataBlockLength4);
                        var voltageData = parseEnergyDataBySlice(blockData, 0, dataBlockLength4, 2);
                        //console.log('解析数据：' + voltageData);
                        voltageBlocks.push(voltageData);
                    }
                    obj.data['pt'] = voltageBlocks[0];
                    obj.data['pa'] = voltageBlocks[1];
                    obj.data['pb'] = voltageBlocks[2];
                    obj.data['pc'] = voltageBlocks[3];
                    break;
                case '0204ff00':
                    //console.log('数据标识：瞬时无功功率数据块');
                    var dataBlockLength4 = 6;
                    var dataBlockCount4 = dataDef.length / dataBlockLength4;
                    //console.log('数据块数量：' + dataBlockCount4);
                    var voltageBlocks = [];
                    for (var j = 0; j < dataBlockCount4; j++) {
                        var blockData = dataDef.substr(j * dataBlockLength4, dataBlockLength4);
                        var voltageData = parseEnergyDataBySlice(blockData, 0, dataBlockLength4, 2);
                        //console.log('解析数据：' + voltageData);
                        voltageBlocks.push(voltageData);
                    }
                    obj.data['qt'] = voltageBlocks[0];
                    obj.data['q1'] = voltageBlocks[1];
                    obj.data['q2'] = voltageBlocks[2];
                    obj.data['q3'] = voltageBlocks[3];
                    break;
                case '0205ff00':
                    //console.log('数据标识：瞬时视在功率数据块');
                    var dataBlockLength4 = 6;
                    var dataBlockCount4 = dataDef.length / dataBlockLength4;
                    //console.log('数据块数量：' + dataBlockCount4);
                    var voltageBlocks = [];
                    for (var j = 0; j < dataBlockCount4; j++) {
                        var blockData = dataDef.substr(j * dataBlockLength4, dataBlockLength4);
                        var voltageData = parseEnergyDataBySlice(blockData, 0, dataBlockLength4, 2);
                        //console.log('解析数据：' + voltageData);
                        voltageBlocks.push(voltageData);
                    }
                    obj.data['st'] = voltageBlocks[0];
                    obj.data['sa'] = voltageBlocks[1];
                    obj.data['sb'] = voltageBlocks[2];
                    obj.data['sc'] = voltageBlocks[3];
                    break;
                case '0206ff00':
                    //console.log('数据标识：功率因数数据块');
                    var dataBlockLength4 = 4;
                    var dataBlockCount4 = dataDef.length / dataBlockLength4;
                    //console.log('数据块数量：' + dataBlockCount4);
                    var voltageBlocks = [];
                    for (var j = 0; j < dataBlockCount4; j++) {
                        var blockData = dataDef.substr(j * dataBlockLength4, dataBlockLength4);
                        var voltageData = parseEnergyDataBySlice(blockData, 0, dataBlockLength4, 1);
                        //console.log('解析数据：' + voltageData);
                        voltageBlocks.push(voltageData);
                    }
                    obj.data['pft'] = voltageBlocks[0];
                    obj.data['pf1'] = voltageBlocks[1];
                    obj.data['pf2'] = voltageBlocks[2];
                    obj.data['pf3'] = voltageBlocks[3];
                    break;
                case '02800001':
                    //console.log('数据标识：零线电流');
                    var energyData1 = parseEnergyDataBySlice(dataDef, 0, 6, 3);
                    //console.log('解析数据：' + energyData1);
                    obj.data['inc'] = energyData1;
                    break;
                default:
                    //console.log('未知的数据标识');
                    break;
            }
            setRate(obj.data, obj.deviceKey);
            resultDatas.push(obj);
        } else if (controlCode === '81') {
            // 1997 协议
            obj.protocol_version = '1997';

            // 数据长度
            var dataLengthHex = packet.substr(18, 2);
            var dataLength = parseInt(dataLengthHex, 16);
            //console.log('数据长度: ' + dataLength);

            // 数据域
            var data = packet.substr(20, dataLength * 2);
            //console.log('数据: ' + data);

            // 数据标识（mark）和数据定义
            var mark = parseData(data, 0, 4);
            var dataDef = data.substring(4);
            obj.data_identifiers.push({
                id: mark,
                description: getDataIdentifierDescription1997(mark)
            });
            //console.log('标识 (Mark): ' + mark);
            //console.log('数据 (Data): ' + dataDef);

            // 根据数据标识处理数据
            switch (mark) {
                case '9010':
                    //console.log('数据标识： 正向有功总电能');
                    obj.data['kwhp'] = parseEnergyDataBySlice(dataDef, 0, 8, 6);
                    break;
                case '9011':
                    //console.log('数据标识： 正向有功费率 1 电能');
                    obj.data['kwhp1'] = parseEnergyDataBySlice(dataDef, 0, 8, 6);
                    break;
                case '9012':
                    //console.log('数据标识： 正向有功费率 2 电能');
                    obj.data['kwhp2'] = parseEnergyDataBySlice(dataDef, 0, 8, 6);
                    break;
                case '9013':
                    //console.log('数据标识： 正向有功费率 3 电能');
                    obj.data['kwhp3'] = parseEnergyDataBySlice(dataDef, 0, 8, 6);
                    break;
                case '9014':
                    //console.log('数据标识： 正向有功费率 4 电能');
                    obj.data['kwhp4'] = parseEnergyDataBySlice(dataDef, 0, 8, 6);
                    break;
                case '901f':
                    //console.log('数据标识： 正向有功总电能数据块');
                    var dataBlockLength = 8;
                    var dataBlockCount = dataDef.length / dataBlockLength;
                    //console.log('数据块数量：' + dataBlockCount);
                    var energyBlocks = [];
                    for (var j = 0; j < dataBlockCount; j++) {
                        var blockData = dataDef.substr(j * dataBlockLength, dataBlockLength);
                        //console.log('解析数据：' + energyData);
                        energyBlocks.push(parseEnergyDataBySlice(blockData, 0, dataBlockLength, 6));
                    }
                    obj.data['kwhp'] = energyBlocks[0];
                    obj.data['kwhp1'] = energyBlocks[1];
                    obj.data['kwhp2'] = energyBlocks[2];
                    obj.data['kwhp3'] = energyBlocks[3];
                    obj.data['kwhp4'] = energyBlocks[4];
                    break;
                case '9020':
                    //console.log('数据标识： 反向有功总电能');
                    obj.data['kwhn'] = parseEnergyDataBySlice(dataDef, 0, 8, 6);
                    break;
                case '902f':
                    //console.log('数据标识： 反向有功总电能数据块');
                    var dataBlockLength = 8;
                    var dataBlockCount = dataDef.length / dataBlockLength;
                    //console.log('数据块数量：' + dataBlockCount);
                    var energyBlocks = [];
                    for (var j = 0; j < dataBlockCount; j++) {
                        var blockData = dataDef.substr(j * dataBlockLength, dataBlockLength);
                        //console.log('解析数据：' + energyData);
                        energyBlocks.push(parseEnergyDataBySlice(blockData, 0, dataBlockLength, 6));
                    }
                    obj.data['kwhn'] = energyBlocks[0];
                    break;
                case '9110':
                    //console.log('数据标识： 正向无功总电能');
                    obj.data['kvarhp'] = parseEnergyDataBySlice(dataDef, 0, 8, 6);
                    break;
                case '911f':
                    //console.log('数据标识： 正向无功总电能数据块');
                    var dataBlockLength = 8;
                    var dataBlockCount = dataDef.length / dataBlockLength;
                    //console.log('数据块数量：' + dataBlockCount);
                    var energyBlocks = [];
                    for (var j = 0; j < dataBlockCount; j++) {
                        var blockData = dataDef.substr(j * dataBlockLength, dataBlockLength);
                        //console.log('解析数据：' + energyData);
                        energyBlocks.push(parseEnergyDataBySlice(blockData, 0, dataBlockLength, 6));
                    }
                    obj.data['kvarhp'] = energyBlocks[0];
                    break;
                case '9120':
                    //console.log('数据标识： 反向无功总电能');
                    obj.data['kvarhn'] = parseEnergyDataBySlice(dataDef, 0, 8, 6);
                    break;
                case '912f':
                    //console.log('数据标识： 反向无功总电能数据块');
                    var dataBlockLength = 8;
                    var dataBlockCount = dataDef.length / dataBlockLength;
                    //console.log('数据块数量：' + dataBlockCount);
                    var energyBlocks = [];
                    for (var j = 0; j < dataBlockCount; j++) {
                        var blockData = dataDef.substr(j * dataBlockLength, dataBlockLength);
                        //console.log('解析数据：' + energyData);
                        energyBlocks.push(parseEnergyDataBySlice(blockData, 0, dataBlockLength, 6));
                    }
                    obj.data['kvarhn'] = energyBlocks[0];
                    break;
                case 'b611':
                    //console.log('数据标识：A 相电压');
                    obj.data['ua'] = parseEnergyDataBySlice(dataDef, 0, 4, 0);
                    break;
                case 'b612':
                    //console.log('数据标识：B 相电压');
                    obj.data['ub'] = parseEnergyDataBySlice(dataDef, 0, 4, 0);
                    break;
                case 'b613':
                    //console.log('数据标识：C 相电压');
                    obj.data['uc'] = parseEnergyDataBySlice(dataDef, 0, 4, 0);
                    break;
                case 'b621':
                    //console.log('数据标识：A 相电流');
                    obj.data['ia'] = parseEnergyDataBySlice(dataDef, 0, 4, 2);
                    break;
                case 'b622':
                    //console.log('数据标识：B 相电流');
                    obj.data['ib'] = parseEnergyDataBySlice(dataDef, 0, 4, 2);
                    break;
                case 'b623':
                    //console.log('数据标识：C 相电流');
                    obj.data['ic'] = parseEnergyDataBySlice(dataDef, 0, 4, 2);
                    break;
                case 'b630':
                    //console.log('数据标识：瞬时有功功率');
                    obj.data['pt'] = parseEnergyDataBySlice(dataDef, 0, 6, 2);
                    break;
                case 'b631':
                    //console.log('数据标识：A 相有功功率');
                    obj.data['pa'] = parseEnergyDataBySlice(dataDef, 0, 6, 2);
                    break;
                case 'b632':
                    //console.log('数据标识：B 相有功功率');
                    obj.data['pb'] = parseEnergyDataBySlice(dataDef, 0, 6, 2);
                    break;
                case 'b633':
                    //console.log('数据标识：C 相有功功率');
                    obj.data['pc'] = parseEnergyDataBySlice(dataDef, 0, 6, 2);
                    break;
                case 'b640':
                    //console.log('数据标识：瞬时无功功率');
                    obj.data['qt'] = parseEnergyDataBySlice(dataDef, 0, 4, 2);
                    break;
                case 'b641':
                    //console.log('数据标识：A 相无功功率');
                    obj.data['q1'] = parseEnergyDataBySlice(dataDef, 0, 4, 2);
                    break;
                case 'b642':
                    //console.log('数据标识：B 相无功功率');
                    obj.data['q2'] = parseEnergyDataBySlice(dataDef, 0, 4, 2);
                    break;
                case 'b643':
                    //console.log('数据标识：C 相无功功率');
                    obj.data['q3'] = parseEnergyDataBySlice(dataDef, 0, 4, 2);
                    break;
                case 'b650':
                    //console.log('数据标识：总功率因数');
                    obj.data['pft'] = parseEnergyDataBySlice(dataDef, 0, 4, 1);
                    break;
                case 'b651':
                    //console.log('数据标识：A 相功率因数');
                    obj.data['pf1'] = parseEnergyDataBySlice(dataDef, 0, 4, 1);
                    break;
                case 'b652':
                    //console.log('数据标识：B 相功率因数');
                    obj.data['pf2'] = parseEnergyDataBySlice(dataDef, 0, 4, 1);
                    break;
                case 'b653':
                    //console.log('数据标识：C 相功率因数');
                    obj.data['pf3'] = parseEnergyDataBySlice(dataDef, 0, 4, 1);
                    break;
                case 'a010':
                    //console.log('数据标识：正向有功总最大需量');
                    obj.data['demand_max'] = parseEnergyDataBySlice(dataDef, 0, 6, 2);
                    break;
                case 'a01f':
                    //console.log('数据标识：有功最大需量数据块');
                    var demandBlockLength = 6; // 每个最大需量值：3字节，保留2位小数
                    var demandBlockCount = dataDef.length / demandBlockLength;
                    //console.log('最大需量数据块数量：' + demandBlockCount);

                    // 定义最大需量字段名
                    var demandValueFields = [
                        'demand_max',        // 总最大需量
                        'demand_max_rate1',  // 费率1最大需量
                        'demand_max_rate2',  // 费率2最大需量
                        'demand_max_rate3',  // 费率3最大需量
                        'demand_max_rate4'   // 费率4最大需量
                    ];

                    for (var j = 0; j < demandBlockCount && j < demandValueFields.length; j++) {
                        var blockData = dataDef.substr(j * demandBlockLength, demandBlockLength);
                        // 解析最大需量值 (3字节，保留2位小数)
                        var demandValue = parseEnergyDataBySlice(blockData, 0, demandBlockLength, 2);
                        //console.log('最大需量值[' + j + ']：' + demandValue);
                        obj.data[demandValueFields[j]] = demandValue;
                    }
                    break;
                case 'b010':
                    //console.log('数据标识：正向有功总最大需量发生时间');
                    // 解析发生时间 (格式：MMDDHHmm)
                    var timeData = parseData(dataDef, 0, 8);
                    //console.log('时间数据：' + timeData);
                    if (timeData && timeData.length >= 8) {
                        var currentYear = new Date().getFullYear();
                        var month = timeData.slice(0, 2);
                        var day = timeData.slice(2, 4);
                        var hour = timeData.slice(4, 6);
                        var minute = timeData.slice(6, 8);
                        var timeStr = currentYear + '-' + month + '-' + day + ' ' + hour + ':' + minute;
                        //console.log('发生时间：' + timeStr);
                        obj.data['demand_max_time'] = timeStr;
                    }
                    break;
                case 'b01f':
                    //console.log('数据标识：正向有功最大需量发生时间数据块');
                    var timeBlockLength = 8; // 每个时间数据：4字节，格式：MMDDHHmm
                    var timeBlockCount = dataDef.length / timeBlockLength;
                    //console.log('最大需量时间数据块数量：' + timeBlockCount);

                    // 定义最大需量时间字段名
                    var demandTimeFields = [
                        'demand_max_time',        // 总最大需量发生时间
                        'demand_max_rate1_time',  // 费率1最大需量发生时间
                        'demand_max_rate2_time',  // 费率2最大需量发生时间
                        'demand_max_rate3_time',  // 费率3最大需量发生时间
                        'demand_max_rate4_time'   // 费率4最大需量发生时间
                    ];

                    for (var j = 0; j < timeBlockCount && j < demandTimeFields.length; j++) {
                        var blockData = dataDef.substr(j * timeBlockLength, timeBlockLength);
                        // 解析发生时间 (格式：MMDDHHmm)
                        var timeData = parseData(blockData, 0, 8);
                        //console.log('时间数据[' + j + ']：' + timeData);
                        if (timeData && timeData.length >= 8) {
                            var currentYear = new Date().getFullYear();
                            var month = timeData.slice(0, 2);
                            var day = timeData.slice(2, 4);
                            var hour = timeData.slice(4, 6);
                            var minute = timeData.slice(6, 8);
                            var timeStr = currentYear + '-' + month + '-' + day + ' ' + hour + ':' + minute;
                            //console.log('发生时间[' + j + ']：' + timeStr);
                            obj.data[demandTimeFields[j]] = timeStr;
                        }
                    }
                    break;

            }
            setRate(obj.data, obj.deviceKey);
            resultDatas.push(obj);
        }
    }

    //console.log(resultDatas);
    return resultDatas;
};