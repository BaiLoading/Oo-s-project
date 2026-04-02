"""
腾讯云 Serverless 入口文件
"""
import sys
import os

# 添加当前目录到路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from server_akshare import app

def main_handler(event, context):
    """
    腾讯云 Serverless 主入口函数
    """
    from flask import request
    
    # 获取请求信息
    method = event.get('httpMethod', 'GET')
    path = event.get('path', '/')
    headers = event.get('headers', {})
    query_string = event.get('queryString', {})
    
    # 处理请求
    with app.test_request_context(
        path=path,
        method=method,
        headers=headers,
        query_string=query_string,
        data=event.get('body', '')
    ):
        try:
            response = app.full_dispatch_request()
            return {
                'isBase64Encoded': False,
                'statusCode': response.status_code,
                'headers': dict(response.headers),
                'body': response.get_data(as_text=True)
            }
        except Exception as e:
            return {
                'isBase64Encoded': False,
                'statusCode': 500,
                'headers': {'Content-Type': 'application/json'},
                'body': f'{{"error": "{str(e)}"}}'
            }

# 别名兼容
main = main_handler
