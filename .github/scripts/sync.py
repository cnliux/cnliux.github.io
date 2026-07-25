import requests
import base64
import os
import re

GITHUB_TOKEN = os.environ.get('GITHUB_TOKEN')

# ===== 你的配置 =====
SOURCE_OWNER = 'cnliux'
SOURCE_REPO = 'IPTV'
TARGET_OWNER = 'cnliux'
TARGET_REPO = 'cnliux.github.io'
BRANCH = 'main'
HUYA_URL = 'https://fastly.jsdelivr.net/gh/mursor1985/LIVE@main/huyayqk.m3u'

# 文件映射：私有仓库文件 -> 公开仓库文件
FILE_MAPPINGS = [
    {'source': 'outputs/all.m3u', 'target': 'tv.m3u'},
    {'source': 'outputs/all.txt', 'target': 'tv.txt'},
]
# ===================

def fetch_huya_content():
    """从远程URL拉取虎牙直播源"""
    try:
        response = requests.get(HUYA_URL, timeout=10)
        response.raise_for_status()
        content = response.text
        print(f'✅ 成功拉取虎牙直播源 (大小: {len(content)} 字符)')
        return content
    except Exception as e:
        print(f'⚠️ 拉取虎牙直播源失败: {e}')
        return None

def process_m3u_content(content, huya_content):
    """处理m3u格式内容，将虎牙源添加到末尾"""
    if not huya_content:
        return content
    
    # 移除原有虎牙相关的内容（如果有）
    lines = content.splitlines()
    filtered_lines = []
    skip = False
    
    # 查找并移除原有的虎牙相关部分（从 #genre# 虎牙 开始）
    for line in lines:
        if '#genre#' in line and '虎牙' in line:
            skip = True
            continue
        if skip and line.strip() == '':
            skip = False
            continue
        if not skip:
            filtered_lines.append(line)
    
    content = '\n'.join(filtered_lines)
    
    # 确保末尾有换行
    if not content.endswith('\n'):
        content += '\n'
    
    # 添加虎牙直播源
    content += '\n#genre#虎牙\n'
    content += huya_content
    
    return content

def process_txt_content(content, huya_content):
    """处理txt格式内容，将虎牙源添加到末尾"""
    if not huya_content:
        return content
    
    # 对于txt文件，直接添加虎牙内容到末尾
    # 移除可能存在的重复虎牙部分
    lines = content.splitlines()
    filtered_lines = []
    skip = False
    
    # 查找并移除原有的虎牙相关部分
    for line in lines:
        if '虎牙直播' in line or '虎牙' in line and 'http' in line:
            skip = True
            continue
        if skip and line.strip() == '':
            skip = False
            continue
        if not skip:
            filtered_lines.append(line)
    
    content = '\n'.join(filtered_lines)
    
    # 确保末尾有换行
    if not content.endswith('\n'):
        content += '\n'
    
    # 添加虎牙直播源（保留原始格式）
    content += '\n#虎牙直播源\n'
    content += huya_content
    
    return content

def get_private_file(source_path):
    """从私有仓库读取文件内容"""
    url = f'https://api.github.com/repos/{SOURCE_OWNER}/{SOURCE_REPO}/contents/{source_path}'
    headers = {
        'Authorization': f'token {GITHUB_TOKEN}',
        'Accept': 'application/vnd.github.v3+json'
    }
    response = requests.get(url, headers=headers)
    response.raise_for_status()
    data = response.json()
    return base64.b64decode(data['content']).decode('utf-8')

def get_target_sha(target_path):
    """获取公开仓库目标文件的SHA（如果存在）"""
    url = f'https://api.github.com/repos/{TARGET_OWNER}/{TARGET_REPO}/contents/{target_path}'
    headers = {'Authorization': f'token {GITHUB_TOKEN}'}
    response = requests.get(url, headers=headers)
    if response.status_code == 404:
        return None
    response.raise_for_status()
    return response.json()['sha']

def update_public_file(content, target_path, sha):
    """更新或创建公开仓库的文件"""
    url = f'https://api.github.com/repos/{TARGET_OWNER}/{TARGET_REPO}/contents/{target_path}'
    headers = {
        'Authorization': f'token {GITHUB_TOKEN}',
        'Accept': 'application/vnd.github.v3+json'
    }
    payload = {
        'message': f'同步 {target_path} 从私有仓库（含虎牙直播源）',
        'content': base64.b64encode(content.encode('utf-8')).decode(),
        'branch': BRANCH
    }
    if sha:
        payload['sha'] = sha
    response = requests.put(url, json=payload, headers=headers)
    response.raise_for_status()
    print(f'✅ {target_path} 同步成功！')

if __name__ == '__main__':
    # 先拉取虎牙直播源
    print('📡 正在拉取虎牙直播源...')
    huya_content = fetch_huya_content()
    
    success_count = 0
    total_count = len(FILE_MAPPINGS)
    
    for mapping in FILE_MAPPINGS:
        source_file = mapping['source']
        target_file = mapping['target']
        print(f'📁 同步 {source_file} -> {target_file}')
        
        try:
            # 从私有仓库获取原始内容
            content = get_private_file(source_file)
            
            # 根据文件类型处理虎牙源
            if huya_content:
                if target_file.endswith('.m3u'):
                    processed_content = process_m3u_content(content, huya_content)
                elif target_file.endswith('.txt'):
                    processed_content = process_txt_content(content, huya_content)
                else:
                    processed_content = content
            else:
                processed_content = content
            
            # 获取目标文件SHA并更新
            sha = get_target_sha(target_file)
            update_public_file(processed_content, target_file, sha)
            success_count += 1
            
        except Exception as e:
            print(f'❌ {source_file} 同步失败: {e}')
    
    if success_count == total_count:
        print(f'✅ 全部 {total_count} 个文件同步成功！')
        print('🎯 虎牙直播源已作为独立节目列表添加到文件末尾')
        exit(0)
    else:
        print(f'⚠️ 成功 {success_count}/{total_count} 个文件，请检查失败原因')
        exit(1)
