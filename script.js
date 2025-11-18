document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const body = document.body;
    const selectDeviceBtn = document.getElementById('select-device-btn');
    const firmwareSelect = document.getElementById('firmware-select');
    const versionSelect = document.getElementById('version-select');
    const connectBtn = document.getElementById('connect-btn');
    const themeSwitcher = document.getElementById('theme-switcher');

    // Modal Elements
    const deviceModal = document.getElementById('device-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const deviceList = document.getElementById('device-list');
    const leftArrow = document.querySelector('.left-arrow');
    const rightArrow = document.querySelector('.right-arrow');

    // Stepper Elements
    const step2 = document.getElementById('step-2');
    const step3 = document.getElementById('step-3');

    // --- State ---
    let appConfig = null;
    let selectedDevice = null;
    let selectedFirmware = null;
    let selectedVersion = null;

    // --- Functions ---

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
        const canFlash = selectedDevice && selectedFirmware && selectedVersion;
        connectBtn.disabled = !canFlash;
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

    // --- ESPTOOL-JS Flashing Logic ---

    /**
     * Converts an ArrayBuffer to a binary string.
     * @param {ArrayBuffer} buffer The buffer to convert.
     * @returns {string} The binary string.
     */
    function arrayBufferToBinaryString(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return binary;
    }

    const handleConnectAndFlash = async () => {
        if (!selectedVersion) {
            alert("Please select a device, firmware, and version first.");
            return;
        }

        connectBtn.disabled = true;
        connectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';

        // ESPLoader is loaded from the script tag in index.html
        const ESPLoader = window.ESPLoader;
        let device;
        let transport;
        let esploader;

        const espLoaderTerminal = {
            clean() {},
            writeLine(data) { console.log(data); },
            write(data) { console.log(data); },
        };

        try {
            // Request port and connect
            device = await navigator.serial.requestPort({});
            transport = new ESPLoader.Transport(device);
            esploader = new ESPLoader({
                transport,
                baudrate: 921600, // A common high baud rate
                terminal: espLoaderTerminal,
            });

            // Handshake with device
            const chip = await esploader.main();
            console.log("Connected to", chip);

            // Fetch the manifest file
            const manifestPath = selectedVersion.manifest_path;
            const manifestResponse = await fetch(manifestPath);
            const manifest = await manifestResponse.json();

            // Prepare files for flashing
            connectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparing files...';
            const filePromises = manifest.builds[0].parts.map(async (part) => {
                const partResponse = await fetch(part.path);
                const binary = await partResponse.arrayBuffer();
                return {
                    data: arrayBufferToBinaryString(binary),
                    address: part.offset,
                };
            });

            const fileArray = await Promise.all(filePromises);

            // Flash the device
            connectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Flashing...';
            await esploader.writeFlash({
                fileArray: fileArray,
                eraseAll: false, // Set to true if you want to erase the entire flash
                compress: true,
                reportProgress: (fileIndex, written, total) => {
                    const progress = Math.round((written / total) * 100);
                    console.log(`Flashing file ${fileIndex + 1}/${fileArray.length}: ${progress}%`);
                    connectBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Flashing... ${progress}%`;
                },
            });

            alert("Flashing complete!");

        } catch (error) {
            console.error(error);
            alert(`Error: ${error.message}`);
        } finally {
            // Disconnect from the device
            if (transport) {
                await transport.disconnect();
            }
            connectBtn.disabled = false;
            connectBtn.innerHTML = '<i class="fas fa-link"></i> Connect';
        }
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

    connectBtn.addEventListener('click', handleConnectAndFlash);

    /**
     * Main initialization function.
     */
    async function initializeApp() {
        loadTheme(); // Load theme first
        try {
            const response = await fetch('firmware/config.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            appConfig = await response.json();
            renderDeviceCarousel();
        } catch (error) {
            console.error('Failed to load or parse firmware/config.json:', error);
            alert('Fatal Error: Could not load device configuration. Please check the console.');
        }
    }

    // --- Initialization ---
    initializeApp();
});

