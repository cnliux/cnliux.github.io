class ChannelConverter {
    constructor() {
        this.channels = [];
        this.history = [];
        this.settings = {
            theme: 'auto',
            saveHistory: true,
            autoConvert: false,
            showNotifications: true,
            recommendCount: 3
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
                return this.parseM3U(content);
            case 'txt':
                return this.parseTXT(content);
            case 'csv':
                return this.parseCSV(content);
            case 'json':
                return this.parseJSON(content);
            default:
                throw new Error(`不支持的文件格式: ${extension}`);
        }
    }

    // 格式检测方法 ====================================================

    detectFormat(content) {
        const firstLine = content.split('\n')[0].trim();
        
        // 1. 检测M3U格式
        if (content.includes('#EXTM3U') || content.includes('#EXTINF')) {
            return 'm3u';
        }
        
        // 2. 检测JSON格式
        try {
            JSON.parse(firstLine);
            return 'json';
        } catch (e) {
            // 非JSON格式，继续检测
        }
        
        // 3. 检测CSV格式（带标题行）
        if (firstLine.match(/(name|名称|url|地址|group|分组|logo|图标)/i)) {
            return 'csv';
        }
        
        // 4. 检测带分组的TXT格式
        if (content.includes(',#genre#')) {
            return 'txt';
        }
        
        // 5. 检测简单TXT格式
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
                if (lines[i].trim().startsWith('#EXTINF:')) {
                    const name = lines[i].split(',')[1].trim();
                    const url = lines[i + 1]?.trim() || '';
                    
                    // 提取Logo和分组信息
                    const logoMatch = lines[i].match(/tvg-logo="([^"]*)"/);
                    const groupMatch = lines[i].match(/group-title="([^"]*)"/);
                    
                    const channel = {
                        name: name,
                        url: url.split('?')[0],
                        logo: logoMatch ? logoMatch[1] : '',
                        group: groupMatch ? groupMatch[1] : ''
                    };
                    
                    if (this.isValidUrl(channel.url)) {
                        channels.push(channel);
                    }
                    i += 2;
                } else {
                    i++;
                }
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
                        url: parts[1].split('?')[0],
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

    parseM3U(content) {
        // 清理和格式化M3U内容
        const cleanedChannels = this.cleanAndFormatContent(content);
        
        // 进一步处理清理后的频道列表
        return cleanedChannels.map(channel => {
            return {
                name: channel.name,
                url: channel.url,
                logo: channel.logo,
                group: channel.group
            };
        });
    }

    parseTXT(content) {
        // 清理和格式化TXT内容
        const cleanedChannels = this.cleanAndFormatContent(content);
        
        // 进一步处理清理后的频道列表
        return cleanedChannels.map(channel => {
            return {
                name: channel.name,
                url: channel.url,
                logo: channel.logo,
                group: channel.group
            };
        });
    }

    // 辅助方法 ========================================================

    deduplicateChannels(channels, strategy = 'url') {
        const seen = new Set();
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
        
        return channels.filter(channel => {
            const key = keyExtractor(channel);
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    groupChannels() {
        const groups = {};
        
        this.channels.forEach(channel => {
            const group = channel.group || '未分组';
            if (!groups[group]) {
                groups[group] = [];
            }
            groups[group].push(channel);
        });
        
        return groups;
    }

    // 转换输出方法 ====================================================

    convertToM3U(fieldOrder = ['name', 'url', 'logo', 'group']) {
        let m3u = '#EXTM3U\n';
        const groupedChannels = this.groupChannels();
        
        for (const group in groupedChannels) {
            // 添加分组注释（兼容#genre#）
            m3u += `#genre# ${group}\n`;
            
            groupedChannels[group].forEach(channel => {
                m3u += `#EXTINF:-1`;
                
                if (channel.logo) {
                    m3u += ` tvg-logo="${channel.logo}"`;
                }
                
                m3u += ` group-title="${group}",${channel.name}\n`;
                m3u += `${channel.url}\n`;
            });
        }
        
        return m3u;
    }

    convertToTXT(fieldOrder = ['name', 'url']) {
        let output = '';
        const groupedChannels = this.groupChannels();
        
        for (const group in groupedChannels) {
            // 添加分组标记
            if (group) {
                output += `${group},#genre#\n`;
            }
            
            // 添加频道
            groupedChannels[group].forEach(channel => {
                const parts = [];
                fieldOrder.forEach(field => {
                    switch (field) {
                        case 'name':
                            parts.push(channel.name);
                            break;
                        case 'url':
                            parts.push(channel.url);
                            break;
                    }
                });
                output += parts.join(',') + '\n';
            });
            
            // 分组间空行
            output += '\n';
        }
        
        return output.trim();
    }

    convertToCSV(fieldOrder = ['name', 'url', 'logo', 'group']) {
        const headers = {
            'name': '名称',
            'url': 'URL',
            'logo': 'Logo',
            'group': '分组'
        };
        
        // 构建CSV头
        const csvHeaders = fieldOrder.map(field => headers[field]).join(',');
        
        // 构建CSV行
        const csvRows = this.channels.map(channel => {
            return fieldOrder.map(field => {
                switch (field) {
                    case 'name': return `"${channel.name}"`;
                    case 'url': return `"${channel.url}"`;
                    case 'logo': return `"${channel.logo || ''}"`;
                    case 'group': return `"${channel.group || ''}"`;
                    default: return '';
                }
            }).join(',');
        });
        
        // 返回完整的CSV内容
        return [csvHeaders, ...csvRows].join('\n');
    }

    convertToJSON(fieldOrder = ['name', 'url', 'logo', 'group']) {
        return JSON.stringify(this.channels.map(channel => {
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

    convertToExcel(fieldOrder = ['name', 'url', 'logo', 'group']) {
        try {
            const data = this.channels.map(channel => {
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

    convertToXML(fieldOrder = ['name', 'url', 'logo', 'group']) {
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<channels>\n';
        
        this.channels.forEach(channel => {
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
        const savedSettings = localStorage.getItem('channelConverterSettings');
        if (savedSettings) {
            this.settings = JSON.parse(savedSettings);
        }
    }

    saveSettings() {
        localStorage.setItem('channelConverterSettings', JSON.stringify(this.settings));
    }

    loadHistory() {
        if (!this.settings.saveHistory) return;
        const savedHistory = localStorage.getItem('channelConverterHistory');
        if (savedHistory) {
            this.history = JSON.parse(savedHistory);
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

    clearHistory() {
        this.history = [];
        localStorage.removeItem('channelConverterHistory');
    }
}