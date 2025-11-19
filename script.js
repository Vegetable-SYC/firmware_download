import { initESPLoader, disconnectESPLoader, startFlashing, getSerialPortInfo, getConnectedPort, consoleTerminal, fitAddon, changeBaudRate, serialMonitorTerminal, monitorFitAddon, startSerialMonitor, stopSerialMonitor } from './esptool-integration.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const body = document.body;
    const selectDeviceBtn = document.getElementById('select-device-btn');
    const firmwareSelect = document.getElementById('firmware-select');
    const versionSelect = document.getElementById('version-select');
    const connectBtn = document.getElementById('connect-btn');
    const flashBtn = document.getElementById('flash-btn');
    const toggleConsoleBtn = document.getElementById('toggle-console-btn');
    const serialPortInfoBtn = document.getElementById('serial-port-info-btn');
    const themeSwitcher = document.getElementById('theme-switcher');
    const baudRateSelect = document.getElementById('baud-rate-select');
    const terminalSection = document.querySelector('.terminal-section');

    // Modal Elements
    const deviceModal = document.getElementById('device-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const deviceList = document.getElementById('device-list');
    const leftArrow = document.querySelector('.left-arrow');
    const rightArrow = document.querySelector('.right-arrow');

    // Serial Info Modal Elements
    const serialInfoModal = document.getElementById('serial-info-modal');
    const closeSerialInfoModalBtn = document.getElementById('close-serial-info-modal-btn');
    const serialVendorId = document.getElementById('serial-vendor-id');
    const serialProductId = document.getElementById('serial-product-id');
    const serialBaudRateDisplay = document.getElementById('serial-baud-rate');
    const modalBaudRateSelect = document.getElementById('modal-baud-rate-select');
    const toggleMonitorBtn = document.getElementById('toggle-monitor-btn');

    // Stepper Elements
    const step2 = document.getElementById('step-2');
    const step3 = document.getElementById('step-3');

    // --- State ---
    let appConfig = null;
    let selectedDevice = null;
    let selectedFirmware = null;
    let selectedVersion = null;
    let isConnected = false;
    let isMonitoring = false;

    // --- Functions ---

    // Attach the serial monitor terminal
    const serialMonitorTerminalElement = document.getElementById('serial-monitor-terminal');
    serialMonitorTerminal.open(serialMonitorTerminalElement);


    function toggleModal(modalElement) {
        modalElement.classList.toggle('is-visible');
        
    }
    
    function renderDeviceCarousel() {
        if (!appConfig || !appConfig.devices) {
            console.error("Configuration not loaded or has no devices.");
            return;
        }
        deviceList.innerHTML = '';
        appConfig.devices.forEach(device => {
            const item = document.createElement('div');
            item.className = 'device-item';
            item.dataset.deviceId = device.id;
            item.innerHTML = `
                <div class="device-image-wrapper">
                    <img src="${device.image || 'freenove.ico'}" alt="${device.name}" class="device-image-placeholder" />
                </div>
                <span class="device-name">${device.name}</span>
            `;
            item.addEventListener('click', () => handleDeviceSelection(device));
            deviceList.appendChild(item);
        });
    }

    function handleDeviceSelection(device) {
        
        selectedDevice = device;
        selectedFirmware = null;
        selectedVersion = null;
        
        selectDeviceBtn.innerHTML = `<span>${device.name}</span>`;
        selectDeviceBtn.classList.add('selected');

        if (device.firmwares && device.firmwares.length > 0) {
            populateDropdown(firmwareSelect, device.firmwares, 'Select firmware');
            firmwareSelect.disabled = false;
            step2.classList.add('active');
        } else {
            populateDropdown(firmwareSelect, [], 'No firmware available');
            populateDropdown(versionSelect, [], 'Select version');
            firmwareSelect.disabled = true;
            versionSelect.disabled = true;
            step2.classList.remove('active');
            step3.classList.remove('active');
        }
        
        populateDropdown(versionSelect, [], 'Select version');
        versionSelect.disabled = true;
        step3.classList.remove('active');
        
        updateButtonStates();
        toggleModal(deviceModal);
    }
    
    function populateDropdown(selectElement, items, placeholder) {
        selectElement.innerHTML = `<option value="">${placeholder}</option>`;
        items.forEach(item => {
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = item.name;
            selectElement.appendChild(option);
        });
    }

    function updateButtonStates() {
        console.log("updateButtonStates called.");
        console.log("Current isConnected:", isConnected);
        const canFlash = selectedDevice && selectedFirmware && selectedVersion;
        console.log("Current canFlash:", canFlash);
        
        // Connect/Disconnect button
        connectBtn.disabled = !canFlash; // Disable until device, firmware, version are selected
        if (isConnected) {
            connectBtn.innerHTML = '<i class="fas fa-unlink"></i> Disconnect';
        } else {
            connectBtn.innerHTML = '<i class="fas fa-link"></i> Connect';
        }
        console.log("Connect button disabled:", connectBtn.disabled);

        // Flash button
        flashBtn.disabled = !(isConnected && canFlash);
        console.log("Flash button disabled:", flashBtn.disabled);

        // Serial Port Info button
        serialPortInfoBtn.disabled = !isConnected;
        console.log("Serial Port Info button disabled:", serialPortInfoBtn.disabled);
    }

    // --- Theme Switching ---
    function setTheme(theme) {
        localStorage.setItem('theme', theme);
        body.className = theme === 'light' ? 'light-mode' : '';
        themeSwitcher.innerHTML = theme === 'light' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    }

    function loadTheme() {
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (savedTheme) {
            setTheme(savedTheme);
        } else if (prefersDark) {
            setTheme('dark');
        } else {
            setTheme('light');
        }
    }

    // --- Event Listeners ---

    window.addEventListener('resize', () => {
        if (serialInfoModal.classList.contains('is-visible')) {
            monitorFitAddon.fit();
        }
        fitAddon.fit();
    });

    navigator.serial.addEventListener('disconnect', async (event) => {
        console.log("Disconnect event fired.");
        const connectedPort = getConnectedPort();
        console.log("Connected Port (from getConnectedPort):", connectedPort);
        console.log("Event Port:", event.port);

        let isOurPortDisconnected = false;

        if (event.port) {
            // If event.port is defined, try to match by Vendor/Product ID
            if (connectedPort) {
                const connectedPortInfo = await getSerialPortInfo();
                console.log("Connected Port Info:", connectedPortInfo);
                console.log("Event Port Vendor ID:", event.port.usbVendorId);
                console.log("Event Port Product ID:", event.port.usbProductId);

                if (connectedPortInfo && event.port.usbVendorId && event.port.usbProductId &&
                    connectedPortInfo.usbVendorId === `0x${event.port.usbVendorId.toString(16).padStart(4, '0')}` &&
                    connectedPortInfo.usbProductId === `0x${event.port.usbProductId.toString(16).padStart(4, '0')}`) {
                    isOurPortDisconnected = true;
                }
            }
        } else {
            // If event.port is undefined, assume it's our port if we think we're connected
            console.log("Event Port is undefined. Assuming our port disconnected if isConnected is true.");
            if (isConnected) {
                isOurPortDisconnected = true;
            }
        }

        if (isOurPortDisconnected) {
            isConnected = false;
            disconnectESPLoader();
            consoleTerminal.writeLine("设备已断开连接。");
            updateButtonStates();
        } else {
            console.log("Disconnect event: Conditions for port match not met or event.port undefined and not connected.");
        }
    });

    selectDeviceBtn.addEventListener('click', () => toggleModal(deviceModal));
    closeModalBtn.addEventListener('click', () => toggleModal(deviceModal));
    deviceModal.addEventListener('click', (e) => {
        if (e.target === deviceModal) toggleModal(deviceModal);
    });

    closeSerialInfoModalBtn.addEventListener('click', () => {
        if (isMonitoring) {
            stopSerialMonitor();
            isMonitoring = false;
            toggleMonitorBtn.textContent = 'Start Monitor';
        }
        toggleModal(serialInfoModal);
    });
    serialInfoModal.addEventListener('click', (e) => {
        if (e.target === serialInfoModal) {
            if (isMonitoring) {
                stopSerialMonitor();
                isMonitoring = false;
                toggleMonitorBtn.textContent = 'Start Monitor';
            }
            toggleModal(serialInfoModal);
        }
    });

    themeSwitcher.addEventListener('click', () => {
        const currentTheme = body.classList.contains('light-mode') ? 'light' : 'dark';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
    });

    leftArrow.addEventListener('click', () => {
        deviceList.scrollBy({ left: -300, behavior: 'smooth' });
    });
    rightArrow.addEventListener('click', () => {
        deviceList.scrollBy({ left: 300, behavior: 'smooth' });
    });

    firmwareSelect.addEventListener('change', () => {
        const firmwareId = firmwareSelect.value;
        selectedFirmware = selectedDevice?.firmwares.find(f => f.id === firmwareId) || null;
        selectedVersion = null;

        if (selectedFirmware && selectedFirmware.versions && selectedFirmware.versions.length > 0) {
            populateDropdown(versionSelect, selectedFirmware.versions, 'Select version');
            versionSelect.disabled = false;
            step3.classList.add('active');
        } else {
            populateDropdown(versionSelect, [], 'No versions available');
            versionSelect.disabled = true;
            step3.classList.remove('active');
        }
        updateButtonStates();
    });

    versionSelect.addEventListener('change', () => {
        const versionId = versionSelect.value;
        selectedVersion = selectedFirmware?.versions.find(v => v.id === versionId) || null;
        updateButtonStates();
    });

    connectBtn.addEventListener('click', async () => {
        const selectedBaudRate = parseInt(baudRateSelect.value);
        if (!isConnected) {
            // Connect phase
            connectBtn.disabled = true;
            connectBtn.textContent = 'Connecting...';
            try {
                await initESPLoader(selectedBaudRate);
                isConnected = true;
                consoleTerminal.writeLine("设备已连接。");
            } catch (error) {
                console.error("连接失败:", error);
                consoleTerminal.writeLine("连接失败: " + error.message);
                isConnected = false;
            } finally {
                connectBtn.disabled = false;
                updateButtonStates();
            }
        } else {
            // Disconnect phase
            if (isMonitoring) {
                await stopSerialMonitor();
                isMonitoring = false;
                toggleMonitorBtn.textContent = 'Start Monitor';
            }
            connectBtn.disabled = true;
            connectBtn.textContent = 'Disconnecting...';
            try {
                await disconnectESPLoader();
                isConnected = false;
                consoleTerminal.writeLine("设备已断开连接。");
            } catch (error) {
                console.error("断开连接失败:", error);
                consoleTerminal.writeLine("断开连接失败: " + error.message);
            } finally {
                connectBtn.disabled = false;
                updateButtonStates();
            }
        }
    });

    flashBtn.addEventListener('click', async () => {
        console.log("Flash button clicked.");
        flashBtn.disabled = true;
        connectBtn.disabled = true;
        serialPortInfoBtn.disabled = true;
        flashBtn.textContent = 'Flashing...';
        const eraseFlashCheckbox = document.getElementById('erase-flash-checkbox');
        const shouldEraseFlash = eraseFlashCheckbox ? eraseFlashCheckbox.checked : false; // Get checkbox state

        try {
            console.log("Starting flashing process...");
            await startFlashing(selectedVersion, shouldEraseFlash); // Pass the state
            consoleTerminal.writeLine("烧录成功！");
            isConnected = true; // Keep connected after flashing
            console.log("Flashing successful. isConnected:", isConnected);
        } catch (error) {
            console.error("烧录失败:", error);
            consoleTerminal.writeLine("烧录失败: " + error.message);
            console.log("Flashing failed. isConnected:", isConnected);
        } finally {
            console.log("Flashing finally block executed.");
            flashBtn.disabled = false;
            flashBtn.innerHTML = '<i class="fas fa-bolt"></i> Flash';
            updateButtonStates();
            console.log("Flash button state updated.");
        }
    });

    toggleConsoleBtn.addEventListener('click', () => {
        terminalSection.classList.toggle('hidden');
        if (terminalSection.classList.contains('hidden')) {
            toggleConsoleBtn.innerHTML = '<i class="fas fa-terminal"></i> Open Console';
        } else {
            toggleConsoleBtn.innerHTML = '<i class="fas fa-terminal"></i> Close Console';
            fitAddon.fit(); // Fit terminal when it becomes visible
        }
    });

    serialPortInfoBtn.addEventListener('click', async () => {
        if (!isConnected) return;
        
        // Open the modal
        toggleModal(serialInfoModal);
        
        // Clear and fit the terminal
        serialMonitorTerminal.clear();
        // Use a small timeout to ensure the modal is visible before fitting
        setTimeout(() => monitorFitAddon.fit(), 100);
    });

    toggleMonitorBtn.addEventListener('click', async () => {
        if (isMonitoring) {
            // Stop monitoring
            await stopSerialMonitor();
            isMonitoring = false;
            toggleMonitorBtn.textContent = 'Start Monitor';
            serialMonitorTerminal.writeln("\n[MONITOR] Stopped.");
        } else {
            // Start monitoring
            const newBaudRate = parseInt(modalBaudRateSelect.value);
            if (isConnected && newBaudRate) {
                try {
                    serialMonitorTerminal.writeln(`[MONITOR] Starting with baud rate ${newBaudRate}...`);
                    await changeBaudRate(newBaudRate);
                    await startSerialMonitor();
                    isMonitoring = true;
                    toggleMonitorBtn.textContent = 'Stop Monitor';
                } catch (error) {
                    console.error("启动监视器失败:", error);
                    serialMonitorTerminal.writeln(`[MONITOR] Failed to start: ${error.message}`);
                }
            }
        }
    });

    /**
     * Main initialization function.
     */
    async function initializeApp() {
        loadTheme();
        try {
            const response = await fetch('firmware/config.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            appConfig = await response.json();
            renderDeviceCarousel();
            updateButtonStates();
        } catch (error) {
            console.error('Failed to load or parse firmware/config.json:', error);
            consoleTerminal.writeLine('Fatal Error: Could not load device configuration. Please check the console.');
        }
    }

    // --- Initialization ---
    initializeApp();
});