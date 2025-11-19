// 从 HTML DOM 中获取各个元素，并进行类型断言，方便 TypeScript 进行类型检查
const baudrates = document.getElementById("baudrates") as HTMLSelectElement; // 烧录波特率下拉菜单
const consoleBaudrates = document.getElementById("consoleBaudrates") as HTMLSelectElement; // 控制台波特率下拉菜单
const connectButton = document.getElementById("connectButton") as HTMLButtonElement; // “连接”按钮
const traceButton = document.getElementById("copyTraceButton") as HTMLButtonElement; // “复制追踪信息”按钮
const disconnectButton = document.getElementById("disconnectButton") as HTMLButtonElement; // “断开连接”按钮
const resetButton = document.getElementById("resetButton") as HTMLButtonElement; // “复位”按钮
const consoleStartButton = document.getElementById("consoleStartButton") as HTMLButtonElement; // 控制台“开始”按钮
const consoleStopButton = document.getElementById("consoleStopButton") as HTMLButtonElement; // 控制台“停止”按钮
const eraseButton = document.getElementById("eraseButton") as HTMLButtonElement; // “擦除 Flash”按钮
const addFileButton = document.getElementById("addFile") as HTMLButtonElement; // “添加文件”按钮
const programButton = document.getElementById("programButton"); // “烧录”按钮
const filesDiv = document.getElementById("files"); // 文件管理区域的 div
const terminal = document.getElementById("terminal"); // 用于显示 xterm.js 终端的 div
const programDiv = document.getElementById("program"); // 烧录功能区的 div
const consoleDiv = document.getElementById("console"); // 控制台功能区的 div
const lblBaudrate = document.getElementById("lblBaudrate"); // 波特率标签
const lblConsoleBaudrate = document.getElementById("lblConsoleBaudrate"); // 控制台波特率标签
const lblConsoleFor = document.getElementById("lblConsoleFor"); // “已连接到设备”标签（控制台部分）
const lblConnTo = document.getElementById("lblConnTo"); // “已连接到设备”标签（烧录部分）
const table = document.getElementById("fileTable") as HTMLTableElement; // 文件列表表格
const alertDiv = document.getElementById("alertDiv"); // 警告信息显示的 div

const debugLogging = document.getElementById("debugLogging") as HTMLInputElement; // “显示调试日志”复选框

// 这是一个使用本地打包文件的 Esptool-JS 前端示例
// 为了优化，可以考虑使用 CDN 托管的版本，例如：
// https://unpkg.com/esptool-js@0.5.0/bundle.js

// 从 esptool-js 库中导入核心类和类型定义
import { ESPLoader, FlashOptions, LoaderOptions, Transport } from "../../../lib";
// 引入一个 web-serial 的 polyfill，用于兼容那些不支持 Web Serial API 但支持 WebUSB 的浏览器（例如 Edge 老版本）
import { serial } from "web-serial-polyfill";

// 判断浏览器是否原生支持 Web Serial API。如果不支持但支持 WebUSB，则使用 polyfill；否则使用原生 API。
const serialLib = !navigator.serial && navigator.usb ? serial : navigator.serial;

// 在 TypeScript 中声明全局变量，这些变量是通过 <script> 标签在 HTML 中引入的，而不是通过 ES 模块导入
declare let Terminal; // xterm.js 终端库
declare let CryptoJS; // CryptoJS 加密库，用于计算 MD5

// 创建一个新的 xterm.js 终端实例，并设置其尺寸
const term = new Terminal({ cols: 120, rows: 40 });
// 将终端挂载到 HTML 中 id 为 "terminal" 的元素上
term.open(terminal);

// 定义一些全局状态变量
let device = null; // 代表通过 Web Serial API 获取的设备对象
let transport: Transport; // 封装了设备通信的对象
let chip: string = null; // 连接的芯片型号，如 "ESP32", "ESP8266"
let esploader: ESPLoader; // esptool-js 的主加载器实例

