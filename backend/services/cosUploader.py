#!/usr/bin/env python3
"""
腾讯云COS文件上传服务
"""
import os
import sys
import json
from qcloud_cos import CosConfig, CosS3Client

def upload_to_cos(file_path, object_key=None):
    """
    上传文件到腾讯云COS
    
    Args:
        file_path: 本地文件路径
        object_key: COS对象键（路径），如果不提供则使用文件名
    
    Returns:
        dict: 包含下载链接等信息
    """
    try:
        # 从环境变量获取配置
        secret_id = os.getenv("COS_SECRET_ID")
        secret_key = os.getenv("COS_SECRET_KEY")
        region = os.getenv("COS_REGION") or "ap-chengdu"
        bucket_name = os.getenv("COS_BUCKET_NAME") or "jiaoanshenpi-1329644535"
        base_url = os.getenv("COS_BASE_URL") or f"https://{bucket_name}.cos.{region}.myqcloud.com"
        
        # 检查文件是否存在
        if not os.path.exists(file_path):
            return {
                "success": False,
                "error": f"文件不存在: {file_path}"
            }
        
        # 如果没有指定object_key，使用文件名
        if not object_key:
            object_key = os.path.basename(file_path)
        
        # 必须提供密钥（不要在代码里写死）
        if not secret_id or not secret_key:
            return {
                "success": False,
                "error": "缺少COS_SECRET_ID或COS_SECRET_KEY环境变量（请在本机或部署环境中配置）"
            }

        # 初始化COS客户端
        config = CosConfig(
            Region=region,
            SecretId=secret_id,
            SecretKey=secret_key,
            Scheme='https'
        )
        client = CosS3Client(config)
        
        # 上传文件
        with open(file_path, 'rb') as fp:
            response = client.put_object(
                Bucket=bucket_name,
                Body=fp,
                Key=object_key,
                StorageClass='STANDARD',
                ContentType='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            )
        
        # 生成下载链接
        download_url = f"{base_url}/{object_key}"
        
        return {
            "success": True,
            "download_url": download_url,
            "object_key": object_key,
            "bucket": bucket_name,
            "region": region
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

def main():
    """主函数：从标准输入读取JSON，上传文件，输出结果JSON"""
    try:
        # 从标准输入读取JSON
        input_data = sys.stdin.read()
        data = json.loads(input_data)
        
        file_path = data.get('file_path')
        object_key = data.get('object_key')
        
        if not file_path:
            result = {
                "success": False,
                "error": "缺少file_path参数"
            }
        else:
            result = upload_to_cos(file_path, object_key)
        
        # 输出结果JSON
        print(json.dumps(result, ensure_ascii=False))
        
    except json.JSONDecodeError as e:
        result = {
            "success": False,
            "error": f"JSON解析错误: {str(e)}"
        }
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        result = {
            "success": False,
            "error": f"处理错误: {str(e)}"
        }
        print(json.dumps(result, ensure_ascii=False))

if __name__ == '__main__':
    main()

