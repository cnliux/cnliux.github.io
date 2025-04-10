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
        if (firstLine.startsWith('#EXTM3U') || content.includes('#EXTINF')) {
            return 'm3u';
        }
        
        // 2. 检测JSON格式
        if (firstLine.startsWith('{') || firstLine.startsWith('[')) {
            return 'json';
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
        return /^(http|https|rtmp|rtsp):\/\//i.test(url);
    }

    // 各格式解析器 ====================================================

    parseM3U(content) {
        const lines = content.split('\n');
        const channels = [];
        let currentChannel = {};
        let currentGroup = '';
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            // 支持自定义分组标记（兼容#genre#）
            if (line.startsWith('#genre#')) {
                currentGroup = line.substring(7).trim();
                continue;
            }
            
            if (line.startsWith('#EXTINF:')) {
                // 解析EXTINF行
                const extinf = line.substring(8);
                const commaIndex = extinf.indexOf(',');
                const params = commaIndex !== -1 ? extinf.substring(0, commaIndex) : extinf;
                const name = commaIndex !== -1 ? extinf.substring(commaIndex + 1).trim() : '未知频道';
                
                currentChannel = {
                    name: name,
                    url: '',
                    logo: '',
                    group: currentGroup || ''
                };
                
                // 解析参数
                const paramRegex = /([a-z-]+)="([^"]*)"/g;
                let match;
                while ((match = paramRegex.exec(params)) !== null) {
                    const key = match[1];
                    const value = match[2];
                    
                    if (key === 'tvg-logo') {
                        currentChannel.logo = value;
                    } else if (key === 'group-title') {
                        currentChannel.group = value || currentGroup;
                    }
                }
            } else if (line && !line.startsWith('#') && currentChannel.name) {
                // 这是URL行
                currentChannel.url = line.trim();
                if (this.isValidUrl(currentChannel.url)) {
                    channels.push(currentChannel);
                }
                currentChannel = {};
            }
        }
        
        return channels;
    }

    parseTXT(content) {
        const lines = content.split('\n');
        const channels = [];
        let currentGroup = '';
        let lineNumber = 0;
        
        for (const line of lines) {
            lineNumber++;
            const trimmed = line.trim();
            if (!trimmed) continue;
            
            // 处理分组标记
            if (trimmed.includes(',#genre#')) {
                currentGroup = trimmed.split(',#genre#')[0].trim();
                continue;
            }
            
            // 跳过注释行（非M3U注释）
            if (trimmed.startsWith('#') && !trimmed.startsWith('#EXT')) {
                continue;
            }
            
            // 处理频道行（支持多种分隔符）
            const separator = line.includes('|') ? '|' : 
                             line.includes('\t') ? '\t' : ',';
            const parts = trimmed.split(separator).map(p => p.trim());
            
            if (parts.length >= 2) {
                const channel = {
                    name: parts[0],
                    url: parts[1],
                    logo: parts[2] || '',
                    group: currentGroup || parts[3] || ''
                };
                
                // 验证URL
                if (this.isValidUrl(channel.url)) {
                    channels.push(channel);
                } else {
                    console.warn(`第${lineNumber}行: 无效URL被跳过 - ${channel.url}`);
                }
            } else {
                console.warn(`第${lineNumber}行: 格式不正确被跳过 - ${line}`);
            }
        }
        
        return channels;
    }

    parseCSV(content) {
        try {
            // 尝试使用XLSX库解析
            const workbook = XLSX.read(content, { type: 'string' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet);
            
            return jsonData.map(row => ({
                name: row['名称'] || row['name'] || row['Name'] || '',
                url: row['URL'] || row['url'] || row['Url'] || '',
                logo: row['Logo'] || row['logo'] || '',
                group: row['分组'] || row['group'] || row['Group'] || ''
            })).filter(channel => this.isValidUrl(channel.url));
        } catch (error) {
            // 如果XLSX解析失败，尝试用普通CSV解析
            const lines = content.split('\n');
            if (lines.length < 2) return [];
            
            const channels = [];
            const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
            
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',');
                if (values.length < 2) continue;
                
                const channel = {};
                for (let j = 0; j < headers.length; j++) {
                    if (headers[j] === 'name' || headers[j] === '名称') {
                        channel.name = values[j] ? values[j].trim() : '';
                    } else if (headers[j] === 'url') {
                        channel.url = values[j] ? values[j].trim() : '';
                    } else if (headers[j] === 'logo') {
                        channel.logo = values[j] ? values[j].trim() : '';
                    } else if (headers[j] === 'group' || headers[j] === '分组') {
                        channel.group = values[j] ? values[j].trim() : '';
                    }
                }
                
                if (channel.name && this.isValidUrl(channel.url)) {
                    channels.push(channel);
                }
            }
            
            return channels;
        }
    }

    parseJSON(content) {
        try {
            const data = JSON.parse(content);
            
            if (Array.isArray(data)) {
                return data.map(item => ({
                    name: item.name || item.Name || item.title || '',
                    url: item.url || item.Url || item.link || '',
                    logo: item.logo || item.Logo || item.image || '',
                    group: item.group || item.Group || item.category || ''
                })).filter(channel => this.isValidUrl(channel.url));
            } else {
                // 尝试解析为对象格式
                const channels = [];
                for (const group in data) {
                    if (Array.isArray(data[group])) {
                        data[group].forEach(channel => {
                            const validChannel = {
                                name: channel.name || channel.Name || channel.title || '',
                                url: channel.url || channel.Url || channel.link || '',
                                logo: channel.logo || channel.Logo || channel.image || '',
                                group: group
                            };
                            if (this.isValidUrl(validChannel.url)) {
                                channels.push(validChannel);
                            }
                        });
                    }
                }
                return channels;
            }
        } catch (error) {
            throw new Error('无效的JSON格式: ' + error.message);
        }
    }

    // 辅助方法 ========================================================

    deduplicateChannels(channels) {
        const urlMap = new Map();
        const nameMap = new Map();
        
        return channels.filter(channel => {
            // 同时检查URL和名称去重
            if (!urlMap.has(channel.url) && !nameMap.has(channel.name)) {
                urlMap.set(channel.url, true);
                nameMap.set(channel.name, true);
                return true;
            }
            return false;
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

    convertToTXT(fieldOrder = ['name', 'url', 'logo', 'group']) {
        let output = '';
        const groupedChannels = this.groupChannels();
        
        for (const group in groupedChannels) {
            // 添加分组标记
            if (group) {
                output += `${group},#genre#\n`;
            }
            
            // 添加频道
            groupedChannels[group].forEach(channel => {
                let line = '';
                fieldOrder.forEach(field => {
                    if (field === 'name') line += `${channel.name},`;
                    if (field === 'url') line += `${channel.url},`;
                    if (field === 'logo') line += `${channel.logo || ''},`;
                    if (field === 'group') line += `${channel.group || ''},`;
                });
                output += line.slice(0, -1) + '\n';
            });
            
            // 分组间空行
            output += '\n';
        }
        
        return output.trim();
    }

    convertToCSV(fieldOrder = ['name', 'url', 'logo', 'group']) {
        const headers = fieldOrder.map(field => {
            switch (field) {
                case 'name': return '名称';
                case 'url': return 'URL';
                case 'logo': return 'Logo';
                case 'group': return '分组';
                default: return field;
            }
        });
        
        const rows = this.channels.map(channel => {
            return fieldOrder.map(field => {
                switch (field) {
                    case 'name': return channel.name;
                    case 'url': return channel.url;
                    case 'logo': return channel.logo || '';
                    case 'group': return channel.group || '';
                    default: return '';
                }
            });
        });
        
        return [headers.join(',')].concat(rows.map(row => row.join(','))).join('\n');
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
    }

    convertToXML(fieldOrder = ['name', 'url', 'logo', 'group']) {
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<channels>\n';
        
        this.channels.forEach(channel => {
            xml += '  <channel>\n';
            fieldOrder.forEach(field => {
                switch (field) {
                    case 'name':
                        xml += `    <name>${Utils.escapeXml(channel.name)}</name>\n`;
                        break;
                    case 'url':
                        xml += `    <url>${Utils.escapeXml(channel.url)}</url>\n`;
                        break;
                    case 'logo':
                        if (channel.logo) {
                            xml += `    <logo>${Utils.escapeXml(channel.logo)}</logo>\n`;
                        }
                        break;
                    case 'group':
                        if (channel.group) {
                            xml += `    <group>${Utils.escapeXml(channel.group)}</group>\n`;
                        }
                        break;
                }
            });
            xml += '  </channel>\n';
        });
        
        xml += '</channels>';
        return xml;
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