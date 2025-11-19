import { ESPLoader, Transport } from './esptool-js-main/bundle.js';
import { Terminal } from 'https://cdn.jsdelivr.net/npm/xterm@5.3.0/+esm';
import { FitAddon } from 'https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.8.0/+esm';

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
const fitAddon = new FitAddon(); // Instantiate FitAddon
term.loadAddon(fitAddon); // Load FitAddon
term.open(terminalElement);
fitAddon.fit(); // Fit the terminal to its container initially

// New terminal for the serial monitor
const serialMonitorTerminal = new Terminal({
    convertEol: true,
    theme: {
        background: '#1E1E1E',
        foreground: '#FFFFFF'
    }
});
const monitorFitAddon = new FitAddon();
serialMonitorTerminal.loadAddon(monitorFitAddon);

// Custom terminal to log output to xterm.js terminal
const consoleTerminal = {
    clean: () => term.clear(),
    writeLine: (data) => term.writeln(data),
    write: (data) => term.write(data),
};

let esploader = null;
let transport = null;
let device = null; // The SerialPort object
let isMonitoring = false;
let monitorReader = null;

async function readLoopForMonitor() {
    if (!transport || !transport.device.readable) return;

    try {
        monitorReader = transport.device.readable.getReader();
        while (true) {
            const { value, done } = await monitorReader.read();
            if (done) {
                break; // Reader was cancelled
            }
            serialMonitorTerminal.write(value);
        }
    } catch (error) {
        // This is expected when the reader is cancelled.
    } finally {
        if (monitorReader) {
            monitorReader.releaseLock();
            monitorReader = null;
        }
    }
}

async function startSerialMonitor() {
    if (isMonitoring || !transport) return;
    isMonitoring = true;

    // Release the lock from esploader's transport if it's held
    if (transport.reader) {
        try {
            await transport.reader.cancel();
            transport.reader.releaseLock();
        } catch(e) { /* Ignore */ }
        transport.reader = undefined;
    }
    
    transport.slipReaderEnabled = false; // Switch to raw mode
    readLoopForMonitor(); // Do not await, let it run in the background
}

async function stopSerialMonitor() {
    if (!isMonitoring) return;
    isMonitoring = false;

    if (monitorReader) {
        try {
            await monitorReader.cancel();
        } catch (error) {
            // Ignore cancel error
        }
    }
    
    if (transport) {
        transport.slipReaderEnabled = true; // Switch back to SLIP mode for esptool
    }
}


// Function to initialize ESPLoader
async function initESPLoader(baudrate) {

    try {
        consoleTerminal.clean(); // Clear terminal on new connection attempt
        consoleTerminal.writeLine("Attempting to connect...");
        if (device === null) {
            // Request a serial port from the user
            device = await navigator.serial.requestPort();
            transport = new Transport(device, true); // Enable tracing for debug
        }

        const flashOptions = {
            transport,
            baudrate: baudrate,
            terminal: consoleTerminal,
            debugLogging: false, // Disable debug logging
            flashSize: "detect", // Let esptool-js detect flash size
        };
        esploader = new ESPLoader(flashOptions);

        // Connect and detect chip
        const chipName = await esploader.main();
        consoleTerminal.writeLine(`ESPLoader initialized. Detected chip: ${chipName}`);
        return chipName;
    } catch (error) {
        console.error("Failed to initialize ESPLoader:", error);
        consoleTerminal.writeLine(`Connection failed: ${error.message}`);
        consoleTerminal.writeLine("Please ensure the device is in download mode (hold BOOT, press/release RESET, then release BOOT).");
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
    try {
        if (transport) {
            await transport.disconnect();
        }
    } catch (error) {
        console.error("Error during disconnect:", error);
    } finally {
        transport = null;
        device = null;
        esploader = null;
        consoleTerminal.writeLine("ESPLoader 已断开连接。");
    }
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
        consoleTerminal.writeLine("ESPLoader is not initialized. Please connect a device first.");
        throw new Error("ESPLoader is not initialized. Please connect a device first.");
    }

    try {
        consoleTerminal.clean(); // Clear terminal before flashing
        consoleTerminal.writeLine("Starting flashing process...");

        if (eraseFlash) {
            consoleTerminal.writeLine("Erasing flash (this may take a while)...");
            await esploader.eraseFlash();
            consoleTerminal.writeLine("Flash erase complete.");
        }

        const manifestPath = selectedVersion.manifest_path;
        const basePath = manifestPath.substring(0, manifestPath.lastIndexOf('/') + 1);
        const manifestResponse = await fetch(manifestPath);
        if (!manifestResponse.ok) {
            throw new Error(`Failed to fetch manifest: ${manifestResponse.statusText}`);
        }
        const manifest = await manifestResponse.json();

        const fileArray = [];
        for (const build of manifest.builds) {
            for (const part of build.parts) {
                const binaryPath = `${basePath}${part.path}`;
                consoleTerminal.writeLine(`Fetching ${part.path} at 0x${part.offset.toString(16)}...`);
                const binaryData = await fetchBinaryFile(binaryPath);
                fileArray.push({ data: binaryData, address: part.offset });
            }
        }

        let lastProgressLine = "";
        const progressBar = (fileIndex, written, total) => {
            const fileName = fileArray[fileIndex].data.length > 0 ? `File ${fileIndex + 1}/${fileArray.length}` : `Empty file ${fileIndex + 1}/${fileArray.length}`;
            const percentage = ((written / total) * 100).toFixed(0);
            const progressBarLength = 20;
            const filled = Math.round(progressBarLength * (written / total));
            const empty = progressBarLength - filled;
            const bar = '[' + '█'.repeat(filled) + '-'.repeat(empty) + ']';
            
            const newLine = `\r${fileName} ${bar} ${percentage}% `;
            if (newLine !== lastProgressLine) {
                consoleTerminal.write(newLine + " ".repeat(Math.max(0, lastProgressLine.length - newLine.length))); // Overwrite previous line
                lastProgressLine = newLine;
            }
        };

        const flashOptions = {
            fileArray: fileArray,
            eraseAll: manifest.new_install_prompt_erase || false,
            compress: true, // Use compression for faster flashing
            flashMode: "keep", // Keep existing flash mode
            flashFreq: "keep", // Keep existing flash frequency
            reportProgress: progressBar, // Use the new progress bar function
            calculateMD5Hash: (image) => window.CryptoJS.MD5(window.CryptoJS.enc.Latin1.parse(image)).toString(),
        };

        await esploader.writeFlash(flashOptions);
        await esploader.after(); // Perform post-flashing hard reset (default)

        consoleTerminal.writeLine("\n\rFlashing complete!");
    } catch (error) {
        console.error("Flashing failed:", error);
        consoleTerminal.writeLine(`\n\rFlashing failed: ${error.message}`);
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

// Function to change the baud rate
async function changeBaudRate(newBaudRate) {
    if (transport) {
        await transport.disconnect();
        await transport.connect(newBaudRate);
    }
}

export { initESPLoader, disconnectESPLoader, startFlashing, getSerialPortInfo, getConnectedPort, consoleTerminal, fitAddon, changeBaudRate, serialMonitorTerminal, monitorFitAddon, startSerialMonitor, stopSerialMonitor };
