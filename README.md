# 固件管理指南

本文档旨在帮助您轻松地管理和扩展此 Web Flasher 项目，特别是如何添加新的设备、固件和版本。

## 核心理念

本项目的核心设计思想是“配置与代码分离”。所有的设备信息、固件版本和烧录细节都存储在 `firmware` 目录下的 JSON 文件中，而不是硬编码在 JavaScript 代码里。这使得您在添加新内容时，几乎不需要修改任何代码，只需修改或添加配置文件即可。

## 文件结构概览

关键文件都位于 `firmware` 文件夹下，并采用了层级结构：

```
firmware/
├── config.json                     # 1. 全局主配置文件：列出所有设备及其固件和版本信息

└── [device_id]_device/             # 2. 单个设备的根文件夹 (例如: `xiaozhi_1.14inch_device`)
    ├── [device_id].json            # 3. 设备描述文件 (例如: `xiaozhi_1.14inch.json` 包含 `name` 和 `image` 的相对路径)
    ├── [device_id].png             #    (可选) 设备图片 (例如: `xiaozhi_1.14inch.png`)
    │
    └── firmwares/                  # 4. 存放该设备所有固件版本的目录
        │
        └── [version_id]/           # 5. 单个固件版本的文件夹 (例如: `v1.0`)
            ├── [version_id].json   # 6. 版本清单文件 (例如: `v1.0.json` 包含 `.bin` 路径和偏移量)
            ├── bootloader.bin      # 7. 该版本的二进制文件 (示例)
            └── firmware.bin        # 8. 该版本的主固件二进制文件 (示例)
```

1.  **`config.json`**: 这是项目的主配置文件。网页加载时会首先读取它，用来动态生成网页上的设备、固件和版本选择菜单。每个设备条目直接包含其所有固件和版本信息。
2.  **设备文件夹 (`[device_id]_device`)**: 每个设备都有一个独立的文件夹，例如 `firmware/xiaozhi_1.14inch_device/`，用于存放与该设备相关的文件。
3.  **设备描述文件 (`[device_id].json`)**: 位于设备文件夹内，是一个简单的 JSON 文件，包含设备的显示名称 (`name`) 和设备图片的相对路径 (`image`)。
4.  **`firmwares` 目录**: 位于设备文件夹内，用于组织该设备的不同固件版本。
5.  **版本文件夹 (`[version_id]`)**: 每个子文件夹代表一个独立的固件版本，例如 `firmware/xiaozhi_1.14inch_device/firmwares/v1.0/`。
6.  **版本清单 (`[version_id].json`)**: 描述了该版本需要烧录的所有二进制文件 (`.bin`) 及其在闪存中的烧录地址 (`offset`)。**重要的是，这里的 `path` 是相对于当前版本文件夹的相对路径**。
7.  **二进制文件 (`.bin`)**: 实际的固件文件，这些文件将根据版本清单中的定义被烧录到设备中。

---

## Python 脚本 `create_new_device.py` 使用指南

为了简化新设备和固件结构的创建过程，本项目提供了一个自动化脚本 `create_new_device.py`。

### 第1步：运行脚本

在项目根目录（`firmware_download/`）下打开终端，并执行以下命令：

```bash
python create_new_device.py
```

### 第2步：根据提示输入信息

脚本将引导您输入以下信息：

*   **新设备名称 (New Device Name)**：例如 `My New Board`。
*   **固件名称 (Firmware Name)**：例如 `Default Firmware`。
*   **版本名称 (Version Name)**：例如 `v1.0.0`。

脚本会根据您输入的名称自动生成对应的唯一 ID (例如 `my_new_board`, `default_firmware`, `v1_0_0`)。

### 第3步：脚本执行结果

脚本运行成功后，会自动完成以下操作：

1.  在 `firmware/` 目录下创建 `[device_id]_device/` 文件夹。
2.  在 `[device_id]_device/` 文件夹内创建 `[device_id].json` 文件，包含您输入的设备名称和图片占位符路径。
3.  在 `[device_id]_device/` 文件夹内创建 `[device_id].png` 图片占位符文件，提示您替换为实际的设备图片。
4.  在 `[device_id]_device/firmwares/` 目录下创建 `[version_id]/` 文件夹。
5.  在 `[version_id]/` 文件夹内创建 `[version_id].json` 固件清单文件，其中预设了一个 `ESP32-S3` 芯片家族的默认二进制文件列表和烧录偏移量（`bootloader.bin`, `partition-table.bin`, `ota_data_initial.bin`, `srmodels.bin`, `firmware.bin`）。
6.  根据固件清单创建空的 `.bin` 文件占位符，以便您后续放入实际的固件内容。
7.  **自动更新 `firmware/config.json` 文件**，将新设备、固件和版本条目添加到其中。如果设备或固件/版本 ID 已存在，脚本会发出警告并智能更新现有条目。

### 第4步：后续手动调整 (可选但推荐)

脚本创建的文件是基于通用模板的，您可能需要根据实际情况进行以下调整：

