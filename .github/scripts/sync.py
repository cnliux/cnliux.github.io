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

# 直播源URL配置
STREAM_SOURCES = {
    'huya': {
        'url': 'https://fastly.jsdelivr.net/gh/mursor1985/LIVE@main/huyayqk.m3u',
        'name': '虎牙',
        'genre_tag': '#genre#虎牙'
    },
    'douyu': {
        'url': 'https://fastly.jsdelivr.net/gh/mursor1985/LIVE@main/douyuyqk.m3u',
        'name': '斗鱼',
        'genre_tag': '#genre#斗鱼'
    }
}

# 文件映射：私有仓库文件 -> 公开仓库文件
FILE_MAPPINGS = [
    {'source': 'outputs/all.m3u', 'target': 'tv.m3u'},
    {'source': 'outputs/all.txt', 'target': 'tv.txt'},
]
# ===================

def fetch_stream_content(url, source_name):
    """从远程URL拉取直播源，并清理格式"""
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        content = response.text
        
        # 清理拉取的内容，移除可能存在的头部和分组标记
        lines = content.splitlines()
        cleaned_lines = []
        in_header = True
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # 跳过可能的头部标记（除了必要的EXTM3U）
            if line.startswith('#EXTM3U'):
                continue
            if line.startswith('#genre#'):
                continue
            if line.startswith('#EXTINF:'):
                in_header = False
                cleaned_lines.append(line)
            elif not in_header and not line.startswith('#'):
                cleaned_lines.append(line)
            elif line.startswith('#EXTVLCOPT') or line.startswith('#EXTGRP'):
                # 保留一些重要的扩展标记
                cleaned_lines.append(line)
        
        result = '\n'.join(cleaned_lines)
        print(f'✅ 成功拉取{source_name}直播源 (处理前: {len(content)} 字符, 处理后: {len(result)} 字符)')
        return result
    except Exception as e:
        print(f'⚠️ 拉取{source_name}直播源失败: {e}')
        return None

def process_m3u_content(content, stream_contents):
    """处理m3u格式内容，将多个直播源添加到末尾"""
    if not stream_contents:
        return content
    
    # 移除所有原有的直播源内容
    lines = content.splitlines()
    filtered_lines = []
    skip = False
    
    # 查找并移除所有已有的直播源部分
    for line in lines:
        # 检测所有可能的分类标记
        if '#genre#' in line and any(name in line for name in ['虎牙', '斗鱼']):
            skip = True
            continue
        if skip and line.strip() == '':
            skip = False
            continue
        if not skip:
            filtered_lines.append(line)
    
    content = '\n'.join(filtered_lines)
    
    # 确保内容以正确的M3U头部开始
    if not content.startswith('#EXTM3U'):
        # 如果原内容没有头部，添加一个
        content = '#EXTM3U\n' + content
    
    # 确保末尾有换行
    if not content.endswith('\n'):
        content += '\n'
    
    # 添加所有直播源，使用正确的分组标记
    for source_key, source_info in stream_contents.items():
        if source_info['content']:
            # 添加分组标记（应该在频道列表之前）
            content += f'\n{source_info["genre_tag"]}\n'
            # 添加频道内容
            content += source_info['content']
            if not source_info['content'].endswith('\n'):
                content += '\n'
    
    return content

def process_txt_content(content, stream_contents):
    """处理txt格式内容，将多个直播源添加到末尾"""
    if not stream_contents:
        return content
    
    # 移除所有原有的直播源内容
    lines = content.splitlines()
    filtered_lines = []
    skip = False
    
    # 查找并移除所有已有的直播源部分
    for line in lines:
        if any(keyword in line for keyword in ['虎牙直播', '斗鱼直播', '#虎牙', '#斗鱼', '#genre#虎牙', '#genre#斗鱼']):
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
    
    # 添加所有直播源
    for source_key, source_info in stream_contents.items():
        if source_info['content']:
            content += f'\n#{source_info["name"]}直播源\n'
            content += source_info['content']
            if not source_info['content'].endswith('\n'):
                content += '\n'
    
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
        'message': f'同步 {target_path} 从私有仓库（含虎牙、斗鱼直播源）',
        'content': base64.b64encode(content.encode('utf-8')).decode(),
        'branch': BRANCH
    }
    if sha:
        payload['sha'] = sha
    response = requests.put(url, json=payload, headers=headers)
    response.raise_for_status()
    print(f'✅ {target_path} 同步成功！')

if __name__ == '__main__':
    # 拉取所有直播源
    stream_contents = {}
    print('📡 正在拉取直播源...')
    
    for source_key, source_info in STREAM_SOURCES.items():
        content = fetch_stream_content(source_info['url'], source_info['name'])
        stream_contents[source_key] = {
            'content': content,
            'name': source_info['name'],
            'genre_tag': source_info['genre_tag']
        }
    
    success_count = 0
    total_count = len(FILE_MAPPINGS)
    
    for mapping in FILE_MAPPINGS:
        source_file = mapping['source']
        target_file = mapping['target']
        print(f'📁 同步 {source_file} -> {target_file}')
        
        try:
            # 从私有仓库获取原始内容
            content = get_private_file(source_file)
            
            # 根据文件类型处理直播源
            has_content = any(info['content'] for info in stream_contents.values())
            if has_content:
                if target_file.endswith('.m3u'):
                    processed_content = process_m3u_content(content, stream_contents)
                elif target_file.endswith('.txt'):
                    processed_content = process_txt_content(content, stream_contents)
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
        print('🎯 虎牙和斗鱼直播源已作为独立节目列表添加到文件末尾')
        exit(0)
    else:
        print(f'⚠️ 成功 {success_count}/{total_count} 个文件，请检查失败原因')
        exit(1)
