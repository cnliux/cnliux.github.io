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
        'group_title': '虎牙'
    },
    'douyu': {
        'url': 'https://fastly.jsdelivr.net/gh/mursor1985/LIVE@main/douyuyqk.m3u',
        'name': '斗鱼',
        'group_title': '斗鱼'
    }
}

# 文件映射：私有仓库文件 -> 公开仓库文件
FILE_MAPPINGS = [
    {'source': 'outputs/all.m3u', 'target': 'tv.m3u'},
    {'source': 'outputs/all.txt', 'target': 'tv.txt'},
]
# ===================

def fetch_stream_content(url, source_name):
    """从远程URL拉取直播源"""
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        content = response.text
        print(f'✅ 成功拉取{source_name}直播源 (大小: {len(content)} 字符)')
        return content
    except Exception as e:
        print(f'⚠️ 拉取{source_name}直播源失败: {e}')
        return None

def extract_channel_info(extinf_line):
    """从EXTINF行提取频道信息，保留所有属性"""
    # 提取频道名（逗号后面的部分）
    channel_name = ''
    if ',' in extinf_line:
        parts = extinf_line.split(',', 1)
        channel_name = parts[1].strip()
        extinf_part = parts[0]
    else:
        extinf_part = extinf_line
        channel_name = '未知频道'
    
    # 提取tvg-name
    tvg_name = ''
    tvg_name_match = re.search(r'tvg-name="([^"]*)"', extinf_part)
    if tvg_name_match:
        tvg_name = tvg_name_match.group(1)
    else:
        tvg_name = channel_name
    
    # 提取tvg-logo
    tvg_logo = ''
    tvg_logo_match = re.search(r'tvg-logo="([^"]*)"', extinf_part)
    if tvg_logo_match:
        tvg_logo = tvg_logo_match.group(1)
    
    # 提取group-title（如果有的话）
    group_title = ''
    group_match = re.search(r'group-title="([^"]*)"', extinf_part)
    if group_match:
        group_title = group_match.group(1)
    
    return {
        'channel_name': channel_name,
        'tvg_name': tvg_name,
        'tvg_logo': tvg_logo,
        'group_title': group_title
    }

def extract_channels_from_m3u(content):
    """从M3U内容中提取频道信息，返回频道列表（包含完整属性）"""
    channels = []
    lines = content.splitlines()
    i = 0
    
    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue
        
        # 跳过M3U头部和#genre#标记
        if line.startswith('#EXTM3U') or line.startswith('#genre#'):
            i += 1
            continue
        
        # 处理频道信息
        if line.startswith('#EXTINF:'):
            # 提取频道信息
            channel_info = extract_channel_info(line)
            
            # 获取下一行的URL
            i += 1
            if i < len(lines):
                url_line = lines[i].strip()
                if url_line and not url_line.startswith('#'):
                    channel_info['url'] = url_line
                    channels.append(channel_info)
        i += 1
    
    return channels

def format_m3u_channel(channel_info, new_group_title):
    """格式化M3U频道行，保留所有属性，只修改group-title"""
    # 构建EXTINF行，保留所有原有属性
    extinf = f'#EXTINF:-1 tvg-name="{channel_info["tvg_name"]}" group-title="{new_group_title}"'
    
    # 如果有logo，保留
    if channel_info.get('tvg_logo'):
        extinf += f' tvg-logo="{channel_info["tvg_logo"]}"'
    
    # 添加频道名
    extinf += f',{channel_info["channel_name"]}'
    
    return f'{extinf}\n{channel_info["url"]}'

def process_m3u_content(content, stream_contents):
    """处理m3u格式内容，将多个直播源添加到末尾"""
    if not stream_contents:
        return content
    
    # 移除所有原有的直播源内容（通过检测group-title）
    lines = content.splitlines()
    filtered_lines = []
    skip = False
    
    for line in lines:
        # 检测已有的虎牙或斗鱼分组
        if 'group-title="虎牙"' in line or 'group-title="斗鱼"' in line:
            skip = True
            continue
        if skip and line.strip() and not line.startswith('#'):
            # 跳过URL
            continue
        if skip and line.startswith('#EXTINF:'):
            # 跳过EXTINF行
            continue
        if skip and not line.strip():
            # 空行表示分组结束
            skip = False
            continue
        if not skip:
            filtered_lines.append(line)
    
    content = '\n'.join(filtered_lines)
    
    # 确保内容以正确的M3U头部开始
    if not content.startswith('#EXTM3U'):
        content = '#EXTM3U\n' + content
    
    # 确保末尾有换行
    if not content.endswith('\n'):
        content += '\n'
    
    # 添加所有直播源
    for source_key, source_info in stream_contents.items():
        if source_info['content']:
            # 从源内容中提取频道（保留所有属性）
            channels = extract_channels_from_m3u(source_info['content'])
            
            if channels:
                # 添加空行分隔
                content += '\n'
                
                # 为每个频道生成标准M3U格式，替换group-title
                for channel in channels:
                    formatted = format_m3u_channel(channel, source_info['group_title'])
                    content += formatted + '\n'
    
    return content

def process_txt_content(content, stream_contents):
    """处理txt格式内容，将多个直播源以纯文本格式添加到末尾"""
    if not stream_contents:
        return content
    
    # 移除所有原有的直播源内容（检测 #genre# 标记）
    lines = content.splitlines()
    filtered_lines = []
    skip = False
    
    for line in lines:
        # 检测已有的虎牙或斗鱼分类标记（格式：虎牙,#genre# 或 斗鱼,#genre#）
        if re.match(r'^(虎牙|斗鱼),#genre#$', line.strip()):
            skip = True
            continue
        if skip and line.strip() and ',' in line and not line.endswith(',#genre#'):
            # 跳过频道行（频道名,URL格式）
            continue
        if skip and not line.strip():
            # 空行表示分组结束
            skip = False
            continue
        if not skip:
            filtered_lines.append(line)
    
    content = '\n'.join(filtered_lines)
    
    # 确保末尾有换行
    if not content.endswith('\n'):
        content += '\n'
    
    # 添加所有直播源（使用 #genre# 格式）
    for source_key, source_info in stream_contents.items():
        if source_info['content']:
            # 从M3U格式提取频道信息
            channels = extract_channels_from_m3u(source_info['content'])
            
            if channels:
                # 添加分类标记（格式：虎牙,#genre#）
                content += f'\n{source_info["name"]},#genre#\n'
                # 添加频道列表（格式：频道名,URL）
                for channel in channels:
                    content += f'{channel["channel_name"]},{channel["url"]}\n'
    
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
            'group_title': source_info['group_title']
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
        print('🎯 虎牙和斗鱼直播源已作为独立分类添加到文件末尾')
        exit(0)
    else:
        print(f'⚠️ 成功 {success_count}/{total_count} 个文件，请检查失败原因')
        exit(1)
