class ChannelConverter {
    constructor() {
        this.channels = [];
        this.history = [];
        this.settings = {
            theme: 'black',
            saveHistory: true,
            autoConvert: false,
            showNotifications: true,
            recommendCount: 3,
            autoClearHistory: false,
            corsProxy: '',
            mergeMode: 'merge',
            autoRefresh: false,
            autoRefreshMin: 30,
            concurrency: 5,
            timeout: 10
        };
    }

    // 主解析方法 ======================================================

    parseFileContent(content, extension) {
        // 统一处理换行符
        content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        
        // 自动检测格式（如果未指定或auto）
        if (!extension || extension === 'auto') {
            extension = this.detectFormat(content);
        }

        switch (extension.toLowerCase()) {
            case 'm3u':
            case 'm3u8':
            case 'diyp':
                return this.parseM3U(content);
            case 'txt':
                return this.parseTXT(content);
            case 'csv':
                return this.parseCSV(content);
            case 'json':
                return this.parseJSON(content);
            case 'epg':
            case 'xmltv':
                return this.parseXMLTV(content);
            default:
                throw new Error(`不支持的文件格式: ${extension}`);
        }
    }

    // 格式检测方法 ====================================================

    detectFormat(content) {
        const trimmed = content.trim();
        const firstLine = trimmed.split('\n')[0].trim();

        // 1. 检测M3U格式
        if (content.includes('#EXTM3U') || content.includes('#EXTINF')) {
            return 'm3u';
        }

        // 2. 检测XMLTV/EPG格式
        if (trimmed.startsWith('<?xml') || (trimmed.startsWith('<') && content.includes('<channel'))) {
            return 'epg';
        }

        // 3. 检测JSON格式
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            return 'json';
        }
        try {
            JSON.parse(trimmed);
            return 'json';
        } catch (e) {
            // 非JSON格式，继续检测
        }

        // 4. 检测CSV格式（带标题行）
        if (firstLine.match(/(name|名称|url|地址|group|分组|logo|图标|icon)/i)) {
            return 'csv';
        }

        // 5. 检测带分组的TXT格式
        if (content.includes(',#genre#')) {
            return 'txt';
        }

        // 6. 检测简单TXT格式
        if (content.includes('http') && content.includes(',')) {
            return 'txt';
        }

