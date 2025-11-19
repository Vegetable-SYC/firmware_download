# 固件管理指南

本文档旨在帮助您轻松地管理和扩展此 Web Flasher 项目，特别是如何添加新的设备、固件和版本。

## 核心理念

本项目的核心设计思想是“配置与代码分离”。所有的设备信息、固件版本和烧录细节都存储在 `firmware` 目录下的 JSON 文件中，而不是硬编码在 JavaScript 代码里。这使得您在添加新内容时，几乎不需要修改任何代码，只需修改或添加配置文件即可。

## 文件结构概览

关键文件都位于 `firmware` 文件夹下，并采用了层级结构：

```
firmware/
├── config.json                # 1. 全局主配置文件，列出所有设备

└── [device_name_folder]/      # 2. 单个设备的根文件夹
    ├── [device_name].json     # 3. 设备描述文件 (名称, 图片等)
    ├── [device_name].png      #    (可选) 设备图片
    │
    └── firmwares/             # 4. 存放该设备所有固件版本的目录
        │
        └── [version_name]/    # 5. 单个固件版本的文件夹
            ├── [version].json # 6. 版本清单文件 (包含 .bin 路径和偏移量)
            ├── part1.bin      # 7. 该版本的二进制文件
            └── part2.bin
```

1.  **`config.json`**: 这是唯一的“入口”文件。网页加载时会首先读取它，用来动态生成网页上的“选择设备”菜单。
2.  **设备文件夹**: 每个设备都有一个独立的文件夹，用于存放与该设备相关的所有文件。
3.  **设备描述文件**: 一个简单的 JSON 文件，包含设备的名称和图片路径。
4.  **`firmwares` 目录**: 位于设备文件夹内，用于组织不同版本的固件。
5.  **版本文件夹**: 每个子文件夹代表一个独立的固件版本。
6.  **版本清单 (`.json`)**: 描述了该版本需要烧录的所有二进制文件 (`.bin`) 及其在闪存中的烧录地址 (`offset`)。**重要的是，这里的 `path` 是相对于当前版本文件夹的相对路径**。
7.  **二进制文件 (`.bin`)**: 实际的固件文件。

---

## 如何添加一个全新的设备

假设您要添加一个名为 “ESP32-CAM” 的新设备。

### 第1步：创建设备文件夹和固件文件

1.  在 `firmware` 目录下创建一个新的设备文件夹，例如 `firmware/esp32-cam/`。
2.  在 `firmware/esp32-cam/` 内部，创建一个 `firmwares` 子文件夹。
3.  在 `firmware/esp32-cam/firmwares/` 内部，为您的第一个版本创建一个文件夹，例如 `v1.0/`。
4.  将 “ESP32-CAM” v1.0 版本所需的所有 `.bin` 文件（例如 `bootloader.bin`, `partitions.bin`, `firmware.bin`）放入 `firmware/esp32-cam/firmwares/v1.0/` 文件夹中。

### 第2步：创建设备描述和版本清单 JSON

1.  **创建设备描述文件**: 在 `firmware/esp32-cam/` 目录下创建一个 `esp32-cam.json` 文件，内容如下：
    ```json
    {
      "name": "ESP32-CAM",
      "image": "firmware/esp32-cam/esp32-cam.png"
    }
    ```
    *   `name`: 将显示在设备选择列表中的名称。
    *   `image`: 设备的图片路径。

2.  **创建版本清单文件**: 在 `firmware/esp32-cam/firmwares/v1.0/` 目录下创建一个 `v1.0.json` 文件，内容如下：
    ```json
    {
      "version": "1.0",
      "new_install_prompt_erase": true,
      "builds": [
        {
          "chipFamily": "ESP32",
          "parts": [
            { "path": "bootloader.bin", "offset": 4096 },
            { "path": "partitions.bin", "offset": 32768 },
            { "path": "firmware.bin", "offset": 65536 }
          ]
        }
      ]
    }
    ```
    *   `path`: **相对于当前 `v1.0.json` 文件的路径**。由于 `.bin` 文件和它在同一个文件夹，所以这里直接写文件名。
    *   `offset`: 十进制的烧录地址。

### 第3步：在 `config.json` 中注册新设备

1.  打开 `firmware/config.json` 文件。
2.  在 `devices` 数组中，添加一个指向新设备描述文件的新对象：

    ```json
    {
      "devices": [
        // ... 其他设备
        {
          "id": "esp32-cam",
          "name": "ESP32-CAM",
          "path": "firmware/esp32-cam/esp32-cam.json"
        }
      ]
    }
    ```
    *   `path`: 指向您在第2步创建的**设备描述文件**。

### 第4步：完成！

刷新网页，您应该就能在“选择设备”中看到 “ESP32-CAM”，并能选择对应的固件和版本进行烧录了。

---

## 如何为现有设备添加一个新版本

这比添加新设备更简单。假设您要为 "ESP32-CAM" 添加一个 "v2.1" 版本。

1.  **准备新版本的固件文件**：
    *   在 `firmware/esp32-cam/firmwares/` 目录下创建一个新版本文件夹，例如 `v2.1/`。
    *   将新版本的 `.bin` 文件放入其中。
2.  **创建新版本的固件清单**：
    *   在 `v2.1/` 文件夹中创建一个 `v2.1.json` 文件。
    *   复制 `v1.0.json` 的内容并进行相应修改（例如更新 `path` 或 `offset`）。
3.  **更新设备描述文件**：
    *   打开 `firmware/esp32-cam/esp32-cam.json`。
    *   在 `firmwares` 数组中添加一个指向新版本清单的条目。 (注意：您需要先手动将 `firmwares` 数组添加到设备描述文件中，如果它不存在的话)。
    
    *此步骤需要代码支持，当前版本的代码会自动扫描 `firmwares` 文件夹，您无需手动修改设备描述文件。*

**简化的新版本添加流程：**

1.  在设备的 `firmwares` 文件夹内创建一个新版本目录 (e.g., `v2.1`)。
2.  将新版本的 `.bin` 文件和对应的 `v2.1.json` 清单文件放入该目录。
3.  **完成！** 刷新网页即可看到新版本选项。

通过遵循以上步骤，您可以无限扩展此项目，而无需担心代码逻辑变得混乱。