// 初始化 UI 界面状态：隐藏那些只有在连接后才应显示的按钮和区域
disconnectButton.style.display = "none";
traceButton.style.display = "none";
eraseButton.style.display = "none";
consoleStopButton.style.display = "none";
resetButton.style.display = "none";
filesDiv.style.display = "none";

/**
 * 这是 JSDoc 注释，用于描述代码。
 * 这里的 external Event 指的是浏览器内置的 Event 对象。
 * @external Event
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Event}
 */

/**
 * 文件读取处理器，用于读取用户选择的本地文件。
 * @param {Event} evt 文件选择事件对象
 */
function handleFileSelect(evt) {
  // 获取文件输入框中选中的文件
  const file = evt.target.files[0];

  // 如果没有选择文件，则直接返回
  if (!file) return;

  // 创建一个 FileReader 实例来读取文件内容
  const reader = new FileReader();

  // 定义 onload 事件处理器，当文件读取完成时触发
  reader.onload = (ev: ProgressEvent<FileReader>) => {
    // 将读取到的文件内容（二进制字符串）保存在事件目标的 `data` 属性上，以便后续使用
    evt.target.data = ev.target.result;
  };

  // 以二进制字符串的形式读取文件内容
  reader.readAsBinaryString(file);
}

// 定义一个 "终端适配器" 对象，它提供了 esploader 所需的打印接口，
// esploader 会调用这些方法将日志输出到我们的网页终端上。
const espLoaderTerminal = {
  // 清空终端内容
  clean() {
    term.clear();
  },
  // 在终端中写入一行数据（并换行）
  writeLine(data) {
    term.writeln(data);
  },
  // 在终端中写入数据（不换行）
  write(data) {
    term.write(data);
  },
};

// "连接" 按钮的点击事件处理程序
connectButton.onclick = async () => {
  try {
    // 如果尚未选择设备
    if (device === null) {
      // 弹出浏览器原生对话框，让用户选择一个串口设备
      device = await serialLib.requestPort({});
      // 使用选定的设备创建一个 Transport 实例，用于数据传输
      transport = new Transport(device, true);
    }

    // 准备 esploader 的配置选项
    const flashOptions = {
      transport, // 传输对象
      baudrate: parseInt(baudrates.value), // 从下拉菜单获取波特率
      terminal: espLoaderTerminal, // 指定日志输出的终端
      debugLogging: debugLogging.checked, // 是否启用调试日志
    } as LoaderOptions;
    // 创建 ESPLoader 主实例
    esploader = new ESPLoader(flashOptions);

    // 连接设备并进行握手，成功后会返回芯片型号
    chip = await esploader.main();

    // 注释掉了 flashId()，可能此功能暂时有问题
    // await esploader.flashId();

    console.log("芯片设置完成: " + chip);
    // 更新 UI 界面，进入 "已连接" 状态
    traceButton.style.display = "initial"; // 显示复制追踪信息按钮
    lblBaudrate.style.display = "none"; // 隐藏波特率标签
    lblConnTo.innerHTML = "已连接到设备: " + chip; // 显示连接的芯片型号
    lblConnTo.style.display = "block"; // 显示芯片信息标签
    baudrates.style.display = "none"; // 隐藏波特率选择器
    connectButton.style.display = "none"; // 隐藏连接按钮
    disconnectButton.style.display = "initial"; // 显示断开连接按钮
    eraseButton.style.display = "initial"; // 显示擦除按钮
    filesDiv.style.display = "initial"; // 显示文件管理区域
    consoleDiv.style.display = "none"; // 隐藏控制台功能区域
  } catch (e) {
    // 如果发生错误
    console.error(e); // 在浏览器开发者控制台打印错误
    term.writeln(`错误: ${e.message}`); // 在网页终端上显示错误信息
  }
};

