import { initESPLoader, disconnectESPLoader, startFlashing, getSerialPortInfo, setOnDisconnectCallback, getConnectedPort, consoleTerminal } from './esptool-integration.js';

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
    const applyBaudRateBtn = document.getElementById('apply-baud-rate-btn');

    // Stepper Elements
    const step2 = document.getElementById('step-2');
    const step3 = document.getElementById('step-3');

    // --- State ---
    let appConfig = null;
    let selectedDevice = null;
    let selectedFirmware = null;
    let selectedVersion = null;
    let isConnected = false;

    // --- Functions ---

    function toggleModal(modalElement) {
        modalElement.classList.toggle('is-visible');
        console.log(`[DEBUG] Toggling modal: ${modalElement.id}, is-visible: ${modalElement.classList.contains('is-visible')}`);
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
        console.log(`[DEBUG] handleDeviceSelection called for device: ${device.name}`);
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
        consoleTerminal.writeLine(`[DEBUG] updateButtonStates called. isConnected: ${isConnected}, selectedDevice: ${!!selectedDevice}, selectedFirmware: ${!!selectedFirmware}, selectedVersion: ${!!selectedVersion}`);
        const canFlash = selectedDevice && selectedFirmware && selectedVersion;
        
        // Connect/Disconnect button
        connectBtn.disabled = !canFlash; // Disable until device, firmware, version are selected
        if (isConnected) {
            connectBtn.innerHTML = '<i class="fas fa-unlink"></i> Disconnect';
        } else {
            connectBtn.innerHTML = '<i class="fas fa-link"></i> Connect';
        }

        // Flash button
        flashBtn.disabled = !(isConnected && canFlash);

        // Serial Port Info button
        serialPortInfoBtn.disabled = !isConnected;
        consoleTerminal.writeLine(`[DEBUG] Flash button disabled: ${flashBtn.disabled}, Serial Port Info button disabled: ${serialPortInfoBtn.disabled}`);
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

    selectDeviceBtn.addEventListener('click', () => toggleModal(deviceModal));
    closeModalBtn.addEventListener('click', () => toggleModal(deviceModal));
    deviceModal.addEventListener('click', (e) => {
        if (e.target === deviceModal) toggleModal(deviceModal);
    });

    closeSerialInfoModalBtn.addEventListener('click', () => toggleModal(serialInfoModal));
    serialInfoModal.addEventListener('click', (e) => {
        if (e.target === serialInfoModal) toggleModal(serialInfoModal);
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
                // Set up disconnect listener
                const port = getConnectedPort();
                if (port) {
                    port.onDisconnection = () => { // Corrected event name
                        consoleTerminal.writeLine("设备已断开连接。");
                        isConnected = false;
                        updateButtonStates();
                    };
                }
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
        flashBtn.disabled = true;
        flashBtn.textContent = 'Flashing...';
        const eraseFlashCheckbox = document.getElementById('erase-flash-checkbox');
        const shouldEraseFlash = eraseFlashCheckbox ? eraseFlashCheckbox.checked : false; // Get checkbox state

        try {
            await startFlashing(selectedVersion, shouldEraseFlash); // Pass the state
            consoleTerminal.writeLine("烧录成功！");
            isConnected = true; // Keep connected after flashing
        } catch (error) {
            console.error("烧录失败:", error);
            consoleTerminal.writeLine("烧录失败: " + error.message);
        } finally {
            flashBtn.disabled = false;
            updateButtonStates();
        }
    });

    toggleConsoleBtn.addEventListener('click', () => {
        terminalSection.classList.toggle('hidden');
        if (terminalSection.classList.contains('hidden')) {
            toggleConsoleBtn.innerHTML = '<i class="fas fa-terminal"></i> Open Console';
        } else {
            toggleConsoleBtn.innerHTML = '<i class="fas fa-terminal"></i> Close Console';
        }
    });

    serialPortInfoBtn.addEventListener('click', async () => {
        if (!isConnected) return;
        const info = await getSerialPortInfo();
        if (info) {
            serialVendorId.textContent = info.usbVendorId || 'N/A';
            serialProductId.textContent = info.usbProductId || 'N/A';
            serialBaudRateDisplay.textContent = info.baudRate || 'N/A';
            modalBaudRateSelect.value = info.baudRate || '921600';
            toggleModal(serialInfoModal);
        } else {
            consoleTerminal.writeLine("无法获取串口信息。");
        }
    });

    applyBaudRateBtn.addEventListener('click', async () => {
        const newBaudRate = parseInt(modalBaudRateSelect.value);
        if (isConnected && newBaudRate) {
            try {
                await changeBaudRate(newBaudRate);
                serialBaudRateDisplay.textContent = newBaudRate;
                consoleTerminal.writeLine(`波特率已更改为 ${newBaudRate}`);
            } catch (error) {
                console.error("更改波特率失败:", error);
                consoleTerminal.writeLine("更改波特率失败: " + error.message);
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