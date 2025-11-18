document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const body = document.body;
    const selectDeviceBtn = document.getElementById('select-device-btn');
    const firmwareSelect = document.getElementById('firmware-select');
    const versionSelect = document.getElementById('version-select');
    const baudRateSelect = document.getElementById('baud-rate-select');
    const themeSwitcher = document.getElementById('theme-switcher');
    
    // Action Buttons
    const connectBtn = document.getElementById('connect-btn');
    const flashBtn = document.getElementById('flash-btn');
    const startLoggingBtn = document.getElementById('start-logging-btn');
    const downloadLogsBtn = document.getElementById('download-logs-btn');

    // Modal Elements
    const deviceModal = document.getElementById('device-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const deviceList = document.getElementById('device-list');
    const leftArrow = document.querySelector('.left-arrow');
    const rightArrow = document.querySelector('.right-arrow');

    // Stepper Elements
    const step2 = document.getElementById('step-2');
    const step3 = document.getElementById('step-3');

    // Terminal Elements
    const terminalSection = document.getElementById('terminal-section');
    const terminalContainer = document.getElementById('terminal-container');

    // --- State ---
    let appConfig = null;
    let selectedDevice = null;
    let selectedFirmware = null;
    let selectedVersion = null;
    
    let device = null;
    let transport = null;
    let esploader = null;
    let isConnecting = false;
    let isLogging = false;
    let logData = '';
    const term = new Terminal({ convertEol: true });

    // --- Main Functions ---

    function toggleModal() {
        deviceModal.classList.toggle('is-visible');
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
            firmwareSelect.disabled = true;
            step2.classList.remove('active');
        }
        
        populateDropdown(versionSelect, [], 'Select version');
        versionSelect.disabled = true;
        step3.classList.remove('active');
        
        updateButtonStates();
        toggleModal();
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
        const isConnected = transport && transport.connected;
        const canFlash = selectedDevice && selectedFirmware && selectedVersion;

        if (isConnected) {
            connectBtn.innerHTML = '<i class="fas fa-plug-circle-xmark"></i> Disconnect';
            connectBtn.disabled = isConnecting;
        } else {
            connectBtn.innerHTML = isConnecting ? '<i class="fas fa-spinner fa-spin"></i> Connecting...' : '<i class="fas fa-link"></i> Connect';
            connectBtn.disabled = isConnecting;
        }

        flashBtn.disabled = isConnecting || !isConnected || !canFlash;
        startLoggingBtn.disabled = isConnecting || !isConnected;
        downloadLogsBtn.disabled = isLogging || logData.length === 0;
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

    // --- ESPTOOL-JS Logic ---

    function arrayBufferToBinaryString(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return binary;
    }

    const handleConnect = async () => {
        isConnecting = true;
        updateButtonStates();

        try {
            device = await navigator.serial.requestPort({});
            transport = new Transport(device);
            
            const loaderTerminal = {
                clean() {},
                writeLine(data) { console.log(data); },
                write(data) { console.log(data); },
            };

            esploader = new ESPLoader({
                transport,
                baudrate: parseInt(baudRateSelect.value, 10),
                terminal: loaderTerminal,
            });

            const chip = await esploader.main();
            console.log("Connected to", chip);

        } catch (error) {
            console.error(error);
            alert(`Error connecting: ${error.message}`);
            await handleDisconnect();
        } finally {
            isConnecting = false;
            updateButtonStates();
        }
    };

    const handleDisconnect = async () => {
        if (isLogging) {
            isLogging = false; // Force stop
        }
        if (transport) {
            await transport.disconnect();
        }
        transport = null;
        esploader = null;
        device = null;
        console.log("Disconnected.");
        startLoggingBtn.innerHTML = '<i class="far fa-file-alt"></i> Start Logging';
        terminalSection.style.display = 'none';
        updateButtonStates();
    };

    const handleFlash = async () => {
        if (!esploader || !transport.connected) {
            alert("Not connected. Please connect to a device first.");
            return;
        }
        if (!selectedVersion) {
            alert("Please select a firmware version to flash.");
            return;
        }

        flashBtn.disabled = true;
        flashBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparing...';

        try {
            const manifestPath = selectedVersion.manifest_path;
            const manifestResponse = await fetch(manifestPath);
            const manifest = await manifestResponse.json();

            const filePromises = manifest.builds[0].parts.map(async (part) => {
                const partResponse = await fetch(part.path);
                const binary = await partResponse.arrayBuffer();
                return {
                    data: arrayBufferToBinaryString(binary),
                    address: part.offset,
                };
            });
            const fileArray = await Promise.all(filePromises);

            await esploader.writeFlash({
                fileArray: fileArray,
                eraseAll: false,
                compress: true,
                reportProgress: (fileIndex, written, total) => {
                    const progress = Math.round((written / total) * 100);
                    flashBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Flashing... ${progress}%`;
                },
            });
            alert("Flashing complete!");

        } catch (error) {
            console.error(error);
            alert(`Flashing failed: ${error.message}`);
        } finally {
            flashBtn.disabled = false;
            flashBtn.innerHTML = '<i class="fas fa-bolt"></i> Start Flashing';
            updateButtonStates();
        }
    };

    const handleLogging = async () => {
        if (!transport || !transport.connected) {
            alert("Not connected. Please connect to a device first.");
            return;
        }

        isLogging = !isLogging;
        updateButtonStates();

        if (isLogging) {
            startLoggingBtn.innerHTML = '<i class="fas fa-stop"></i> Stop Logging';
            terminalSection.style.display = 'block';
            logData = '';
            term.clear();
            
            while (isLogging) {
                try {
                    const { value, done } = await transport.rawRead();
                    if (done) {
                        isLogging = false;
                        break;
                    }
                    if (value) {
                        term.write(value);
                        logData += new TextDecoder().decode(value);
                    }
                } catch (e) {
                    console.error("Logging error:", e);
                    isLogging = false;
                }
            }
            updateButtonStates();
        } else {
            startLoggingBtn.innerHTML = '<i class="far fa-file-alt"></i> Start Logging';
        }
    };

    const handleDownloadLogs = () => {
        const blob = new Blob([logData], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `esp-log-${new Date().toISOString()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // --- Event Listeners ---

    selectDeviceBtn.addEventListener('click', toggleModal);
    closeModalBtn.addEventListener('click', toggleModal);
    deviceModal.addEventListener('click', (e) => {
        if (e.target === deviceModal) toggleModal();
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

    connectBtn.addEventListener('click', () => {
        if (transport && transport.connected) {
            handleDisconnect();
        } else {
            handleConnect();
        }
    });
    flashBtn.addEventListener('click', handleFlash);
    startLoggingBtn.addEventListener('click', handleLogging);
    downloadLogsBtn.addEventListener('click', handleDownloadLogs);

    /**
     * Main initialization function.
     */
    async function initializeApp() {
        loadTheme();
        term.open(terminalContainer);
        try {
            const response = await fetch('firmware/config.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            appConfig = await response.json();
            renderDeviceCarousel();
            updateButtonStates(); // Initial button state
        } catch (error) {
            console.error('Failed to load or parse firmware/config.json:', error);
            alert('Fatal Error: Could not load device configuration. Please check the console.');
        }
    }

    // --- Initialization ---
    initializeApp();
});

