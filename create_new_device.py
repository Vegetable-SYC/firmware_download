# 作者：Eason-swc
# 版本：v1.0
# 日期：2025/11/19

import os # 导入操作系统模块，用于文件路径操作和目录创建
import json # 导入JSON模块，用于读写JSON文件
import re # 导入正则表达式模块，用于字符串处理

def slugify(text):
    """
    将字符串转换为slug-like格式 (小写、以下划线代替空格、只保留字母数字)。
    此函数用于将用户输入的友好名称转换为适用于文件或ID的格式。

    Args:
        text (str): 待处理的原始字符串。

    Returns:
        str: 转换后的slug格式字符串。
    """
    text = text.lower() # 转换为小写
    text = re.sub(r'\s+', '_', text)  # 将所有空白字符替换为下划线
    text = re.sub(r'[^\w-]+', '', text)  # 移除所有非字母数字字符 (下划线和连字符除外)
    text = re.sub(r'_+', '_', text)  # 将多个连续下划线替换为单个下划线
    text = text.strip('_')  # 移除字符串开头和结尾的下划线
    return text

def ask_question(query):
    """
    向用户发出提示以获取输入。

    Args:
        query (str): 显示给用户的提示文本。

    Returns:
        str: 用户的输入字符串。
    """
    return input(f"{query}: ")

