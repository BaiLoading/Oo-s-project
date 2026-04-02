import qrcode
import argparse
from PIL import Image

def generate_qrcode(url, output_file='qrcode.png', size=300):
    """
    生成二维码图片
    
    Args:
        url: 要生成二维码的URL
        output_file: 输出文件名
        size: 二维码尺寸
    """
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    
    qr.add_data(url)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="#1a1a2e", back_color="white")
    
    img = img.resize((size, size), Image.Resampling.LANCZOS)
    
    img.save(output_file)
    print(f'✅ 二维码已生成: {output_file}')
    print(f'📱 URL: {url}')
    
    return output_file

def generate_h5_qrcode(url):
    """生成H5二维码"""
    return generate_qrcode(url, 'h5_qrcode.png', 400)

def generate_miniprogram_qrcode(url=None):
    """
    生成小程序码提示
    注意：真实的小程序码需要通过微信官方API生成
    """
    print('\n' + '='*60)
    print('📱 小程序码生成说明')
    print('='*60)
    print('⚠️  注意：小程序码需要通过微信官方方式获取：')
    print('')
    print('方式1: 使用微信开发者工具')
    print('  1. 打开微信开发者工具')
    print('  2. 点击"工具" -> "生成小程序码"')
    print('  3. 输入页面路径，例如: pages/index/index')
    print('')
    print('方式2: 使用微信API接口')
    print('  需要在微信公众平台获取access_token')
    print('  调用: wxacode.getUnlimited 接口')
    print('')
    if url:
        print('方式3: 生成H5跳转链接二维码（临时方案）')
        generate_qrcode(url, 'miniprogram_h5_qrcode.png', 400)
    print('='*60)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='生成H5和小程序二维码')
    parser.add_argument('--url', type=str, required=True, help='H5页面URL')
    parser.add_argument('--type', type=str, default='all', 
                        choices=['h5', 'miniprogram', 'all'],
                        help='生成类型: h5/miniprogram/all (默认: all)')
    
    args = parser.parse_args()
    
    print('🎨 股票分析系统 - 二维码生成工具\n')
    
    if args.type in ['h5', 'all']:
        generate_h5_qrcode(args.url)
    
    if args.type in ['miniprogram', 'all']:
        generate_miniprogram_qrcode(args.url)
