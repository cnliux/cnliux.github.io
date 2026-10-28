import requests
import base64
import os
import re
from urllib.parse import urlparse

GITHUB_TOKEN = os.environ.get('GITHUB_TOKEN')

# ===== 你的配置 =====
SOURCE_OWNER = 'cnliux'
SOURCE_REPO = 'IPTV'
TARGET_OWNER = 'cnliux'
TARGET_REPO = 'cnliux.github.io'
BRANCH = 'main'

# 直播源URL配置 - 只需要配置源URL和目标域名
STREAM_SOURCES = {
    'huya': {
        'url': 'https://sub.ottiptv.cc/huyayqk.m3u',
        'name': '虎牙',
        'group_title': '虎牙',
        'new_domain': 'live.metshop.top'
    },
    'douyu': {
        'url': 'https://sub.ottiptv.cc/douyuyqk.m3u',
        'name': '斗鱼',
        'group_title': '斗鱼',
        'new_domain': 'live.metshop.top'
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


def replace_all_domains_in_content(content, new_domain):
    """
    把内容中所有 URL 行的域名统一替换成 new_domain，路径/参数保持不变。
    - 只处理非 '#' 开头的行（即真正的 URL 行），
      #EXTINF 行里的 tvg-logo / tvg-url / group-title 等属性全部原样保留，不会被替换。
    - 不依赖旧域名，源文件里出现什么域名都能换。
    - 端口丢弃，统一为 new_domain（默认 http/https 原协议保留）。
    """
    if not content:
        return content

    # 匹配完整 URL：协议 + 域名(不含端口) + 可选端口 + 后续路径/参数
    url_pattern = re.compile(
        r'(https?://)([^/\s:?#"\'<>]+)(:\d+)?([/?#][^\s<>"\'{}|\\^`\[\]]*)?'
    )
    replaced_domains = set()

    def _replace_in_line(line):
        def _repl(m):
            protocol = m.group(1)
            old_domain = m.group(2)
            path = m.group(4) or ''
            if old_domain != new_domain:
                replaced_domains.add(old_domain)
            return f'{protocol}{new_domain}{path}'
        return url_pattern.sub(_repl, line)

    out_lines = []
    for line in content.splitlines():
        stripped = line.strip()
        # ★ 只替换非注释行（URL 行），logo 等元数据在 #EXTINF 行里，自动跳过
        if stripped and not stripped.startswith('#'):
            line = _replace_in_line(line)
        out_lines.append(line)

    result = '\n'.join(out_lines)
    if content.endswith('\n') and not result.endswith('\n'):
        result += '\n'

    if replaced_domains:
        print(f'   🔄 已替换域名 -> {new_domain}，涉及原域名: {sorted(replaced_domains)}')
    else:
        print(f'   ℹ️ 未发现需要替换的域名（或已经是 {new_domain}）')

    return result


def extract_channel_info(extinf_line):
    """从EXTINF行提取频道信息，保留所有属性"""
    if ',' in extinf_line:
        parts = extinf_line.split(',', 1)
        channel_name = parts[1].strip()
        extinf_part = parts[0]
    else:
        extinf_part = extinf_line
        channel_name = '未知频道'

    tvg_name_match = re.search(r'tvg-name="([^"]*)"', extinf_part)
    tvg_name = tvg_name_match.group(1) if tvg_name_match else channel_name

    tvg_logo_match = re.search(r'tvg-logo="([^"]*)"', extinf_part)
    tvg_logo = tvg_logo_match.group(1) if tvg_logo_match else ''

    group_match = re.search(r'group-title="([^"]*)"', extinf_part)
    group_title = group_match.group(1) if group_match else ''

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

        if line.startswith('#EXTM3U') or line.startswith('#genre#'):
            i += 1
            continue

        if line.startswith('#EXTINF:'):
            channel_info = extract_channel_info(line)
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
    extinf = f'#EXTINF:-1 tvg-name="{channel_info["tvg_name"]}" group-title="{new_group_title}"'
    if channel_info.get('tvg_logo'):
        extinf += f' tvg-logo="{channel_info["tvg_logo"]}"'
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
        if 'group-title="虎牙"' in line or 'group-title="斗鱼"' in line:
            skip = True
            continue
        if skip and line.strip() and not line.startswith('#'):
            continue
        if skip and line.startswith('#EXTINF:'):
            continue
        if skip and not line.strip():
            skip = False
            continue
        if not skip:
            filtered_lines.append(line)

    content = '\n'.join(filtered_lines)

    if not content.startswith('#EXTM3U'):
        content = '#EXTM3U\n' + content
    if not content.endswith('\n'):
        content += '\n'

    # 添加所有直播源
    for source_key, source_info in stream_contents.items():
        if not source_info['content']:
            continue

        print(f'📺 处理 {source_info["name"]} 源...')
        # ★ 全量替换域名（URL 行），logo 等元数据不动
        processed_content = replace_all_domains_in_content(
            source_info['content'], source_info['new_domain']
        )

        channels = extract_channels_from_m3u(processed_content)
        if channels:
            content += '\n'
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
        if re.match(r'^(虎牙|斗鱼),#genre#$', line.strip()):
            skip = True
            continue
        if skip and line.strip() and ',' in line and not line.endswith(',#genre#'):
            continue
        if skip and not line.strip():
            skip = False
            continue
        if not skip:
            filtered_lines.append(line)

    content = '\n'.join(filtered_lines)
    if not content.endswith('\n'):
        content += '\n'

    # 添加所有直播源（使用 #genre# 格式）
    for source_key, source_info in stream_contents.items():
        if not source_info['content']:
            continue

        print(f'📺 处理 {source_info["name"]} 源...')
        # ★ 全量替换域名（URL 行），logo 等元数据不动
        processed_content = replace_all_domains_in_content(
            source_info['content'], source_info['new_domain']
        )

        channels = extract_channels_from_m3u(processed_content)
        if channels:
            content += f'\n{source_info["name"]},#genre#\n'
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
    # ===== 暂停开关 =====
    PAUSED = False   # True=暂停，False=恢复运行

    if PAUSED:
        print('⏸️ IPTV 更新已暂停，跳过本次同步')
        exit(0)
    # ===================

    # 拉取所有直播源
    stream_contents = {}
    print('📡 正在拉取直播源...')

    for source_key, source_info in STREAM_SOURCES.items():
        content = fetch_stream_content(source_info['url'], source_info['name'])
        stream_contents[source_key] = {
            'content': content,
            'name': source_info['name'],
            'group_title': source_info['group_title'],
            'new_domain': source_info['new_domain'],
        }

    success_count = 0
    total_count = len(FILE_MAPPINGS)

    for mapping in FILE_MAPPINGS:
        source_file = mapping['source']
        target_file = mapping['target']
        print(f'📁 同步 {source_file} -> {target_file}')

        try:
            content = get_private_file(source_file)

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

            sha = get_target_sha(target_file)
            update_public_file(processed_content, target_file, sha)
            success_count += 1

        except Exception as e:
            print(f'❌ {source_file} 同步失败: {e}')

    if success_count == total_count:
        print(f'✅ 全部 {total_count} 个文件同步成功！')
        print('🎯 虎牙和斗鱼直播源已作为独立分类添加到文件末尾，URL 域名已统一替换（logo 地址保留原样）：')
        for key, info in stream_contents.items():
            if info['content']:
                print(f'   {info["name"]}: URL 域名 -> {info["new_domain"]}（logo 不替换）')
        exit(0)
    else:
        print(f'⚠️ 成功 {success_count}/{total_count} 个文件，请检查失败原因')
        exit(1)
