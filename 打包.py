#!/usr/bin/env python3
import os
import zipfile
from datetime import datetime

def create_zip():
    print('=' * 60)
    print('  📦 股票智能分析系统 - 打包工具')
    print('=' * 60)
    print()
    
    # 生成zip文件名
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    zip_filename = f'股票智能分析系统_{timestamp}.zip'
    
    print(f'📁 正在创建: {zip_filename}')
    print()
    
    # 创建ZIP文件
    with zipfile.ZipFile(zip_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
        # 遍历当前目录，添加所有必要文件
        for root, dirs, files in os.walk('.'):
            # 跳过一些目录
            if 'venv' in root or '.git' in root or '__pycache__' in root:
                continue
            
            for file in files:
                # 跳过一些文件
                if file.endswith('.pyc') or file.endswith('.zip') or file == '.DS_Store':
                    continue
                
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, '.')
                zipf.write(file_path, arcname)
                print(f'✅ 添加: {arcname}')
    
    print()
    print('=' * 60)
    print(f'🎉 打包完成！')
    print(f'📦 文件: {zip_filename}')
    print()
    print('💡 现在您可以：')
    print('   1. 把这个ZIP文件分享给朋友')
    print('   2. 他们解压后运行"启动.bat"或"启动.sh"即可使用')
    print('=' * 60)

if __name__ == '__main__':
    create_zip()
