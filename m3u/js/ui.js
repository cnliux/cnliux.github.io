class UIHandler {
    constructor(core) {
        this.core = core;
        this.elements = {
            dropArea: document.getElementById('dropArea'),
            fileInput: document.getElementById('fileInput'),
            selectFilesBtn: document.getElementById('selectFilesBtn'),
            fileList: document.getElementById('fileList'),
            outputFormat: document.getElementById('outputFormat'),
            fieldOrder: document.getElementById('fieldOrder'),
            customOrderContainer: document.getElementById('customOrderContainer'),
            customOrderFields: document.getElementById('customOrderFields'),
            outputText: document.getElementById('outputText'),
            copyBtn: document.getElementById('copyBtn'),
            downloadBtn: document.getElementById('downloadBtn'),
            convertBtn: document.getElementById('convertBtn'),
            clearBtn: document.getElementById('clearBtn'),
            channelSearch: document.getElementById('channelSearch'),
            channelList: document.getElementById('channelList'),
            deleteSelectedBtn: document.getElementById('deleteSelectedBtn'),
            testAllBtn: document.getElementById('testAllBtn'),
            totalChannels: document.getElementById('totalChannels'),
            groupCount: document.getElementById('groupCount'),
            groupChart: document.getElementById('groupChart'),
            historyList: document.getElementById('historyList'),
            settingsBtn: document.getElementById('settingsBtn'),
            settingsPanel: document.getElementById('settingsPanel'),
            settingsOverlay: document.getElementById('settingsOverlay'),
            closeSettings: document.getElementById('closeSettings'),
            themePref: document.getElementById('themePref'),
            saveHistory: document.getElementById('saveHistory'),
            autoConvert: document.getElementById('autoConvert'),
            showNotifications: document.getElementById('showNotifications'),
            recommendCount: document.getElementById('recommendCount'),
            clearAllHistory: document.getElementById('clearAllHistory'),
            toast: document.getElementById('toast'),
            tabs: document.querySelectorAll('.tab'),
            tabContents: document.querySelectorAll('.tab-content'),
            deduplicate: document.getElementById('deduplicate'),
            textInput: document.getElementById('textInput'),
            parseTextBtn: document.getElementById('parseTextBtn'),
            autoClearHistory: document.getElementById('autoClearHistory')
        };
    }

    // 初始化事件监听
    initEventListeners() {
        // 拖放区域事件
        this.elements.dropArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.elements.dropArea.classList.add('highlight');
        });

        this.elements.dropArea.addEventListener('dragleave', () => {
            this.elements.dropArea.classList.remove('highlight');
        });

        this.elements.dropArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.elements.dropArea.classList.remove('highlight');
            if (e.dataTransfer.files.length > 0) {
                this.handleFiles(e.dataTransfer.files);
            }
        });

        // 选择文件按钮
        this.elements.selectFilesBtn.addEventListener('click', () => {
            this.elements.fileInput.click();
        });

        this.elements.fileInput.addEventListener('change', () => {
            if (this.elements.fileInput.files.length > 0) {
                this.handleFiles(this.elements.fileInput.files);
            }
        });

        // 字段顺序选择
        this.elements.fieldOrder.addEventListener('change', () => {
            if (this.elements.fieldOrder.value === 'custom') {
                this.elements.customOrderContainer.classList.remove('hidden');
                this.renderCustomOrderFields();
            } else {
                this.elements.customOrderContainer.classList.add('hidden');
            }
        });

        // 复制按钮
        this.elements.copyBtn.addEventListener('click', () => {
            Utils.copyToClipboard(this.elements.outputText.value);
            this.showToast('已复制到剪贴板', 'success');
        });

        // 下载按钮
        this.elements.downloadBtn.addEventListener('click', () => {
            this.downloadResult();
        });

        // 转换按钮
        this.elements.convertBtn.addEventListener('click', () => {
            this.convertChannels();
        });

        // 清空按钮
        this.elements.clearBtn.addEventListener('click', () => {
            this.clearAll();
        });

        // 频道搜索
        this.elements.channelSearch.addEventListener('input', () => {
            this.renderChannelList();
        });

        // 删除选中按钮
        this.elements.deleteSelectedBtn.addEventListener('click', () => {
            this.deleteSelectedChannels();
        });

        // 测试所有URL按钮
        this.elements.testAllBtn.addEventListener('click', () => {
            this.testAllUrls();
        });

        // 标签页切换
        this.elements.tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchTab(tab.getAttribute('data-tab'));
            });
        });

        // 设置按钮
        this.elements.settingsBtn.addEventListener('click', () => {
            this.elements.settingsPanel.classList.add('open');
            this.elements.settingsOverlay.classList.add('open');
            this.applySettings();
        });

        // 关闭设置
        this.elements.closeSettings.addEventListener('click', () => {
            this.elements.settingsPanel.classList.remove('open');
            this.elements.settingsOverlay.classList.remove('open');
        });

        this.elements.settingsOverlay.addEventListener('click', () => {
            this.elements.settingsPanel.classList.remove('open');
            this.elements.settingsOverlay.classList.remove('open');
        });

        // 设置表单
        this.elements.themePref.addEventListener('change', () => {
            this.core.settings.theme = this.elements.themePref.value;
            this.core.saveSettings();
            this.applyTheme();
        });

        this.elements.saveHistory.addEventListener('change', () => {
            this.core.settings.saveHistory = this.elements.saveHistory.checked;
            this.core.saveSettings();
        });

        this.elements.autoConvert.addEventListener('change', () => {
            this.core.settings.autoConvert = this.elements.autoConvert.checked;
            this.core.saveSettings();
        });

        this.elements.showNotifications.addEventListener('change', () => {
            this.core.settings.showNotifications = this.elements.showNotifications.checked;
            this.core.saveSettings();
        });

        this.elements.recommendCount.addEventListener('change', () => {
            this.core.settings.recommendCount = parseInt(this.elements.recommendCount.value);
            this.core.saveSettings();
        });

        this.elements.autoClearHistory.addEventListener('change', () => {
            this.core.settings.autoClearHistory = this.elements.autoClearHistory.checked;
            this.core.saveSettings();
        });

        // 清除历史记录
        this.elements.clearAllHistory.addEventListener('click', () => {
            this.core.clearHistory();
            this.renderHistory();
            this.showToast('历史记录已清除', 'success');
        });

        // 解析文本按钮
        this.elements.parseTextBtn.addEventListener('click', () => {
            this.parseText();
        });

        // 应用初始设置
        this.applySettings();
    }

    // 应用设置到UI
    applySettings() {
        this.elements.themePref.value = this.core.settings.theme;
        this.elements.saveHistory.checked = this.core.settings.saveHistory;
        this.elements.autoConvert.checked = this.core.settings.autoConvert;
        this.elements.showNotifications.checked = this.core.settings.showNotifications;
        this.elements.recommendCount.value = this.core.settings.recommendCount;
        this.elements.autoClearHistory.checked = this.core.settings.autoClearHistory;
        
        this.applyTheme();
    }

    // 应用主题
    applyTheme() {
        if (this.core.settings.theme === 'auto') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.body.classList.toggle('dark-mode', prefersDark);
        } else {
            document.body.classList.toggle('dark-mode', this.core.settings.theme === 'dark');
        }
    }

    // 处理文件
    handleFiles(files) {
        const currentFiles = Array.from(files);
        this.renderFileList(currentFiles);

        if (this.core.settings.autoConvert) {
            this.parseAllFiles(currentFiles);
        }
    }

    // 渲染文件列表
    renderFileList(files) {
        this.elements.fileList.innerHTML = '';
        
        if (files.length === 0) {
            this.elements.fileList.innerHTML = '<p class="text-muted">没有选择文件</p>';
            return;
        }
        
        const list = document.createElement('ul');
        list.className = 'file-list';
        
        files.forEach((file, index) => {
            const item = document.createElement('li');
            item.className = 'flex flex-between';
            
            const fileInfo = document.createElement('div');
            fileInfo.textContent = `${file.name} (${Utils.formatFileSize(file.size)})`;
            
            const removeBtn = document.createElement('button');
            removeBtn.className = 'btn btn-danger';
            removeBtn.textContent = '移除';
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                files.splice(index, 1);
                this.renderFileList(files);
            });
            
            item.appendChild(fileInfo);
            item.appendChild(removeBtn);
            list.appendChild(item);
        });
        
        this.elements.fileList.appendChild(list);
        
        if (!this.core.settings.autoConvert) {
            const parseBtn = document.createElement('button');
            parseBtn.className = 'btn btn-secondary mt-10';
            parseBtn.textContent = '解析文件';
            parseBtn.addEventListener('click', () => this.parseAllFiles(files));
            this.elements.fileList.appendChild(parseBtn);
        }
    }

    // 解析所有文件
    parseAllFiles(files) {
        if (files.length === 0) {
            this.showToast('没有选择文件', 'warning');
            return;
        }
        
        this.showToast('开始解析文件...', 'success');
        
        let parsedChannels = [];
        let filesProcessed = 0;
        
        files.forEach(file => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                const content = e.target.result;
                const extension = file.name.split('.').pop().toLowerCase();
                
                try {
                    const fileChannels = this.core.parseFileContent(content, extension);
                    parsedChannels = parsedChannels.concat(fileChannels);
                    filesProcessed++;
                    
                    if (filesProcessed === files.length) {
                        this.core.channels = this.elements.deduplicate.checked ? 
                            this.core.deduplicateChannels(parsedChannels) : parsedChannels;
                        this.renderChannelList();
                        this.updateStats();
                        
                        if (this.core.settings.autoConvert) {
                            this.convertChannels();
                        }
                        
                        this.showToast(`成功解析 ${filesProcessed} 个文件，共 ${this.core.channels.length} 个频道`, 'success');
                    }
                } catch (error) {
                    filesProcessed++;
                    this.showToast(`解析文件 ${file.name} 时出错: ${error.message}`, 'error');
                }
            };
            
            reader.onerror = () => {
                filesProcessed++;
                this.showToast(`读取文件 ${file.name} 时出错`, 'error');
            };
            
            reader.readAsText(file);
        });
    }

    // 解析文本
    parseText() {
        const text = this.elements.textInput.value.trim();
        if (!text) {
            this.showToast('请输入文本内容', 'warning');
            return;
        }
        
        // 尝试判断文本格式
        let extension;
        
        if (text.startsWith('#EXTM3U') || text.includes('#EXTINF')) {
            extension = 'm3u';
        } else if (text.includes('.m3u8')) {
            extension = 'm3u8';
        } else if (text.includes(',#genre#')) {
            extension = 'txt';
        } else if (text.includes('http') && text.includes(',')) {
            extension = 'txt';
        } else if (text.includes('name,') || text.includes('url,') || text.includes('group,') || text.includes('logo,')) {
            extension = 'csv';
        } else if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
            extension = 'json';
        } else {
            extension = 'txt';
        }
        
        try {
            const parsedChannels = this.core.parseFileContent(text, extension);
            this.core.channels = this.elements.deduplicate.checked ? 
                this.core.deduplicateChannels(parsedChannels) : parsedChannels;
            this.renderChannelList();
            this.updateStats();
            
            if (this.core.settings.autoConvert) {
                this.convertChannels();
            }
            
            this.showToast(`成功解析文本，共 ${this.core.channels.length} 个频道`, 'success');
        } catch (error) {
            this.showToast(`解析文本时出错: ${error.message}`, 'error');
        }
    }

    // 截断过长的文本
    truncateText(text, maxLength) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    // 渲染频道列表
    renderChannelList() {
        this.elements.channelList.innerHTML = '';
        
        if (this.core.channels.length === 0) {
            this.elements.channelList.innerHTML = '<tr><td colspan="6" class="text-center text-muted">没有频道数据</td></tr>';
            return;
        }
        
        const searchTerm = this.elements.channelSearch.value.toLowerCase();
        const filteredChannels = searchTerm 
            ? this.core.channels.filter(c => 
                c.name.toLowerCase().includes(searchTerm) || 
                c.url.toLowerCase().includes(searchTerm) ||
                (c.logo && c.logo.toLowerCase().includes(searchTerm)) ||
                (c.group && c.group.toLowerCase().includes(searchTerm))
            )
            : this.core.channels;
        
        if (filteredChannels.length === 0) {
            this.elements.channelList.innerHTML = '<tr><td colspan="6" class="text-center text-muted">没有匹配的频道</td></tr>';
            return;
        }

        // 创建表头
        const headerRow = document.createElement('tr');

        // 全选列
        const selectAllCell = document.createElement('th');
        selectAllCell.style.width = '30px';
        const selectAllCheckbox = document.createElement('input');
        selectAllCheckbox.type = 'checkbox';
        selectAllCheckbox.id = 'selectAll';
        selectAllCheckbox.addEventListener('change', (e) => {
            const checkboxes = document.querySelectorAll('.channel-checkbox');
            checkboxes.forEach(cb => {
                cb.checked = e.target.checked;
            });
        });
        selectAllCell.appendChild(selectAllCheckbox);
        headerRow.appendChild(selectAllCell);

        // 其他表头列
        ['名称', 'URL', 'Logo', '分组', '状态', '操作'].forEach(text => {
            const th = document.createElement('th');
            th.textContent = text;
            headerRow.appendChild(th);
        });

        this.elements.channelList.appendChild(headerRow);

        // 创建频道行
        filteredChannels.forEach((channel, index) => {
            const row = document.createElement('tr');
            
            // 名称列
            const nameCell = document.createElement('td');
            const nameCheckbox = document.createElement('input');
            nameCheckbox.type = 'checkbox';
            nameCheckbox.className = 'form-check-input channel-checkbox'; // 添加统一类名
            nameCheckbox.dataset.index = index;
            nameCell.appendChild(nameCheckbox);
            
            // 截断名称并显示省略号
            const truncatedName = this.truncateText(channel.name || '未命名', 30);
            nameCell.appendChild(document.createTextNode(' ' + truncatedName));
            row.appendChild(nameCell);
            
            // URL列
            const urlCell = document.createElement('td');
            if (channel.url) {
                const urlLink = document.createElement('a');
                urlLink.href = channel.url;
                urlLink.textContent = channel.url.length > 30 ? channel.url.substring(0, 30) + '...' : channel.url;
                urlLink.target = '_blank';
                urlLink.rel = 'noopener noreferrer';
                urlCell.appendChild(urlLink);
            }
            row.appendChild(urlCell);
            
            // Logo列
            const logoCell = document.createElement('td');
            if (channel.logo) {
                const logoImg = document.createElement('img');
                logoImg.src = channel.logo;
                logoImg.className = 'channel-logo';
                logoImg.alt = channel.name + ' logo';
                logoImg.onerror = () => {
                    logoImg.style.display = 'none';
                };
                logoCell.appendChild(logoImg);
            }
            row.appendChild(logoCell);
            
            // 分组列
            const groupCell = document.createElement('td');
            groupCell.textContent = channel.group || '未分组';
            row.appendChild(groupCell);
            
            // 状态列
            const statusCell = document.createElement('td');
            if (channel.status === 'success') {
                statusCell.innerHTML = '<span class="status-indicator status-success"></span>可用';
            } else if (channel.status === 'error') {
                statusCell.innerHTML = '<span class="status-indicator status-error"></span>不可用';
            } else if (channel.status === 'testing') {
                statusCell.innerHTML = '<span class="status-indicator status-warning"></span>测试中...';
            } else {
                statusCell.innerHTML = '<span class="status-indicator status-warning"></span>未测试';
            }
            row.appendChild(statusCell);
            
            // 操作列
            const actionCell = document.createElement('td');
            actionCell.className = 'flex flex-wrap';
            
            const testBtn = document.createElement('button');
            testBtn.className = 'btn btn-secondary btn-sm';
            testBtn.textContent = '测试';
            testBtn.addEventListener('click', () => this.testUrl(index));
            actionCell.appendChild(testBtn);
            
            actionCell.appendChild(document.createTextNode(' '));
            
            const editBtn = document.createElement('button');
            editBtn.className = 'btn btn-secondary btn-sm';
            editBtn.textContent = '编辑';
            editBtn.addEventListener('click', () => this.editChannel(index));
            actionCell.appendChild(editBtn);
            
            actionCell.appendChild(document.createTextNode(' '));
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn btn-danger btn-sm';
            deleteBtn.textContent = '删除';
            deleteBtn.addEventListener('click', () => this.deleteChannel(index));
            actionCell.appendChild(deleteBtn);
            
            row.appendChild(actionCell);
            
            this.elements.channelList.appendChild(row);
        });
    }

    // 测试URL
    testUrl(index) {
        const channel = this.core.channels[index];
        if (!channel || !channel.url) return;
        
        // 标记为测试中
        channel.status = 'testing';
        this.renderChannelList();
        
        // 使用fetch测试URL
        fetch(channel.url, {
            method: 'HEAD',
            mode: 'no-cors',
            cache: 'no-cache'
        })
        .then(() => {
            channel.status = 'success';
            this.showToast(`${channel.name} 可用`, 'success');
        })
        .catch(() => {
            // 如果HEAD请求失败，尝试GET请求
            fetch(channel.url, {
                method: 'GET',
                mode: 'no-cors',
                cache: 'no-cache'
            })
            .then(() => {
                channel.status = 'success';
                this.showToast(`${channel.name} 可用`, 'success');
            })
            .catch(() => {
                channel.status = 'error';
                this.showToast(`${channel.name} 不可用`, 'error');
            });
        })
        .finally(() => {
            this.renderChannelList();
        });
    }

    // 测试所有URL
    testAllUrls() {
        if (this.core.channels.length === 0) {
            this.showToast('没有频道可测试', 'warning');
            return;
        }
        
        this.showToast('开始测试所有URL...', 'success');
        
        let testedCount = 0;
        const total = this.core.channels.length;
        
        this.core.channels.forEach((channel, index) => {
            setTimeout(() => {
                this.testUrl(index);
                testedCount++;
                
                if (testedCount === total) {
                    this.showToast('所有URL测试完成', 'success');
                }
            }, index * 1000); // 间隔1秒，避免请求过于频繁
        });
    }

    // 编辑频道
    editChannel(index) {
        const channel = this.core.channels[index];
        if (!channel) return;
        
        // 创建一个简单的模态对话框
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
        modal.style.display = 'flex';
        modal.style.justifyContent = 'center';
        modal.style.alignItems = 'center';
        modal.style.zIndex = '1000';
        
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        modalContent.style.backgroundColor = 'var(--bg-color)';
        modalContent.style.padding = '20px';
        modalContent.style.borderRadius = '5px';
        modalContent.style.width = '80%';
        modalContent.style.maxWidth = '500px';
        
        modalContent.innerHTML = `
            <h3>编辑频道</h3>
            <div class="form-group">
                <label for="edit-name" class="form-label">名称</label>
                <input type="text" id="edit-name" class="form-control" value="${channel.name || ''}">
            </div>
            <div class="form-group">
                <label for="edit-url" class="form-label">URL</label>
                <input type="text" id="edit-url" class="form-control" value="${channel.url || ''}">
            </div>
            <div class="form-group">
                <label for="edit-logo" class="form-label">Logo URL</label>
                <input type="text" id="edit-logo" class="form-control" value="${channel.logo || ''}">
            </div>
            <div class="form-group">
                <label for="edit-group" class="form-label">分组</label>
                <input type="text" id="edit-group" class="form-control" value="${channel.group || ''}">
            </div>
            <div class="flex flex-between mt-20">
                <button id="cancel-edit" class="btn btn-danger">取消</button>
                <button id="save-edit" class="btn btn-primary">保存</button>
            </div>
        `;
        
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        
        // 保存编辑
        document.getElementById('save-edit').addEventListener('click', () => {
            this.core.channels[index] = {
                name: document.getElementById('edit-name').value.trim(),
                url: document.getElementById('edit-url').value.trim(),
                logo: document.getElementById('edit-logo').value.trim(),
                group: document.getElementById('edit-group').value.trim(),
                status: channel.status
            };
            
            document.body.removeChild(modal);
            this.renderChannelList();
            this.updateStats();
            this.showToast('频道已更新', 'success');
        });
        
        // 取消编辑
        document.getElementById('cancel-edit').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        // 点击外部关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    // 删除频道
    deleteChannel(index) {
        if (confirm('确定要删除这个频道吗？')) {
            this.core.channels.splice(index, 1);
            this.renderChannelList();
            this.updateStats();
            this.showToast('频道已删除', 'success');
        }
    }

    // 删除选中频道
    deleteSelectedChannels() {
        const checkboxes = document.querySelectorAll('#channelList input[type="checkbox"]:checked');
        if (checkboxes.length === 0) {
            this.showToast('没有选中任何频道', 'warning');
            return;
        }
        
        if (confirm(`确定要删除选中的 ${checkboxes.length} 个频道吗？`)) {
            // 从后往前删除，避免索引问题
            const indices = Array.from(checkboxes).map(cb => parseInt(cb.dataset.index)).sort((a, b) => b - a);
            
            indices.forEach(index => {
                this.core.channels.splice(index, 1);
            });
            
            this.renderChannelList();
            this.updateStats();
            this.showToast(`已删除 ${indices.length} 个频道`, 'success');
        }
    }

    // 渲染自定义顺序字段
    renderCustomOrderFields() {
        this.elements.customOrderFields.innerHTML = '';
        
        const fields = ['name', 'url', 'logo', 'group'];
        
        fields.forEach(field => {
            const chip = document.createElement('span');
            chip.className = 'chip';
            chip.textContent = {
                'name': '名称',
                'url': 'URL',
                'logo': 'Logo',
                'group': '分组'
            }[field];
            chip.dataset.field = field;
            chip.draggable = true;
            
            chip.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', field);
                chip.classList.add('dragging');
            });
            
            chip.addEventListener('dragend', () => {
                chip.classList.remove('dragging');
            });
            
            this.elements.customOrderFields.appendChild(chip);
        });
        
        // 设置拖放区域
        this.elements.customOrderFields.addEventListener('dragover', (e) => {
            e.preventDefault();
            const dragging = document.querySelector('.chip.dragging');
            const afterElement = this.getDragAfterElement(this.elements.customOrderFields, e.clientY);
            
            if (afterElement == null) {
                this.elements.customOrderFields.appendChild(dragging);
            } else {
                this.elements.customOrderFields.insertBefore(dragging, afterElement);
            }
        });
    }

    // 获取拖放后的元素
    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.chip:not(.dragging)')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    // 转换频道
    convertChannels() {
        if (this.core.channels.length === 0) {
            this.showToast('没有频道数据', 'warning');
            return;
        }
        
        const format = this.elements.outputFormat.value;
        const fieldOrder = this.getFieldOrder();
        let result;
        
        try {
            switch (format) {
                case 'm3u':
                    result = this.core.convertToM3U(fieldOrder);
                    break;
                case 'txt':
                    result = this.core.convertToTXT(fieldOrder);
                    break;
                case 'csv':
                    result = this.core.convertToCSV(fieldOrder);
                    break;
                case 'json':
                    result = this.core.convertToJSON(fieldOrder);
                    break;
                case 'excel':
                    this.core.convertToExcel(fieldOrder);
                    this.showToast('Excel文件已生成', 'success');
                    return;
                case 'xml':
                    result = this.core.convertToXML(fieldOrder);
                    break;
                default:
                    result = '不支持的输出格式';
            }
            
            this.elements.outputText.value = result;
            this.core.addHistoryRecord(result, format);
            this.showToast('转换完成', 'success');
        } catch (error) {
            this.showToast(`转换时出错: ${error.message}`, 'error');
        }
    }

    // 获取字段顺序
    getFieldOrder() {
        const orderType = this.elements.fieldOrder.value;
        
        switch (orderType) {
            case 'default':
                return ['name', 'url', 'logo', 'group'];
            case 'groupFirst':
                return ['group', 'name', 'url', 'logo'];
            case 'urlFirst':
                return ['url', 'name', 'logo', 'group'];
            case 'logoFirst':
                return ['logo', 'name', 'url', 'group'];
            case 'custom':
                return this.getCustomFieldOrder();
            default:
                return ['name', 'url', 'logo', 'group'];
        }
    }

    // 获取自定义字段顺序
    getCustomFieldOrder() {
        const fields = [];
        const chips = this.elements.customOrderFields.querySelectorAll('.chip');
        
        chips.forEach(chip => {
            const field = chip.dataset.field;
            const checkbox = document.getElementById(`field-${field}`);
            
            if (checkbox && checkbox.checked) {
                fields.push(field);
            }
        });
        
        return fields.length > 0 ? fields : ['name', 'url', 'logo', 'group'];
    }

    // 下载结果
    downloadResult() {
        if (!this.elements.outputText.value) {
            this.showToast('没有内容可下载', 'warning');
            return;
        }
        
        const format = this.elements.outputFormat.value;
        let mimeType, extension;
        
        switch (format) {
            case 'm3u':
                mimeType = 'audio/x-mpegurl';
                extension = 'm3u';
                break;
            case 'txt':
                mimeType = 'text/plain';
                extension = 'txt';
                break;
            case 'csv':
                mimeType = 'text/csv';
                extension = 'csv';
                break;
            case 'json':
                mimeType = 'application/json';
                extension = 'json';
                break;
            case 'xml':
                mimeType = 'application/xml';
                extension = 'xml';
                break;
            default:
                mimeType = 'text/plain';
                extension = 'txt';
        }
        
        const blob = new Blob([this.elements.outputText.value], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `频道列表.${extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showToast('文件已下载', 'success');
    }

    // 清空所有
    clearAll() {
        this.elements.outputText.value = '';
        this.core.channels = [];
        this.renderChannelList();
        this.updateStats();
        this.showToast('已清空', 'success');
    }

    // 切换标签页
    switchTab(tabId) {
        // 更新标签页状态
        this.elements.tabs.forEach(tab => {
            tab.classList.toggle('active', tab.getAttribute('data-tab') === tabId);
        });
        
        // 更新内容区域
        this.elements.tabContents.forEach(content => {
            content.classList.toggle('active', content.id === tabId);
        });
        
        // 如果切换到分析标签页，更新图表
        if (tabId === 'analytics') {
            this.updateChart();
        }
        
        // 如果切换到历史标签页，更新历史记录
        if (tabId === 'history') {
            this.renderHistory();
        }
    }

    // 初始化图表
    initChart() {
        // 留空，将在更新数据时初始化
    }

    // 更新图表
    updateChart() {
        // 按组标题统计
        const groupCounts = {};
        this.core.channels.forEach(channel => {
            const group = channel.group || '未分组';
            groupCounts[group] = (groupCounts[group] || 0) + 1;
        });
        
        const groups = Object.keys(groupCounts);
        const counts = Object.values(groupCounts);
        
        // 更新统计数字
        this.elements.totalChannels.textContent = this.core.channels.length;
        this.elements.groupCount.textContent = groups.length;
        
        // 更新图表
        const ctx = this.elements.groupChart.getContext('2d');
        
        // 如果已有图表实例，先销毁
        if (this.elements.groupChart.chart) {
            this.elements.groupChart.chart.destroy();
        }
        
        this.elements.groupChart.chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: groups,
                datasets: [ {
                    label: '频道数量',
                    data: counts,
                    backgroundColor: groups.map((_, i) => {
                        const hue = (i * 30) % 360;
                        return `hsl(${hue}, 70%, 60%)`;
                    }),
                    borderColor: groups.map((_, i) => {
                        const hue = (i * 30) % 360;
                        return `hsl(${hue}, 70%, 40%)`;
                    }),
                    borderWidth: 1
                } ]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }

    // 渲染历史记录
    renderHistory() {
        this.elements.historyList.innerHTML = '';
        
        if (this.core.history.length === 0) {
            this.elements.historyList.innerHTML = '<p class="text-muted text-center">没有历史记录</p>';
            return;
        }
        
        // 按时间倒序排列
        const sortedHistory = [...this.core.history].reverse();
        
        sortedHistory.forEach((record, index) => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            historyItem.style.cursor = 'pointer';
            historyItem.style.padding = '10px';
            historyItem.style.borderBottom = '1px solid var(--border-color)';
            
            const date = new Date(record.timestamp);
            const timeString = date.toLocaleString();
            
            const formatBadge = document.createElement('span');
            formatBadge.className = 'badge';
            formatBadge.textContent = record.format.toUpperCase();
            
            const timeSpan = document.createElement('span');
            timeSpan.className = 'text-muted';
            timeSpan.textContent = ' ' + timeString;
            
            const previewText = document.createElement('p');
            previewText.className = 'text-muted';
            previewText.style.marginTop = '5px';
            previewText.textContent = record.data.substring(0, 100) + (record.data.length > 100 ? '...' : '');
            
            historyItem.appendChild(formatBadge);
            historyItem.appendChild(timeSpan);
            historyItem.appendChild(previewText);
            
            historyItem.addEventListener('click', () => {
                this.elements.outputText.value = record.data;
                this.elements.outputFormat.value = record.format;
                this.showToast('历史记录已加载', 'success');
                this.switchTab('converter');
            });
            
            this.elements.historyList.appendChild(historyItem);
        });
    }

    // 更新统计信息
    updateStats() {
        this.elements.totalChannels.textContent = this.core.channels.length;
        const groups = new Set(this.core.channels.map(c => c.group || '未分组'));
        this.elements.groupCount.textContent = groups.size;
    }

    // 显示通知
    showToast(message, type) {
        if (!this.core.settings.showNotifications) return;
        
        const toast = this.elements.toast;
        toast.textContent = message;
        toast.className = 'toast';
        
        // 添加类型类
        if (type) {
            toast.classList.add(type);
        }
        
        // 显示
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
        
        // 3秒后隐藏
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}