import os
import json
import re

def slugify(text):
    """
    Converts a string to a slug-like format (lowercase, underscores instead of spaces, alphanumeric only).
    """
    text = text.lower()
    text = re.sub(r'\s+', '_', text)  # Replace spaces with underscores
    text = re.sub(r'[^\w-]+', '', text)  # Remove non-alphanumeric characters (except underscores and hyphens)
    text = re.sub(r'_+', '_', text)  # Replace multiple underscores with a single underscore
    text = text.strip('_')  # Trim underscores from start/end
    return text

def ask_question(query, default_value=None):
    """
    Prompts the user for input with an optional default value.
    """
    if default_value:
        return input(f"{query} (default: {default_value}): ") or default_value
    else:
        return input(f"{query}: ")

def create_new_device():
        print("--- 创建新设备脚本 (Python) ---")
    
        new_device_name = ask_question("请输入新设备名称 (例如: FNK00xx)")
        new_device_id = slugify(new_device_name)
    
        new_firmware_name = ask_question("请输入固件名称 (例如: 默认固件)")
        new_firmware_id = slugify(new_firmware_name)
    
        new_version_name = ask_question("请输入版本名称 (例如: v1.0)")
        new_version_id = slugify(new_version_name)
    
        script_dir = os.path.dirname(__file__)
        firmware_config_path = os.path.join(script_dir, 'firmware', 'config.json')
    
        print(f"\n正在创建设备: {new_device_name} (ID: {new_device_id})")
        print(f"固件: {new_firmware_name} (ID: {new_firmware_id})")
        print(f"版本: {new_version_name} (ID: {new_version_id})")
    
        try:
            # 1. 定义路径
            device_base_dir = os.path.join(script_dir, 'firmware', f'{new_device_id}_device')
            device_json_path = os.path.join(device_base_dir, f'{new_device_id}.json')
            device_image_path = os.path.join(device_base_dir, f'{new_device_id}.png')
            firmware_version_dir = os.path.join(device_base_dir, 'firmwares', new_version_id)
            firmware_manifest_path = os.path.join(firmware_version_dir, f'{new_version_id}.json')
    
            # 2. 创建目录
            print(f"正在创建目录: {device_base_dir}")
            os.makedirs(device_base_dir, exist_ok=True)
            print(f"正在创建目录: {firmware_version_dir}")
            os.makedirs(firmware_version_dir, exist_ok=True)
    
            # 3. 创建 device.json
            device_json_content = {
                "name": new_device_name,
                "image": f"{new_device_id}.png"
            }
            print(f"正在创建文件: {device_json_path}")
            with open(device_json_path, 'w', encoding='utf-8') as f:
                json.dump(device_json_content, f, indent=2, ensure_ascii=False)
    
            # 4. 创建设备图片占位符
            print(f"正在创建图片占位符文件: {device_image_path} (请替换为实际的 PNG 图片)")
            with open(device_image_path, 'w', encoding='utf-8') as f:
                f.write(f"// 这是 {new_device_name} 设备图片的占位符，无法使用。请将此文件替换为实际的 PNG 图片。")
    
            # 5. 创建固件清单 (.json)
            firmware_manifest_content = {
                "version": new_version_name,
                "new_install_prompt_erase": True,
                "builds": [
                    {
                        "chipFamily": "ESP32-S3",  # 默认芯片家族
                        "parts": [
                            {"path": "bootloader.bin", "offset": 0},
                            {"path": "partition-table.bin", "offset": 32768},
                            {"path": "ota_data_initial.bin", "offset": 53248},
                            {"path": "srmodels.bin", "offset": 65536},
                            {"path": "firmware.bin", "offset": 1048576}  # 主固件二进制文件
                        ]
                    }
                ]
            }
            print(f"正在创建文件: {firmware_manifest_path}")
            with open(firmware_manifest_path, 'w', encoding='utf-8') as f:
                json.dump(firmware_manifest_content, f, indent=2, ensure_ascii=False)
    
            # 6. 创建空的二进制文件占位符 (根据清单中的部分)
            for part in firmware_manifest_content['builds'][0]['parts']:
                binary_file_path = os.path.join(firmware_version_dir, part['path'])
                print(f"正在创建空的二进制文件占位符: {binary_file_path}")
                with open(binary_file_path, 'wb') as f:  # 'wb' 用于二进制写入
                    f.write(b'') # 创建一个零字节文件
    
            # 7. 更新 firmware/config.json
            config = {"devices": []}
            if os.path.exists(firmware_config_path):
                with open(firmware_config_path, 'r', encoding='utf-8') as f:
                    config = json.load(f)
    
            new_device_entry = {
                "id": new_device_id,
                "name": new_device_name,
                "image": f"firmware/{new_device_id}_device/{new_device_id}.png",
                "firmwares": [
                    {
                        "id": new_firmware_id,
                        "name": new_firmware_name,
                        "versions": [
                            {
                                "id": new_version_id,
                                "name": new_version_name,
                                "manifest_path": f"firmware/{new_device_id}_device/firmwares/{new_version_id}/{new_version_id}.json"
                            }
                        ]
                    }
                ]
            }
    
            # 检查是否存在相同 ID 的设备
            existing_device_index = -1
            for i, device in enumerate(config['devices']):
                if device['id'] == new_device_id:
                    existing_device_index = i
                    break
    
            if existing_device_index != -1:
                print(f"警告: ID 为 \"{new_device_id}\" 的设备已存在于 config.json 中。正在尝试更新其条目。")
                existing_device = config['devices'][existing_device_index]
                
                existing_firmware_index = -1
                for i, firmware in enumerate(existing_device['firmwares']):
                    if firmware['id'] == new_firmware_id:
                        existing_firmware_index = i
                        break
    
                if existing_firmware_index != -1:
                    existing_firmware = existing_device['firmwares'][existing_firmware_index]
                    
                    existing_version_index = -1
                    for i, version in enumerate(existing_firmware['versions']):
                        if version['id'] == new_version_id:
                            existing_version_index = i
                            break
    
                    if existing_version_index != -1:
                        print(f"警告: 设备 \"{new_device_id}\" 的固件 \"{new_firmware_id}\" 中已存在版本 \"{new_version_id}\"。正在替换其条目。")
                        existing_firmware['versions'][existing_version_index] = new_device_entry['firmwares'][0]['versions'][0]
                    else:
                        print(f"正在将新版本 \"{new_version_id}\" 添加到设备 \"{new_device_id}\" 的现有固件 \"{new_firmware_id}\" 中。")
                        existing_firmware['versions'].append(new_device_entry['firmwares'][0]['versions'][0])
                else:
                    print(f"正在将新固件 \"{new_firmware_id}\" 添加到现有设备 \"{new_device_id}\" 中。")
                    existing_device['firmwares'].append(new_device_entry['firmwares'][0])
            else:
                print(f"正在将新设备 \"{new_device_id}\" 添加到 config.json 中。")
                config['devices'].append(new_device_entry)
    
            with open(firmware_config_path, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2, ensure_ascii=False)
            print(f"已更新 {firmware_config_path}")
    
            print("\n新设备和固件结构创建成功！")
    
        except Exception as e:
            print(f"发生错误: {e}")
if __name__ == "__main__":
    create_new_device()