1.  **替换设备图片**: 将 `firmware/[device_id]_device/[device_id].png` 占位符文件替换为您的设备实际图片。
2.  **提供实际固件**: 将空的 `.bin` 文件占位符替换为您的真实固件二进制文件。
3.  **调整固件清单 (`[version_id].json`)**:
    *   修改 `chipFamily` 为您设备实际的芯片型号 (例如 `ESP32`, `ESP8266`, `ESP32-C3` 等)。
    *   根据您的固件结构，调整 `parts` 数组中的文件名 (`path`) 和烧录地址 (`offset`)。请确保这些 `path` 是相对于 `[version_id].json` 文件本身的。
4.  **刷新网页**: 完成上述调整后，刷新网页即可在 Web Flasher 界面中看到并使用新添加的设备、固件和版本。

---

## 如何手动添加一个全新的设备 (不推荐，但作为理解机制的补充)

尽管推荐使用脚本，理解手动添加的流程有助于深入理解项目结构。

### 第1步：准备文件结构和二进制文件

1.  在 `firmware/` 目录下，为您的新设备创建对应的文件夹，例如 `firmware/my_new_board_device/`。
2.  在该设备文件夹内，创建 `firmwares/` 子目录。
3.  在 `firmwares/` 内部，为您的固件版本创建文件夹，例如 `v1.0/`。
4.  将该版本所需的所有 `.bin` 固件文件放入 `firmware/my_new_board_device/firmwares/v1.0/` 文件夹。

### 第2步：创建设备描述和版本清单 JSON

1.  **创建设备描述文件 (`[device_id].json`)**:
    *   在 `firmware/my_new_board_device/` 目录下创建 `my_new_board.json` 文件。
    *   内容示例：
        ```json
        {
          "name": "我的新开发板",
          "image": "my_new_board.png" // 相对于该文件所在的目录
        }
        ```
2.  **创建版本清单文件 (`[version_id].json`)**:
    *   在 `firmware/my_new_board_device/firmwares/v1.0/` 目录下创建 `v1.0.json` 文件。
    *   内容示例（请根据您的固件实际情况调整 `chipFamily` 和 `parts`）：
        ```json
        {
          "version": "1.0",
          "new_install_prompt_erase": true,
          "builds": [
            {
              "chipFamily": "ESP32", // 替换为实际芯片型号
              "parts": [
                { "path": "bootloader.bin", "offset": 0 },
                { "path": "partition-table.bin", "offset": 32768 },
                { "path": "firmware.bin", "offset": 65536 } // 根据实际文件名和偏移量调整
              ]
            }
          ]
        }
        ```
        *   `path`: **相对于 `v1.0.json` 文件本身的路径**。

### 第3步：在 `firmware/config.json` 中注册新设备

1.  打开 `firmware/config.json` 文件。
2.  在 `devices` 数组中，手动添加您的新设备条目，确保 `id` 唯一，`name` 是显示名称，`image` 是设备的完整图片路径，`firmwares` 数组包含了您的固件和版本信息。

    ```json
    {
      "devices": [
        // ... 其他设备
        {
          "id": "my_new_board",
          "name": "我的新开发板",
          "image": "firmware/my_new_board_device/my_new_board.png",
          "firmwares": [
            {
              "id": "default_firmware",
              "name": "默认固件",
              "versions": [
                {
                  "id": "v1_0",
                  "name": "v1.0",
                  "manifest_path": "firmware/my_new_board_device/firmwares/v1.0/v1.0.json"
                }
              ]
            }
          ]
        }
      ]
    }
    ```

### 第4步：完成！

刷新网页，您应该就能在“选择设备”菜单中看到并使用新添加的设备、固件和版本了。

---

## 如何为现有设备添加一个新版本

这比添加新设备更简单。假设您要为名为 `my_new_board` 的设备添加一个 `v2.0` 版本。

1.  **准备新版本的固件文件**：
    *   在 `firmware/my_new_board_device/firmwares/` 目录下创建一个新版本文件夹，例如 `v2.0/`。
    *   将新版本的 `.bin` 文件放入其中。
2.  **创建新版本的固件清单 (`[version_id].json`)**：
    *   在 `v2.0/` 文件夹中创建一个 `v2.0.json` 文件。
    *   您可以参考 `v1.0.json` 的内容，并根据 `v2.0` 版本的实际固件文件和烧录地址进行修改。
3.  **更新 `firmware/config.json`**：
    *   打开 `firmware/config.json` 文件。
    *   找到 `id` 为 `my_new_board` 的设备条目。
    *   在其 `firmwares` 数组中找到对应的固件 (`id: "default_firmware"`)。
    *   在该固件的 `versions` 数组中，添加一个指向新版本清单的新条目：
        ```json
        {
          "id": "v2_0",
          "name": "v2.0",
          "manifest_path": "firmware/my_new_board_device/firmwares/v2.0/v2.0.json"
        }
        ```
4.  **完成！** 刷新网页即可看到新版本选项。

通过遵循以上步骤，您可以无限扩展此项目，而无需担心代码逻辑变得混乱。