// “复制追踪信息”按钮点击事件
traceButton.onclick = async () => {
  if (transport) {
    // 调用 transport 的方法获取并可能复制调试追踪信息
    transport.returnTrace();
  }
};

// “复位”按钮点击事件
resetButton.onclick = async () => {
  if (transport) {
    // 通过控制串口的 DTR (Data Terminal Ready) 信号来硬复位 ESP 芯片
    await transport.setDTR(false); // 拉低 DTR
    await new Promise((resolve) => setTimeout(resolve, 100)); // 延时 100ms
    await transport.setDTR(true); // 拉高 DTR
  }
};

// “擦除 Flash”按钮点击事件
eraseButton.onclick = async () => {
  // 禁用按钮，防止重复点击
  eraseButton.disabled = true;
  try {
    // 调用 esploader 的方法执行全片擦除操作
    await esploader.eraseFlash();
  } catch (e) {
    console.error(e);
    term.writeln(`错误: ${e.message}`);
  } finally {
    // 无论成功还是失败，在操作结束后重新启用按钮
    eraseButton.disabled = false;
  }
};

// "添加文件" 按钮的点击事件处理程序
addFileButton.onclick = () => {
  // 获取当前表格的行数
  const rowCount = table.rows.length;
  // 在表格末尾插入一个新行
  const row = table.insertRow(rowCount);

  // 第一列 - 偏移地址 (Offset)
  const cell1 = row.insertCell(0);
  const element1 = document.createElement("input");
  element1.type = "text";
  element1.id = "offset" + rowCount;
  element1.value = "0x1000"; // 默认偏移地址
  cell1.appendChild(element1);

  // 第二列 - 文件选择器
  const cell2 = row.insertCell(1);
  const element2 = document.createElement("input");
  element2.type = "file";
  element2.id = "selectFile" + rowCount;
  element2.name = "selected_File" + rowCount;
  // 为文件选择器添加 'change' 事件监听器，当用户选择文件后调用 handleFileSelect 函数
  element2.addEventListener("change", handleFileSelect, false);
  cell2.appendChild(element2);

  // 第三列 - 进度条
  const cell3 = row.insertCell(2);
  cell3.classList.add("progress-cell"); // 添加 CSS 类
  cell3.style.display = "none"; // 默认隐藏
  cell3.innerHTML = `<progress value="0" max="100"></progress>`; // 内部是 HTML 的 progress 元素

  // 第四列 - 移除文件按钮
  const cell4 = row.insertCell(3);
  cell4.classList.add("action-cell"); // 添加 CSS 类
  // 第一行文件不允许移除，所以只在后续行添加 "移除" 按钮
  if (rowCount > 1) {
    const element4 = document.createElement("input");
    element4.type = "button";
    element4.name = "button" + rowCount;
    element4.setAttribute("class", "btn");
    element4.setAttribute("value", "移除");
    // 设置移除按钮的点击事件
    element4.onclick = function () {
      removeRow(row); // 调用 removeRow 函数并传入当前行
    };
    cell4.appendChild(element4);
  }
};

/**
 * 这是 JSDoc 注释，指向内置的 HTMLTableRowElement 对象。
 * @external HTMLTableRowElement
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/HTMLTableRowElement}
 */

/**
 * 从 HTML 表格中移除指定的文件行。
 * @param {HTMLTableRowElement} row - 需要被移除的表格行元素
 */
function removeRow(row: HTMLTableRowElement) {
  // 获取该行在表格所有行中的索引
  const rowIndex = Array.from(table.rows).indexOf(row);
  // 从表格中删除指定索引的行
  table.deleteRow(rowIndex);
}

/**
 * 当芯片断开连接时，清理设备相关的变量。移除可能存在的旧引用。
 */
function cleanUp() {
  device = null;
  transport = null;
  chip = null;
}