def create_new_device():
    """
    创建新设备、固件和版本所需的文件和目录结构，并更新主配置文件。
    """
    print("--- 创建新设备脚本 (Python) ---")
    
    # 1. 获取用户输入
    new_device_name = ask_question("请输入新设备名称 (例如: FNK00xx)")
    # 根据设备名称自动生成设备ID
    new_device_id = slugify(new_device_name)
    
    new_firmware_name = ask_question("请输入固件名称 (例如: 默认固件)")
    # 根据固件名称自动生成固件ID
    new_firmware_id = slugify(new_firmware_name)
    
    new_version_name = ask_question("请输入版本名称 (例如: v1.0)")
    # 根据版本名称自动生成版本ID
    new_version_id = slugify(new_version_name)
    
    # 获取脚本所在的目录，用于构建相对路径
    script_dir = os.path.dirname(__file__)
    # 构建主配置文件config.json的完整路径
    firmware_config_path = os.path.join(script_dir, 'firmware', 'config.json')
    
    print(f"\n正在创建设备: {new_device_name} (ID: {new_device_id})")
    print(f"固件: {new_firmware_name} (ID: {new_firmware_id})")
    print(f"版本: {new_version_name} (ID: {new_version_id})")
    
    try:
        # 2. 定义所有必要的文件和目录路径
        # 设备基础目录: firmware/[device_id]_device/
        device_base_dir = os.path.join(script_dir, 'firmware', f'{new_device_id}_device')
        # 设备JSON文件: firmware/[device_id]_device/[device_id].json
        device_json_path = os.path.join(device_base_dir, f'{new_device_id}.json')
        # 设备图片占位符文件: firmware/[device_id]_device/[device_id].png
        device_image_path = os.path.join(device_base_dir, f'{new_device_id}.png')
        # 固件版本目录: firmware/[device_id]_device/firmwares/[version_id]/
        firmware_version_dir = os.path.join(device_base_dir, 'firmwares', new_version_id)
        # 固件清单文件: firmware/[device_id]_device/firmwares/[version_id]/[version_id].json
        firmware_manifest_path = os.path.join(firmware_version_dir, f'{new_version_id}.json')
    
        # 3. 创建目录结构
        print(f"正在创建目录: {device_base_dir}")
        os.makedirs(device_base_dir, exist_ok=True) # 创建设备基础目录，如果已存在则不报错
        print(f"正在创建目录: {firmware_version_dir}")
        os.makedirs(firmware_version_dir, exist_ok=True) # 创建固件版本目录，如果已存在则不报错
    
        # 4. 创建设备描述JSON文件 ([device_id].json)
        device_json_content = {
            "name": new_device_name, # 设备显示名称
            "image": f"{new_device_id}.png"
        }
        print(f"正在创建文件: {device_json_path}")
        with open(device_json_path, 'w', encoding='utf-8') as f:
            json.dump(device_json_content, f, indent=2, ensure_ascii=False) # 写入JSON内容，美化格式，不转义非ASCII字符
    
        # 5. 创建设备图片占位符文件
        print(f"正在创建图片占位符文件: {device_image_path} (请替换为实际的 PNG 图片)")
        with open(device_image_path, 'w', encoding='utf-8') as f:
            f.write(f"// 这是 {new_device_name} 设备图片的占位符，无法使用。请将此文件替换为实际的 PNG 图片。")
    
        # 6. 创建固件清单JSON文件 ([version_id].json)
        # 预设固件清单内容，包含默认的芯片家族和二进制文件烧录信息
        firmware_manifest_content = {
            "version": new_version_name, # 固件版本名称
            "new_install_prompt_erase": True, # 是否在新安装时提示擦除闪存
            "builds": [
                {
                    "chipFamily": "ESP32-S3",  # 默认芯片家族，可根据实际情况修改
                    "parts": [
                        {"path": "bootloader.bin", "offset": 0}, # 引导加载器
                        {"path": "partition-table.bin", "offset": 32768}, # 分区表
                        {"path": "ota_data_initial.bin", "offset": 53248}, # OTA数据
                        {"path": "srmodels.bin", "offset": 65536}, # 语音识别模型 (示例)
                        {"path": "firmware.bin", "offset": 1048576}  # 主固件二进制文件
                    ]
                }
            ]
        }
        print(f"正在创建文件: {firmware_manifest_path}")
        with open(firmware_manifest_path, 'w', encoding='utf-8') as f:
            json.dump(firmware_manifest_content, f, indent=2, ensure_ascii=False) # 写入JSON内容
    
        # 7. 根据固件清单创建空的二进制文件占位符
        for part in firmware_manifest_content['builds'][0]['parts']:
            binary_file_path = os.path.join(firmware_version_dir, part['path'])
            print(f"正在创建空的二进制文件占位符: {binary_file_path}")
            with open(binary_file_path, 'wb') as f:  # 以二进制写入模式打开文件
                f.write(b'') # 写入零字节，创建一个空文件
    
        # 8. 更新 firmware/config.json 主配置文件
        config = {"devices": []} # 默认配置，以防文件不存在
        if os.path.exists(firmware_config_path):
            # 如果config.json存在，则读取现有内容
            with open(firmware_config_path, 'r', encoding='utf-8') as f:
                config = json.load(f)
    
        # 构建新的设备条目，用于添加到config.json
        new_device_entry = {
            "id": new_device_id, # 设备的唯一ID
            "name": new_device_name, # 设备显示名称
            "image": f"firmware/{new_device_id}_device/{new_device_id}.png", # 设备的图片路径 (相对于项目根目录)
            "firmwares": [
                {
                    "id": new_firmware_id, # 固件的唯一ID
                    "name": new_firmware_name, # 固件显示名称
                    "versions": [
                        {
                            "id": new_version_id, # 版本的唯一ID
                            "name": new_version_name, # 版本显示名称
                            "manifest_path": f"firmware/{new_device_id}_device/firmwares/{new_version_id}/{new_version_id}.json" # 固件清单文件路径
                        }
                    ]
                }
            ]
        }
    
        # 检查config.json中是否已存在相同ID的设备
        existing_device_index = -1
        for i, device_item in enumerate(config['devices']):
            if device_item['id'] == new_device_id:
                existing_device_index = i
                break
    
        if existing_device_index != -1:
            # 如果设备已存在，则尝试更新其固件和版本信息
            print(f"警告: ID 为 \"{new_device_id}\" 的设备已存在于 config.json 中。正在尝试更新其条目。")
            existing_device = config['devices'][existing_device_index]
            
            existing_firmware_index = -1
            for i, firmware_item in enumerate(existing_device['firmwares']):
                if firmware_item['id'] == new_firmware_id:
                    existing_firmware_index = i
                    break
    
            if existing_firmware_index != -1:
                # 如果固件已存在，则尝试更新其版本信息
                existing_firmware = existing_device['firmwares'][existing_firmware_index]
                
                existing_version_index = -1
                for i, version_item in enumerate(existing_firmware['versions']):
                    if version_item['id'] == new_version_id:
                        existing_version_index = i
                        break
    
                if existing_version_index != -1:
                    # 如果版本已存在，则替换旧版本信息
                    print(f"警告: 设备 \"{new_device_id}\" 的固件 \"{new_firmware_id}\" 中已存在版本 \"{new_version_id}\"。正在替换其条目。")
                    existing_firmware['versions'][existing_version_index] = new_device_entry['firmwares'][0]['versions'][0]
                else:
                    # 如果版本不存在，则添加新版本
                    print(f"正在将新版本 \"{new_version_id}\" 添加到设备 \"{new_device_id}\" 的现有固件 \"{new_firmware_id}\" 中。")
                    existing_firmware['versions'].append(new_device_entry['firmwares'][0]['versions'][0])
            else:
                # 如果固件不存在，则添加新固件
                print(f"正在将新固件 \"{new_firmware_id}\" 添加到现有设备 \"{new_device_id}\" 中。")
                existing_device['firmwares'].append(new_device_entry['firmwares'][0])
        else:
            # 如果设备不存在，则添加新设备条目
            print(f"正在将新设备 \"{new_device_id}\" 添加到 config.json 中。")
            config['devices'].append(new_device_entry)
    
        # 将更新后的配置写回config.json文件
        with open(firmware_config_path, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        print(f"已更新 {firmware_config_path}")
    
        print("\n新设备和固件结构创建成功！")
    
    except Exception as e:
        # 捕获并打印操作过程中发生的任何错误
        print(f"发生错误: {e}")

# 确保只有在直接运行脚本时才执行create_new_device函数
if __name__ == "__main__":
    create_new_device()