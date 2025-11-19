import { ESPLoader, Transport } from './esptool-js-main/bundle.js';

// Initialize xterm.js terminal
const terminalElement = document.getElementById('terminal-log');
const term = new Terminal({
    cols: 80, // Adjust as needed
    rows: 20, // Adjust as needed
    convertEol: true,
    theme: {
        background: '#000',
        foreground: '#0F0'
    }
});
term.open(terminalElement);

// Custom terminal to log output to xterm.js terminal
const consoleTerminal = {
    clean: () => term.clear(),
    writeLine: (data) => term.writeln(data),
    write: (data) => term.write(data),
};

let esploader = null;
let transport = null;
let device = null; // The SerialPort object

// Function to initialize ESPLoader
async function initESPLoader(baudrate) {
    try {
        consoleTerminal.clean(); // Clear terminal on new connection attempt
        consoleTerminal.writeLine("尝试连接设备...");
        if (device === null) {
            // Request a serial port from the user
            device = await navigator.serial.requestPort();
            transport = new Transport(device, true); // Enable tracing for debug
        }

        const flashOptions = {
            transport,
            baudrate: baudrate,
            terminal: consoleTerminal,
            debugLogging: true, // Enable debug logging
            flashSize: "detect", // Let esptool-js detect flash size
        };
        esploader = new ESPLoader(flashOptions);

        // Connect and detect chip
        const chipName = await esploader.main();
        consoleTerminal.writeLine(`ESPLoader 初始化成功，检测到芯片: ${chipName}`);
        return chipName;
    } catch (error) {
        console.error("Failed to initialize ESPLoader:", error);
        consoleTerminal.writeLine(`连接失败: ${error.message}`);
        // Ensure device and transport are cleared on any failure during init
        if (transport) {
            await transport.disconnect();
        }
        device = null;
        transport = null;
        esploader = null;
        throw error;
    }
}

// Function to disconnect
async function disconnectESPLoader() {
    consoleTerminal.writeLine("[DEBUG] disconnectESPLoader called.");
    if (transport) {
        await transport.disconnect();
    }
    device = null;
    transport = null;
    esploader = null;
    consoleTerminal.writeLine("ESPLoader 已断开连接。");
}

// Function to fetch binary data
async function fetchBinaryFile(filePath) {
    const response = await fetch(filePath);
    if (!response.ok) {
        throw new Error(`Failed to fetch ${filePath}: ${response.statusText}`);
    }
    const buffer = await response.arrayBuffer();
    // esptool-js expects binary string for image data
    const binaryString = Array.from(new Uint8Array(buffer), byte => String.fromCharCode(byte)).join('');
    return binaryString;
}

// Main flashing function
async function startFlashing(selectedVersion, eraseFlash) {
    if (!esploader) {
        consoleTerminal.writeLine("ESPLoader 未初始化。请先连接设备。");
        throw new Error("ESPLoader 未初始化。请先连接设备。");
    }

    try {
        consoleTerminal.clean(); // Clear terminal before flashing
        consoleTerminal.writeLine("开始烧录...");

        if (eraseFlash) {
            consoleTerminal.writeLine("正在擦除整个闪存...");
            await esploader.eraseFlash();
            consoleTerminal.writeLine("闪存擦除完成。");
        }

        const manifestResponse = await fetch(selectedVersion.manifest_path);
        if (!manifestResponse.ok) {
            throw new Error(`Failed to fetch manifest: ${manifestResponse.statusText}`);
        }
        const manifest = await manifestResponse.json();

        const fileArray = [];
        for (const build of manifest.builds) {
            for (const part of build.parts) {
                const binaryData = await fetchBinaryFile(`firmware/${part.path}`);
                fileArray.push({ data: binaryData, address: part.offset });
            }
        }

        const flashOptions = {
            fileArray: fileArray,
            eraseAll: manifest.new_install_prompt_erase || false,
            compress: true, // Use compression for faster flashing
            flashMode: "keep", // Keep existing flash mode
            flashFreq: "keep", // Keep existing flash frequency
            reportProgress: (fileIndex, written, total) => {
                const progress = (written / total) * 100;
                consoleTerminal.writeLine(`文件 ${fileIndex + 1} 进度: ${progress.toFixed(2)}%`);
            },
            calculateMD5Hash: (image) => window.CryptoJS.MD5(window.CryptoJS.enc.Latin1.parse(image)).toString(),
        };

        await esploader.writeFlash(flashOptions);
        await esploader.after(); // Perform post-flashing hard reset (default)

        consoleTerminal.writeLine("烧录成功！");
    } catch (error) {
        console.error("烧录失败:", error);
        consoleTerminal.writeLine(`烧录失败: ${error.message}`);
        throw error;
    }
}

// Function to get serial port information
async function getSerialPortInfo() {
    if (!device || !transport || !esploader) {
        return null;
    }
    const usbVendorId = device.usbVendorId ? `0x${device.usbVendorId.toString(16).padStart(4, '0')}` : 'N/A';
    const usbProductId = device.usbProductId ? `0x${device.usbProductId.toString(16).padStart(4, '0')}` : 'N/A';
    const chipName = esploader.chip ? esploader.chip.CHIP_NAME : 'N/A';

    return {
        usbVendorId,
        usbProductId,
        baudRate: transport.baudrate, // Get current baud rate from transport
        chipName,
    };
}

// Function to get the connected SerialPort object
function getConnectedPort() {
    return device;
}

// Function to set onDisconnection callback
function setOnDisconnectCallback(callback) {
    if (device) {
        device.onDisconnection = callback;
    }
}

export { initESPLoader, disconnectESPLoader, startFlashing, getSerialPortInfo, getConnectedPort, setOnDisconnectCallback, consoleTerminal };