// "断开连接" 按钮的点击事件处理程序
disconnectButton.onclick = async () => {
  // 如果 transport 对象存在，则断开连接
  if (transport) await transport.disconnect();

  // 重置 UI 界面到初始状态
  term.reset(); // 清空并重置终端
  lblBaudrate.style.display = "initial"; // 显示波特率标签
  baudrates.style.display = "initial"; // 显示波特率选择器
  consoleBaudrates.style.display = "initial"; // 显示控制台波特率选择器
  connectButton.style.display = "initial"; // 显示连接按钮
  disconnectButton.style.display = "none"; // 隐藏断开连接按钮
  traceButton.style.display = "none"; // 隐藏追踪按钮
  eraseButton.style.display = "none"; // 隐藏擦除按钮
  lblConnTo.style.display = "none"; // 隐藏连接信息标签
  filesDiv.style.display = "none"; // 隐藏文件管理区域
  alertDiv.style.display = "none"; // 隐藏警告信息
  consoleDiv.style.display = "initial"; // 显示控制台功能区域
  // 清理状态变量
  cleanUp();
};

let isConsoleClosed = false; // 一个标志位，用于控制控制台读取循环是否应该停止

// "开始" (控制台) 按钮的点击事件处理程序
consoleStartButton.onclick = async () => {
  // 如果尚未选择设备
  if (device === null) {
    device = await serialLib.requestPort({});
    transport = new Transport(device, true);
  }
  
  // 更新 UI 进入“控制台”模式
  lblConsoleFor.style.display = "block"; // 显示 "Connected to device"
  lblConsoleBaudrate.style.display = "none"; // 隐藏波特率标签
  consoleBaudrates.style.display = "none"; // 隐藏波特率选择器
  consoleStartButton.style.display = "none"; // 隐藏开始按钮
  consoleStopButton.style.display = "initial"; // 显示停止按钮
  resetButton.style.display = "initial"; // 显示复位按钮
  programDiv.style.display = "none"; // 隐藏烧录功能区域

  // 以控制台指定的波特率连接到串口
  await transport.connect(parseInt(consoleBaudrates.value));
  isConsoleClosed = false; // 重置标志位

  // 进入一个无限循环来持续读取串口数据
  while (true && !isConsoleClosed) {
    const readLoop = transport.rawRead();
    // 等待下一块数据
    const { value, done } = await readLoop.next();

    // 如果读取完成或者没有数据，则跳出循环
    if (done || !value) {
      break;
    }
    // 将读取到的数据写入网页终端
    term.write(value);
  }
  console.log("退出控制台模式");
};

// "停止" (控制台) 按钮的点击事件处理程序
consoleStopButton.onclick = async () => {
  isConsoleClosed = true; // 设置标志位，让读取循环停止
  if (transport) {
    await transport.disconnect(); // 断开串口连接
    await transport.waitForUnlock(1500); // 等待端口解锁
  }
  // 重置 UI 到初始状态
  term.reset(); // 重置终端
  lblConsoleBaudrate.style.display = "initial"; // 显示波特率标签
  consoleBaudrates.style.display = "initial"; // 显示波特率选择器
  consoleStartButton.style.display = "initial"; // 显示开始按钮
  consoleStopButton.style.display = "none"; // 隐藏停止按钮
  resetButton.style.display = "none"; // 隐藏复位按钮
  lblConsoleFor.style.display = "none"; // 隐藏连接信息标签
  programDiv.style.display = "initial"; // 显示烧录功能区域
  // 清理状态变量
  cleanUp();
};

/**
 * 验证用户提供的文件和偏移地址是否有效。
 * @returns {string} 如果验证通过返回 "success"，否则返回错误信息字符串。
 */