        // 默认尝试TXT格式
        return 'txt';
    }

    isValidUrl(url) {
        const urlRegex = /^(http|https|rtmp|rtsp):\/\/[^\s/$.?#].[^\s]*$/i;
        return urlRegex.test(url);
    }

    // 清理和格式化内容
    cleanAndFormatContent(content) {
        // 1. 移除HTML标签
        content = content.replace(/<url[^>]*>(.*?)<\/url>/g, '$1');
        
        // 2. 提取频道信息
        const lines = content.split('\n');
        const channels = [];
        let currentGroup = '';
        let isM3U = content.includes('#EXTINF');
        
        // 使用逐行解析M3U格式
        if (isM3U) {
            let i = 0;
            while (i < lines.length) {
                const line = lines[i].trim();
                if (line.startsWith('#EXTINF:')) {
                    // 名称取最后一个逗号之后的内容，避免名称中含逗号
                    const commaIdx = line.lastIndexOf(',');
                    const name = commaIdx > -1 ? line.slice(commaIdx + 1).trim() : '';

                    // 找到下一个非注释行作为URL
                    let url = '';
                    for (let j = i + 1; j < lines.length; j++) {
                        const nextLine = lines[j].trim();
                        if (!nextLine || nextLine.startsWith('#')) continue;
                        url = nextLine;
                        i = j;
                        break;
                    }

                    // 提取Logo和分组信息
                    const logoMatch = line.match(/tvg-logo="([^"]*)"/);
                    const groupMatch = line.match(/group-title="([^"]*)"/);

                    const channel = {
                        name: name,
                        url: url,
                        logo: logoMatch ? logoMatch[1] : '',
                        group: groupMatch ? groupMatch[1] : ''
                    };

                    if (this.isValidUrl(channel.url)) {
                        channels.push(channel);
                    }
                }
                i++;
            }
        } else {
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                // 处理分组标记
                if (line.includes(',#genre#')) {
                    currentGroup = line.split(',#genre#')[0].trim();
                    continue;
                }

                // 处理TXT/CSV格式
                const parts = line.split(',').map(p => p.trim());
                if (parts.length >= 2) {
                    const channel = {
                        name: parts[0],
                        url: parts[1],
                        logo: parts.length > 2 ? parts[2] : '',
                        group: currentGroup || (parts.length > 3 ? parts[3] : '')
                    };

                    // 验证URL
                    if (this.isValidUrl(channel.url)) {
                        channels.push(channel);
                    }
                }
            }
        }
        
        return channels;
    }

    // 各格式解析器 ====================================================

    // M3U与TXT共用同一清理逻辑
    parseChannelList(content) {
        return this.cleanAndFormatContent(content);
    }

    parseM3U(content) {
        return this.parseChannelList(content);
    }

    parseTXT(content) {
        return this.parseChannelList(content);
    }

    // XMLTV / EPG 频道元数据解析（提取名称与图标）
    parseXMLTV(content) {
        const channels = [];
        const channelRegex = /<channel\b[^>]*>[\s\S]*?<\/channel>/g;
        let m;
        while ((m = channelRegex.exec(content)) !== null) {
            const block = m[0];
            const idMatch = block.match(/<channel\b[^>]*id="([^"]*)"/);
            const nameMatch = block.match(/<display-name[^>]*>([^<]*)<\/display-name>/);
            const iconMatch = block.match(/<icon\b[^>]*src="([^"]*)"/);
            const name = nameMatch ? nameMatch[1].trim() : (idMatch ? idMatch[1] : '');
            if (!name) continue;
            channels.push({
                name: name,
                url: '',
                logo: iconMatch ? iconMatch[1] : '',
                group: 'EPG'
            });
        }
        return channels;
    }

    parseCSV(content) {
        const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length === 0) return [];

        // 解析一行CSV（支持带引号的字段和字段内的逗号）
        const parseLine = (line) => {
            const result = [];
            let current = '';
            let inQuotes = false;

            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (inQuotes) {
                    if (char === '"') {
                        if (line[i + 1] === '"') {
                            current += '"';
                            i++;
                        } else {
                            inQuotes = false;
                        }
                    } else {
                        current += char;
                    }
                } else {
                    if (char === '"') {
                        inQuotes = true;
                    } else if (char === ',') {
                        result.push(current.trim());
                        current = '';
                    } else {
                        current += char;
                    }
                }
            }
            result.push(current.trim());
            return result;
        };

        const channels = [];
        let headerMap = null;

        // 检测表头
        const firstRow = parseLine(lines[0]);
        if (firstRow.some(h => /^(name|名称|url|地址|group|分组|logo|图标|icon)$/i.test(h))) {
            const headerNames = firstRow.map(h => h.toLowerCase());
            headerMap = {
                name: headerNames.findIndex(h => ['name', '名称'].includes(h)),
                url: headerNames.findIndex(h => ['url', '地址'].includes(h)),
                logo: headerNames.findIndex(h => ['logo', '图标', 'icon'].includes(h)),
                group: headerNames.findIndex(h => ['group', '分组'].includes(h))
            };
        }

        lines.forEach((line, lineIndex) => {
            if (headerMap && lineIndex === 0) return;
            const parts = parseLine(line);
            if (parts.length < 2) return;

            const get = (key, fallback) => {
                const idx = headerMap ? headerMap[key] : -1;
                return idx >= 0 ? (parts[idx] || '') : fallback;
            };

            let name, url, logo, group;
            if (headerMap) {
                name = get('name', '');
                url = get('url', '');
                logo = get('logo', '');
                group = get('group', '');
            } else {
                name = parts[0] || '';
                url = parts[1] || '';
                logo = parts[2] || '';
                group = parts[3] || '';
            }

            if (this.isValidUrl(url)) {
                channels.push({ name, url, logo, group });
            }
        });

        return channels;
    }

    parseJSON(content) {
        let data;
        try {
            data = JSON.parse(content);
        } catch (e) {
            // 尝试从文本中提取JSON数组
            const match = content.match(/\[[\s\S]*\]/);
            if (match) {
                data = JSON.parse(match[0]);
            } else {
                throw new Error('无效的JSON格式');
            }
        }

        // 统一为数组
        if (data && !Array.isArray(data) && Array.isArray(data.channels)) {
            data = data.channels;
        } else if (data && !Array.isArray(data) && typeof data === 'object') {
            data = [data];
        }

        if (!Array.isArray(data)) {
            throw new Error('JSON格式无效');
        }

        return data.map(item => {
            if (typeof item === 'string') {
                return { name: '', url: item, logo: '', group: '' };
            }
            return {
                name: item.name || item.title || item.channelName || item['频道名称'] || '',
                url: item.url || item.stream || item.link || item['播放地址'] || '',
                logo: item.logo || item.icon || item['图标'] || '',
                group: item.group || item.groupTitle || item.category || item['分组'] || ''
            };
        }).filter(channel => this.isValidUrl(channel.url));
    }

    // 辅助方法 ========================================================

    deduplicateChannels(channels, strategy = 'url') {
        const seen = new Map();
        let keyExtractor;
        
        switch (strategy) {
            case 'name':
                keyExtractor = channel => channel.name;
                break;
            case 'url':
                keyExtractor = channel => channel.url;
                break;
            case 'combined':
                keyExtractor = channel => `${channel.name}-${channel.url}`;
                break;
            default:
                keyExtractor = channel => channel.url;
        }
        
        // 信息更完整的条目优先保留（含logo/分组/可用状态）
        const richness = channel =>
            (channel.logo ? 2 : 0) +
            (channel.group ? 1 : 0) +
            (channel.status === 'success' ? 3 : channel.status === 'error' ? -2 : 0);
        
        const result = [];
        for (const channel of channels) {
            const key = keyExtractor(channel);
            if (seen.has(key)) {
                const idx = seen.get(key);
                if (richness(channel) > richness(result[idx])) {
                    result[idx] = channel;
                }
            } else {
                seen.set(key, result.length);
                result.push(channel);
            }
        }
        return result;
    }

    // 多源合并：append=追加, replace=替换, merge=按URL去重(base优先)
    mergeChannels(base, incoming, mode = 'merge') {
        if (mode === 'replace') return incoming.slice();
        if (mode === 'append') return base.concat(incoming);
        return this.deduplicateChannels(base.concat(incoming), 'url');
    }

    // 列表差异对比（按URL作为唯一标识）
    diffChannels(oldList, newList) {
        const key = c => c.url || `${c.name}`;
        const oldKeys = new Set(oldList.map(key));
        const newKeys = new Set(newList.map(key));
        const added = newList.filter(c => !oldKeys.has(key(c)));
        const removed = oldList.filter(c => !newKeys.has(key(c)));
        return { added, removed, addedCount: added.length, removedCount: removed.length };
    }

    // 分组可用率统计
    getStats() {
        const groupMap = {};
        this.channels.forEach(ch => {
            const g = ch.group || '未分组';
            if (!groupMap[g]) groupMap[g] = { group: g, total: 0, ok: 0, fail: 0, untested: 0 };
            const s = groupMap[g];
            s.total++;
            if (ch.status === 'success') s.ok++;
            else if (ch.status === 'error') s.fail++;
            else s.untested++;
        });
        return Object.values(groupMap).map(s => {
            s.okRate = s.total ? Math.round((s.ok / s.total) * 100) : 0;
            return s;
        });
    }

    groupChannels(list = this.channels) {
        const groups = {};
        
        list.forEach(channel => {
            const group = channel.group || '未分组';
            if (!groups[group]) {
                groups[group] = [];
            }
            groups[group].push(channel);
        });
        
        return groups;
    }

    // 转换输出方法 ====================================================

    convertToM3U(fieldOrder = ['name', 'url', 'logo', 'group'], list = this.channels) {
        let m3u = '#EXTM3U\n';
        const groupedChannels = this.groupChannels(list);
        
        for (const group in groupedChannels) {
            // 添加分组注释（兼容#genre#）
            m3u += `#genre# ${group}\n`;
            
            groupedChannels[group].forEach(channel => {
                m3u += `#EXTINF:-1`;
                
                if (channel.logo) {
                    m3u += ` tvg-logo="${this.escapeAttr(channel.logo)}"`;
                }
                
                m3u += ` group-title="${this.escapeAttr(group)}",${String(channel.name).replace(/"/g, '')}\n`;
                m3u += `${channel.url}\n`;
            });
        }
        
        return m3u;
    }

    escapeAttr(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    convertToTXT(fieldOrder = ['name', 'url'], list = this.channels) {
        // 标准TXT格式：分组用 ,#genre# 标记，每行仅 名称,URL（不含Logo/分组字段）
        let output = '';
        const groupedChannels = this.groupChannels(list);
        
        for (const group in groupedChannels) {
            // 添加分组标记
            if (group) {
                output += `${group},#genre#\n`;
            }
            
            // 添加频道（标准格式：名称,URL）
            groupedChannels[group].forEach(channel => {
                output += `${channel.name},${channel.url}\n`;
            });
            
            // 分组间空行
            output += '\n';
        }
        
        return output.trim();
    }

    convertToCSV(fieldOrder = ['name', 'url', 'logo', 'group'], list = this.channels) {
        const headers = {
            'name': '名称',
            'url': 'URL',
            'logo': 'Logo',
            'group': '分组'
        };
        
        // 构建CSV头
        const csvHeaders = fieldOrder.map(field => headers[field]).join(',');
        
        // 构建CSV行（转义引号）
        const csvEscape = (value) => `"${String(value || '').replace(/"/g, '""')}"`;
        
        const csvRows = list.map(channel => {
            return fieldOrder.map(field => {
                switch (field) {
                    case 'name': return csvEscape(channel.name);
                    case 'url': return csvEscape(channel.url);
                    case 'logo': return csvEscape(channel.logo);
                    case 'group': return csvEscape(channel.group);
                    default: return '';
                }
            }).join(',');
        });
        
        // 返回完整的CSV内容
        return [csvHeaders, ...csvRows].join('\n');
    }

    convertToJSON(fieldOrder = ['name', 'url', 'logo', 'group'], list = this.channels) {
        return JSON.stringify(list.map(channel => {
            const result = {};
            fieldOrder.forEach(field => {
                switch (field) {
                    case 'name': result.name = channel.name; break;
                    case 'url': result.url = channel.url; break;
                    case 'logo': result.logo = channel.logo || ''; break;
                    case 'group': result.group = channel.group || ''; break;
                }
            });
            return result;
        }), null, 2);
    }

    convertToExcel(fieldOrder = ['name', 'url', 'logo', 'group'], list = this.channels) {
        try {
            const data = list.map(channel => {
                const result = {};
                fieldOrder.forEach(field => {
                    switch (field) {
                        case 'name': result['名称'] = channel.name; break;
                        case 'url': result['URL'] = channel.url; break;
                        case 'logo': result['Logo'] = channel.logo || ''; break;
                        case 'group': result['分组'] = channel.group || ''; break;
                    }
                });
                return result;
            });
            
            const worksheet = XLSX.utils.json_to_sheet(data);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, '频道列表');
            XLSX.writeFile(workbook, '频道列表.xlsx');
            return true;
        } catch (error) {
            console.error('文件写入失败:', error);
            return false;
        }
    }

    convertToXML(fieldOrder = ['name', 'url', 'logo', 'group'], list = this.channels) {
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<channels>\n';
        
        list.forEach(channel => {
            xml += '  <channel>\n';
            fieldOrder.forEach(field => {
                const escapedValue = this.escapeXml(channel[field] || '');
                switch (field) {
                    case 'name':
                        xml += `    <name>${escapedValue}</name>\n`;
                        break;
                    case 'url':
                        xml += `    <url>${escapedValue}</url>\n`;
                        break;
                    case 'logo':
                        if (channel.logo) {
                            xml += `    <logo>${escapedValue}</logo>\n`;
                        }
                        break;
                    case 'group':
                        if (channel.group) {
                            xml += `    <group>${escapedValue}</group>\n`;
                        }
                        break;
                }
            });
            xml += '  </channel>\n';
        });
        
        xml += '</channels>';
        return xml;
    }

    escapeXml(str) {
        return str.replace(/[<>&'"]/g, match => {
            switch (match) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case '\'': return '&apos;';
                case '"': return '&quot;';
                default: return match;
            }
        });
    }

    // 设置和历史记录 ==================================================

    loadSettings() {
        const defaults = {
            theme: 'black',
            saveHistory: true,
            autoConvert: false,
            showNotifications: true,
            recommendCount: 3,
            autoClearHistory: false,
            corsProxy: '',
            mergeMode: 'merge',
            autoRefresh: false,
            autoRefreshMin: 30,
            concurrency: 5,
            timeout: 10
        };
        const savedSettings = localStorage.getItem('channelConverterSettings');
        if (savedSettings) {
            try {
                this.settings = Object.assign({}, defaults, JSON.parse(savedSettings));
            } catch (e) {
                this.settings = { ...defaults };
            }
        } else {
            this.settings = { ...defaults };
        }
    }

    saveSettings() {
        localStorage.setItem('channelConverterSettings', JSON.stringify(this.settings));
    }

    loadHistory() {
        if (!this.settings.saveHistory) return;
        if (this.settings.autoClearHistory) {
            this.history = [];
            return;
        }
        const savedHistory = localStorage.getItem('channelConverterHistory');
        if (savedHistory) {
            try {
                this.history = JSON.parse(savedHistory) || [];
            } catch (e) {
                this.history = [];
            }
        }
    }

    saveHistory() {
        if (!this.settings.saveHistory) return;
        // 限制历史记录数量
        if (this.history.length > 100) {
            this.history = this.history.slice(-100);
        }
        localStorage.setItem('channelConverterHistory', JSON.stringify(this.history));
    }

    addHistoryRecord(data, format) {
        if (!this.settings.saveHistory) return;
        const timestamp = new Date().toISOString();
        this.history.push({ timestamp, data, format });
        this.saveHistory();
    }

    getHistory() {
        // 供UI展示：补充显示友好的时间和大小字段
        return this.history.map(record => {
            const date = new Date(record.timestamp);
            return {
                format: record.format,
                time: isNaN(date.getTime()) ? '未知时间' : date.toLocaleString('zh-CN'),
                size: new Blob([record.data]).size,
                content: record.data
            };
        });
    }

    deleteHistoryRecord(index) {
        if (index >= 0 && index < this.history.length) {
            this.history.splice(index, 1);
            this.saveHistory();
        }
    }

    clearHistory() {
        this.history = [];
        localStorage.removeItem('channelConverterHistory');
    }
}