function validateProgramInputs() {
  const offsetArr = []; // 用于检查偏移地址是否重复
  const rowCount = table.rows.length;
  let row;
  let offset = 0;
  let fileData = null;

  // 遍历表格中的每一行（从第二行开始，第一行是表头）
  for (let index = 1; index < rowCount; index++) {
    row = table.rows[index];

    // 检查偏移地址
    const offSetObj = row.cells[0].childNodes[0]; // 获取地址输入框
    offset = parseInt(offSetObj.value); // 将地址字符串转换为整数

    // 如果地址不是一个有效的数字
    if (Number.isNaN(offset)) return "第 " + index + " 行的偏移地址不是一个有效的地址！";
    // 如果地址已经使用过
    else if (offsetArr.includes(offset)) return "第 " + index + " 行的偏移地址已被使用！";
    else offsetArr.push(offset); // 将有效的、唯一的地址添加到数组中

    // 检查文件
    const fileObj = row.cells[1].childNodes[0]; // 获取文件输入框
    fileData = fileObj.data; // 获取通过 FileReader 读取的文件数据
    if (fileData == null) return "第 " + index + " 行没有选择文件！";
  }
  return "success"; // 所有检查都通过
}

// "烧录" 按钮的点击事件处理程序
programButton.onclick = async () => {
  const alertMsg = document.getElementById("alertmsg");
  // 首先验证输入
  const err = validateProgramInputs();

  // 如果验证失败
  if (err != "success") {
    // 在警告区域显示错误信息
    alertMsg.innerHTML = "<strong>" + err + "</strong>";
    alertDiv.style.display = "block";
    return; // 终止执行
  }

  // 如果验证成功，隐藏警告信息
  alertDiv.style.display = "none";

  const fileArray = []; // 存储待烧录文件的数组 { data, address }
  const progressBars = []; // 存储每行对应的进度条元素

  // 再次遍历表格，准备烧录数据
  for (let index = 1; index < table.rows.length; index++) {
    const row = table.rows[index];

    // 获取偏移地址
    const offSetObj = row.cells[0].childNodes[0] as HTMLInputElement;
    const offset = parseInt(offSetObj.value);

    // 获取文件数据
    const fileObj = row.cells[1].childNodes[0] as ChildNode & { data: string };
    
    // 获取进度条元素
    const progressBar = row.cells[2].childNodes[0];
    progressBar.textContent = "0";
    progressBars.push(progressBar);

    // 更新 UI，显示进度条，隐藏操作按钮
    row.cells[2].style.display = "initial";
    row.cells[3].style.display = "none";

    // 将文件数据和地址作为一个对象添加到数组中
    fileArray.push({ data: fileObj.data, address: offset });
  }

  try {
    // 准备烧录选项
    const flashOptions: FlashOptions = {
      fileArray: fileArray, // 要烧录的文件数组
      eraseAll: false, // 不执行全片擦除（因为有单独的擦除按钮）
      compress: true, // 启用数据压缩以提高烧录速度
      // 进度报告回调函数：esploader 在烧录过程中会调用这个函数
      reportProgress: (fileIndex, written, total) => {
        // 更新对应文件的进度条
        progressBars[fileIndex].value = (written / total) * 100;
      },
      // MD5 哈希计算回调函数：esploader 用这个函数来校验烧录数据的完整性
      calculateMD5Hash: (image) => CryptoJS.MD5(CryptoJS.enc.Latin1.parse(image)),
    } as FlashOptions;
    
    // 调用 writeFlash 方法开始烧录
    await esploader.writeFlash(flashOptions);

    // 烧录完成后的一些收尾操作（例如软复位）
    await esploader.after();
  } catch (e) {
    console.error(e);
    term.writeln(`错误: ${e.message}`);
  } finally {
    // 烧录过程结束后（无论成功或失败），恢复 UI
    for (let index = 1; index < table.rows.length; index++) {
      table.rows[index].cells[2].style.display = "none"; // 隐藏进度条
      table.rows[index].cells[3].style.display = "initial"; // 显示操作按钮
    }
  }
};

// 在脚本加载完成后，立即调用一次 "添加文件" 按钮的点击事件
// 这样页面一打开就会有一个默认的文件行，方便用户直接使用
addFileButton.onclick(this);