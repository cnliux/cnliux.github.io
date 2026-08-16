class UIHandler {
    constructor(core) {
        this.core = core;
        this.viewMode = 'table'; // 'table' | 'grid'
        this._searchTimer = null;
        this._toastTimer = null;
        this._lazyObserver = null;
        this._initialsCache = new Map();
        this._pinyinReady = false;
        this._refreshTimer = null;
        this._testing = false;
        this._hlsLoading = null;
        this._groupChart = null;
        this.elements = {
            // 标签页
            tabs: document.querySelectorAll('.tab'),
            tabContents: document.querySelectorAll('.tab-content'),
            settingsPanel: document.getElementById('settingsPanel'),
            settingsOverlay: document.getElementById('settingsOverlay'),
            settingsBtn: document.getElementById('settingsBtn'),

            // 文件输入
            dropArea: document.getElementById('dropArea'),
            fileInput: document.getElementById('fileInput'),
            selectFilesBtn: document.getElementById('selectFilesBtn'),
            fileList: document.getElementById('fileList'),
            textInput: document.getElementById('textInput'),
            parseTextBtn: document.getElementById('parseTextBtn'),
            urlInput: document.getElementById('urlInput'),
            importUrlBtn: document.getElementById('importUrlBtn'),
            deduplicate: document.getElementById('deduplicate'),
            appendToExisting: document.getElementById('appendToExisting'),

            // 频道列表
            channelSearch: document.getElementById('channelSearch'),
            channelList: document.getElementById('channelList'),
            channelTableView: document.getElementById('channelTableView'),
            channelGrid: document.getElementById('channelGrid'),
            selectAll: document.getElementById('selectAll'),
            groupFilter: document.getElementById('groupFilter'),
            statusFilter: document.getElementById('statusFilter'),
            favOnly: document.getElementById('favOnly'),
            viewToggleBtn: document.getElementById('viewToggleBtn'),
            deleteSelectedBtn: document.getElementById('deleteSelectedBtn'),
            testAllBtn: document.getElementById('testAllBtn'),
            oneClickTestBtn: document.getElementById('oneClickTestBtn'),
            batchGroupBtn: document.getElementById('batchGroupBtn'),
            batchRenameBtn: document.getElementById('batchRenameBtn'),

            // 输出设置
            outputFormat: document.getElementById('outputFormat'),
            fieldOrder: document.getElementById('fieldOrder'),
            customOrderContainer: document.getElementById('customOrderContainer'),
            customOrderFields: document.getElementById('customOrderFields'),
            fieldCheckboxes: document.querySelectorAll('input[name="fields"]'),

            // 输出结果
            outputText: document.getElementById('outputText'),
            copyBtn: document.getElementById('copyBtn'),
            clearBtn: document.getElementById('clearBtn'),
            convertBtn: document.getElementById('convertBtn'),
            downloadBtn: document.getElementById('downloadBtn'),

            // 数据分析
            totalChannels: document.getElementById('totalChannels'),
            groupCount: document.getElementById('groupCount'),
            groupChart: document.getElementById('groupChart'),
            reportContainer: document.getElementById('reportContainer'),
            snapshotBtn: document.getElementById('snapshotBtn'),
            diffBtn: document.getElementById('diffBtn'),
            diffResult: document.getElementById('diffResult'),

            // 历史记录
            historyList: document.getElementById('historyList'),
            clearAllHistory: document.getElementById('clearAllHistory'),
            clearAllHistoryBtn: document.getElementById('clearAllHistoryBtn'),

            // 设置
            themePref: document.getElementById('themePref'),
            saveHistory: document.getElementById('saveHistory'),
            autoConvert: document.getElementById('autoConvert'),
            showNotifications: document.getElementById('showNotifications'),
            recommendCount: document.getElementById('recommendCount'),
            corsProxy: document.getElementById('corsProxy'),
            autoClearHistory: document.getElementById('autoClearHistory'),
            mergeMode: document.getElementById('mergeMode'),
            autoRefresh: document.getElementById('autoRefresh'),
            autoRefreshMin: document.getElementById('autoRefreshMin'),
            concurrency: document.getElementById('concurrency'),
            timeout: document.getElementById('timeout'),
            exportSettingsBtn: document.getElementById('exportSettingsBtn'),
            importSettingsBtn: document.getElementById('importSettingsBtn'),
            importSettingsInput: document.getElementById('importSettingsInput'),
            closeSettings: document.getElementById('closeSettings'),

            // 其他
            toast: document.getElementById('toast')
        };
    }

    // 初始化事件监听 ================================================
    initEventListeners() {
        // 标签页切换
        this.elements.tabs.forEach(tab => {
            tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
        });

        // 设置面板开关
        this.elements.settingsBtn.addEventListener('click', () => this.openSettings());
        this.elements.closeSettings.addEventListener('click', () => this.closeSettings());
        this.elements.settingsOverlay.addEventListener('click', () => this.closeSettings());

        // 文件拖放与选择
        this.elements.dropArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.elements.dropArea.classList.add('dragover');
        });
        this.elements.dropArea.addEventListener('dragleave', () => {
            this.elements.dropArea.classList.remove('dragover');
        });
        this.elements.dropArea.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.elements.dropArea.classList.remove('dragover');
            const files = Array.from(e.dataTransfer.files).filter(f =>
                f.name.match(/\.(m3u|m3u8|txt|csv|json|epg|xmltv|diyp|xml)$/i)
            );
            if (files.length) {
                this.elements.fileInput.files = files;
                this.renderFileList();
                this.parseAllFiles();
            }
        });
        this.elements.selectFilesBtn.addEventListener('click', () => this.elements.fileInput.click());
        this.elements.fileInput.addEventListener('change', () => {
            this.renderFileList();
            this.parseAllFiles();
        });

        // 解析文本
        this.elements.parseTextBtn.addEventListener('click', () => this.parseText());

        // 导入网址
        this.elements.importUrlBtn.addEventListener('click', () => this.importUrls());

        // 频道搜索（防抖）
        this.elements.channelSearch.addEventListener('input', Utils.debounce(() => {
            this.renderChannelList();
        }, 200));

        // 全选
        this.elements.selectAll.addEventListener('change', () => {
            const checked = this.elements.selectAll.checked;
            document.querySelectorAll('.channel-checkbox').forEach(cb => {
                cb.checked = checked;
            });
        });

        // 筛选与视图
        this.elements.groupFilter.addEventListener('change', () => this.renderChannelList());
        this.elements.statusFilter.addEventListener('change', () => this.renderChannelList());
        this.elements.favOnly.addEventListener('change', () => this.renderChannelList());
        this.elements.viewToggleBtn.addEventListener('click', () => this.toggleView());

        // 批量操作
        this.elements.batchGroupBtn.addEventListener('click', () => this.openBatchModal());
        this.elements.batchRenameBtn.addEventListener('click', () => this.openBatchModal());
        this.elements.deleteSelectedBtn.addEventListener('click', () => this.deleteSelectedChannels());
        this.elements.testAllBtn.addEventListener('click', () => this.testAllUrls());
        this.elements.oneClickTestBtn.addEventListener('click', () => this.testAllUrls(true));

        // 输出
        this.elements.convertBtn.addEventListener('click', () => this.convertChannels());
        this.elements.copyBtn.addEventListener('click', () => {
            Utils.copyToClipboard(this.elements.outputText.value);
            this.showToast('已复制到剪贴板', 'success');
        });
        this.elements.downloadBtn.addEventListener('click', () => this.downloadResult());
        this.elements.clearBtn.addEventListener('click', () => this.clearAll());

        // 字段顺序
        this.elements.fieldOrder.addEventListener('change', () => {
            this.elements.customOrderContainer.classList.toggle('hidden', this.elements.fieldOrder.value !== 'custom');
        });
        this.elements.fieldCheckboxes.forEach(cb => {
            cb.addEventListener('change', () => this.renderCustomOrderFields());
        });

        // 数据分析
        this.elements.snapshotBtn.addEventListener('click', () => this.saveSnapshot());
        this.elements.diffBtn.addEventListener('click', () => this.renderDiff());

        // 历史记录
        this.elements.clearAllHistory.addEventListener('click', () => this.clearAllHistory());
        this.elements.clearAllHistoryBtn.addEventListener('click', () => this.clearAllHistory());

        // 设置项
        const settingsListeners = {
            themePref: () => {
                this.core.settings.theme = this.elements.themePref.value;
                this.applyTheme();
            },
            saveHistory: () => { this.core.settings.saveHistory = this.elements.saveHistory.checked; },
            autoConvert: () => { this.core.settings.autoConvert = this.elements.autoConvert.checked; },
            showNotifications: () => { this.core.settings.showNotifications = this.elements.showNotifications.checked; },
            recommendCount: () => { this.core.settings.recommendCount = parseInt(this.elements.recommendCount.value, 10) || 3; },
            corsProxy: () => { this.core.settings.corsProxy = this.elements.corsProxy.value; },
            autoClearHistory: () => { this.core.settings.autoClearHistory = this.elements.autoClearHistory.checked; },
            mergeMode: () => {
                this.core.settings.mergeMode = this.elements.mergeMode.value;
            },
            autoRefresh: () => {
                this.core.settings.autoRefresh = this.elements.autoRefresh.checked;
                this.scheduleAutoRefresh();
            },
            autoRefreshMin: () => {
                this.core.settings.autoRefreshMin = parseInt(this.elements.autoRefreshMin.value, 10) || 30;
                this.scheduleAutoRefresh();
            },
            concurrency: () => {
                this.core.settings.concurrency = parseInt(this.elements.concurrency.value, 10) || 5;
            },
            timeout: () => {
                this.core.settings.timeout = parseInt(this.elements.timeout.value, 10) || 10;
            }
        };
        Object.keys(settingsListeners).forEach(id => {
            const el = this.elements[id];
            if (!el) return;
            const evt = el.tagName === 'INPUT' && el.type === 'checkbox' ? 'change' : 'input';
            el.addEventListener(evt, () => {
                settingsListeners[id]();
                this.core.saveSettings();
            });
        });

        // 设置导入导出
        this.elements.exportSettingsBtn.addEventListener('click', () => this.exportSettingsFile());
        this.elements.importSettingsBtn.addEventListener('click', () => this.elements.importSettingsInput.click());
        this.elements.importSettingsInput.addEventListener('change', () => {
            if (this.elements.importSettingsInput.files.length) {
                this.importSettingsFile(this.elements.importSettingsInput.files[0]);
            }
        });

        // 主题跟随系统
        const mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
        if (mq) {
            const onThemeChange = () => { if (this.core.settings.theme === 'auto') this.applyTheme(); };
            if (mq.addEventListener) mq.addEventListener('change', onThemeChange);
            else if (mq.addListener) mq.addListener(onThemeChange);
        }

        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            const target = e.target;
            const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                this.convertChannels();
            } else if (e.ctrlKey && e.shiftKey && e.key === 'C' && !isInput) {
                e.preventDefault();
                Utils.copyToClipboard(this.elements.outputText.value);
                this.showToast('已复制', 'success');
            } else if (e.ctrlKey && e.shiftKey && e.key === 'D' && !isInput) {
                e.preventDefault();
                this.downloadResult();
            } else if (e.ctrlKey && e.shiftKey && e.key === 'T' && !isInput) {
                e.preventDefault();
                this.testAllUrls(true);
            } else if (e.key === 'Escape') {
                document.querySelectorAll('.modal').forEach(m => m.remove());
                if (this.elements.settingsPanel.classList.contains('open')) this.closeSettings();
            }
        });
    }

    // 标签页与设置面板 ==============================================
    switchTab(tabName) {
        this.elements.tabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });
        this.elements.tabContents.forEach(content => {
            content.classList.toggle('active', content.id === tabName);
        });
        if (tabName === 'analytics') {
            this.updateChart();
            this.renderReport();
            this.renderDiff();
        }
        if (tabName === 'history') this.renderHistory();
    }

    openSettings() {
        this.elements.settingsPanel.classList.add('open');
        this.elements.settingsOverlay.classList.add('show');
    }

    closeSettings() {
        this.elements.settingsPanel.classList.remove('open');
        this.elements.settingsOverlay.classList.remove('show');
    }

    // 设置应用与主题 ================================================
    applySettings() {
        if (this.elements.themePref) this.elements.themePref.value = this.core.settings.theme || 'dark';
        if (this.elements.saveHistory) this.elements.saveHistory.checked = !!this.core.settings.saveHistory;
        if (this.elements.autoConvert) this.elements.autoConvert.checked = !!this.core.settings.autoConvert;
        if (this.elements.showNotifications) this.elements.showNotifications.checked = !!this.core.settings.showNotifications;
        if (this.elements.recommendCount) this.elements.recommendCount.value = this.core.settings.recommendCount || 3;
        if (this.elements.corsProxy) this.elements.corsProxy.value = this.core.settings.corsProxy || '';
        if (this.elements.autoClearHistory) this.elements.autoClearHistory.checked = !!this.core.settings.autoClearHistory;
        if (this.elements.mergeMode) this.elements.mergeMode.value = this.core.settings.mergeMode || 'merge';
        if (this.elements.autoRefresh) this.elements.autoRefresh.checked = !!this.core.settings.autoRefresh;
        if (this.elements.autoRefreshMin) this.elements.autoRefreshMin.value = this.core.settings.autoRefreshMin || 30;
        if (this.elements.concurrency) this.elements.concurrency.value = this.core.settings.concurrency || 5;
        if (this.elements.timeout) this.elements.timeout.value = this.core.settings.timeout || 10;
        this.applyTheme();
        this.scheduleAutoRefresh();
    }

    applyTheme() {
        const theme = this.core.settings.theme || 'dark';
        const body = document.body;
        if (theme === 'auto') {
            body.classList.remove('light-mode', 'white-mode', 'black-mode', 'dark-mode');
        } else {
            body.classList.remove('light-mode', 'white-mode', 'black-mode', 'dark-mode');
            const map = { 'light': 'light-mode', 'dark': 'dark-mode', 'white': 'white-mode', 'black': 'black-mode' };
            body.classList.add(map[theme] || 'dark-mode');
        }
    }

    scheduleAutoRefresh() {
        if (this._refreshTimer) {
            clearInterval(this._refreshTimer);
            this._refreshTimer = null;
        }
        if (!this.core.settings.autoRefresh) return;
        const min = parseInt(this.core.settings.autoRefreshMin, 10) || 30;
        this._refreshTimer = setInterval(() => {
            if (this.elements.urlInput.value.trim()) {
                this.importUrls({ silent: true });
            }
        }, min * 60 * 1000);
    }

    exportSettingsFile() {
        const blob = new Blob([JSON.stringify(this.core.settings, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = '频道工具设置.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.showToast('设置已导出', 'success');
    }

    importSettingsFile(file) {
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const data = JSON.parse(reader.result);
                Object.assign(this.core.settings, data);
                this.core.saveSettings();
                this.applySettings();
                this.showToast('设置已导入', 'success');
            } catch (e) {
                this.showToast('设置文件无效', 'error');
            }
        };
        reader.readAsText(file);
    }

    // 文件与文本解析 ================================================
    handleFiles(files) {
        const validFiles = Array.from(files).filter(f =>
            f.name.match(/\.(m3u|m3u8|txt|csv|json|epg|xmltv|diyp|xml)$/i)
        );
        if (validFiles.length === 0) {
            this.showToast('请选择支持的文件格式（m3u/m3u8/txt/csv/json/epg）', 'warning');
            return;
        }
        this.elements.fileInput.files = validFiles;
        this.renderFileList();
        this.parseAllFiles();
    }

    renderFileList() {
        const files = this.elements.fileInput.files;
        const fileList = this.elements.fileList;

        if (!files || files.length === 0) {
            fileList.innerHTML = '<p class="text-muted">没有选择文件</p>';
            return;
        }

        const fileListHtml = Array.from(files).map((file, index) => `
            <div class="file-item">
                <div>
                    <div class="file-name">${Utils.escapeHtml(file.name)}</div>
                    <div class="file-size text-muted">${Utils.formatFileSize(file.size)}</div>
                </div>
                <div class="flex">
                    <button class="btn btn-secondary btn-sm" data-action="parse" data-index="${index}">解析</button>
                    <button class="btn btn-danger btn-sm" data-action="remove" data-index="${index}">移除</button>
                </div>
            </div>
        `).join('');

        fileList.innerHTML = fileListHtml;

        fileList.querySelectorAll('[data-action="parse"]').forEach(btn => {
            btn.addEventListener('click', () => this.parseAllFiles());
        });
        fileList.querySelectorAll('[data-action="remove"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index, 10);
                const dt = new DataTransfer();
                Array.from(this.elements.fileInput.files).forEach((f, i) => {
                    if (i !== index) dt.items.add(f);
                });
                this.elements.fileInput.files = dt.files;
                this.renderFileList();
            });
        });
    }

    parseAllFiles() {
        const files = this.elements.fileInput.files;
        if (!files || files.length === 0) {
            this.showToast('没有选择文件', 'warning');
            return;
        }

        const fileErrors = [];
        const parsePromises = Array.from(files).map(file => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const extension = file.name.split('.').pop().toLowerCase();
                        const channels = this.core.parseFileContent(e.target.result, extension);
                        resolve({ file: file.name, channels, count: channels.length });
                    } catch (err) {
                        fileErrors.push(`${file.name}: ${err.message}`);
                        resolve({ file: file.name, channels: [], count: 0 });
                    }
                };
                reader.onerror = () => {
                    fileErrors.push(`${file.name}: 读取失败`);
                    resolve({ file: file.name, channels: [], count: 0 });
                };
                reader.readAsText(file);
            });
        });

        Promise.all(parsePromises).then(results => {
            let total = 0;
            let parsedChannels = [];
            results.forEach(r => {
                if (r.count > 0) {
                    this.showToast(`解析 ${r.file} 成功：${r.count} 个频道`, 'success');
                }
                total += r.count;
                parsedChannels = parsedChannels.concat(r.channels);
            });

            this.setChannels(parsedChannels);
            if (fileErrors.length) {
                fileErrors.forEach(msg => this.showToast(`解析失败 ${msg}`, 'error'));
            } else if (total === 0) {
                this.showToast('没有解析到任何频道', 'warning');
            }
        });
    }

    parseText() {
        const text = this.elements.textInput.value.trim();
        if (!text) {
            this.showToast('请输入要解析的文本', 'warning');
            return;
        }
        try {
            const format = this.core.detectFormat(text);
            const channels = this.core.parseFileContent(text, format);
            this.setChannels(channels);
            if (channels.length === 0) {
                this.showToast('没有解析到任何频道', 'warning');
            }
        } catch (e) {
            this.showToast(`解析失败: ${e.message}`, 'error');
        }
    }

    // 网址导入（多源合并 + 定时刷新）
    async importUrls(opts = {}) {
        const text = this.elements.urlInput.value.trim();
        if (!text) {
            if (!opts.silent) this.showToast('请输入网址', 'warning');
            return;
        }
        const urls = text.split('\n').map(u => u.trim()).filter(u => u.length > 0);
        const proxy = (this.core.settings.corsProxy || '').trim();
        const resolveUrl = (url) => proxy ? proxy + url : url;
        const btn = this.elements.importUrlBtn;
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '导入中...';

        const knownExts = ['m3u', 'm3u8', 'txt', 'csv', 'json', 'epg', 'xmltv', 'diyp'];
        let parsedChannels = [];
        let successCount = 0;
        let failCount = 0;

        try {
            for (const url of urls) {
                try {
                    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
                    const timer = setTimeout(() => ctrl && ctrl.abort(), 20000);
                    const response = await fetch(resolveUrl(url), {
                        cache: 'no-cache',
                        signal: ctrl ? ctrl.signal : undefined
                    });
                    clearTimeout(timer);
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    const content = await response.text();
                    const urlPath = url.split('?')[0].toLowerCase();
                    const extMatch = urlPath.match(/\.([a-z0-9]+)$/);
                    const extension = (extMatch && knownExts.includes(extMatch[1])) ? extMatch[1] : this.core.detectFormat(content);
                    const channels = this.core.parseFileContent(content, extension);
                    parsedChannels = parsedChannels.concat(channels);
                    successCount++;
                } catch (e) {
                    failCount++;
                    const hint = e instanceof TypeError ? '（可能是跨域限制，可在设置中配置CORS代理）' : '';
                    if (!opts.silent) this.showToast(`导入失败 ${url}: ${e.message}${hint}`, 'error');
                }
            }

            if (parsedChannels.length === 0 && successCount === 0) {
                this.showToast('全部导入失败，请检查网址或CORS代理设置', 'error');
                return;
            }

            this.setChannels(parsedChannels);
            if (!opts.silent) {
                this.showToast(`导入完成：成功 ${successCount} 个来源，失败 ${failCount} 个，共 ${this.core.channels.length} 个频道`, 'success');
            }
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }

    // 设置当前频道列表（支持合并/去重策略）
    setChannels(parsedChannels) {
        if (this.elements.appendToExisting && this.elements.appendToExisting.checked) {
            this.core.channels = this.core.mergeChannels(
                this.core.channels,
                parsedChannels,
                this.core.settings.mergeMode || 'merge'
            );
        } else if (this.elements.deduplicate && this.elements.deduplicate.checked) {
            this.core.channels = this.core.deduplicateChannels(parsedChannels);
        } else {
            this.core.channels = parsedChannels;
        }
        this.renderChannelList();
        this.updateStats();
        if (this.core.settings.autoConvert) this.convertChannels();
        this.scheduleAutoRefresh();
    }

    // 频道列表渲染 ==================================================
    async renderChannelList() {
        if (this.elements.selectAll) this.elements.selectAll.checked = false;
        const indices = await this.getVisibleIndices();
        this.renderGroupFilter();

        if (this.viewMode === 'grid') {
            this.renderGridCards(indices);
        } else {
            this.renderTableRows(indices);
        }
    }

    // 分组下拉（选项集合变化时才重建，避免失焦）
    renderGroupFilter() {
        const select = this.elements.groupFilter;
        if (!select) return;
        const groups = [...new Set(this.core.channels.map(c => c.group || '未分组'))];
        const current = select.value;
        const html = ['<option value="">全部分组</option>']
            .concat(groups.map(g => `<option value="${Utils.escapeHtml(g)}">${Utils.escapeHtml(g)}</option>`))
            .join('');
        if (select.innerHTML !== html) {
            select.innerHTML = html;
            if (groups.includes(current)) select.value = current;
            else select.value = '';
        }
    }

    // 可见频道索引（分组/状态/收藏/拼音搜索筛选）
    async getVisibleIndices() {
        const q = (this.elements.channelSearch.value || '').trim().toLowerCase();
        const group = this.elements.groupFilter.value;
        const status = this.elements.statusFilter.value;
        const favOnly = this.elements.favOnly && this.elements.favOnly.checked;
        const list = this.core.channels;
        const indices = [];

        for (let i = 0; i < list.length; i++) {
            const c = list[i];
            if (group && (c.group || '未分组') !== group) continue;
            if (status) {
                if (status === 'untested') { if (c.status) continue; }
                else if (c.status !== status) continue;
            }
            if (favOnly && !c.favorite) continue;
            if (q) {
                const syncMatch =
                    (c.name || '').toLowerCase().includes(q) ||
                    (c.url || '').toLowerCase().includes(q) ||
                    (c.logo || '').toLowerCase().includes(q) ||
                    (c.group || '').toLowerCase().includes(q);
                if (!syncMatch) {
                    if (!/[\u4e00-\u9fff]/.test(c.name || '')) continue;
                    const initials = await this.getChannelInitials(c);
                    if (!initials || !initials.includes(q)) continue;
                }
            }
            indices.push(i);
        }

        // 收藏频道置顶
        indices.sort((a, b) => ((list[b].favorite ? 1 : 0) - (list[a].favorite ? 1 : 0)) || (a - b));
        return indices;
    }

    // 拼音首字母（懒加载 pinyin-pro，降级为子串匹配）
    loadPinyinLib() {
        if (this._pinyinReady || window.pinyinPro) {
            this._pinyinReady = true;
            return Promise.resolve();
        }
        return this.loadScript('https://cdn.jsdelivr.net/npm/pinyin-pro@3/dist/index.min.js', 'pinyinPro')
            .then(() => { this._pinyinReady = !!window.pinyinPro; });
    }

    getChannelInitials(channel) {
        const name = channel.name || '';
        if (!/[\u4e00-\u9fff]/.test(name)) return Promise.resolve('');
        if (this._initialsCache.has(name)) return Promise.resolve(this._initialsCache.get(name));
        return this.loadPinyinLib().then(() => {
            if (!window.pinyinPro) return '';
            try {
                const arr = window.pinyinPro.pinyin(name, { pattern: 'first', toneType: 'none', type: 'array' });
                const s = arr.join('').toLowerCase();
                this._initialsCache.set(name, s);
                return s;
            } catch (e) {
                return '';
            }
        });
    }

    // 表格视图（分块渲染，避免大数据量卡顿）
    renderTableRows(indices) {
        const tbody = this.elements.channelList;
        tbody.innerHTML = '';

        if (indices.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">没有匹配的频道</td></tr>';
            return;
        }

        const chunkSize = 300;
        const renderChunk = (start) => {
            const frag = document.createDocumentFragment();
            const end = Math.min(start + chunkSize, indices.length);
            for (let i = start; i < end; i++) {
                frag.appendChild(this.createChannelRow(indices[i]));
            }
            tbody.appendChild(frag);
            if (end < indices.length) requestAnimationFrame(() => renderChunk(end));
        };
        renderChunk(0);
    }

    // 网格视图
    renderGridCards(indices) {
        const grid = this.elements.channelGrid;
        if (!grid) return;
        grid.innerHTML = '';

        if (indices.length === 0) {
            grid.innerHTML = '<p class="text-muted text-center">没有匹配的频道</p>';
            return;
        }

        const frag = document.createDocumentFragment();
        indices.forEach(index => {
            frag.appendChild(this.createChannelCard(index));
        });
        grid.appendChild(frag);
    }

    toggleView() {
        this.viewMode = this.viewMode === 'table' ? 'grid' : 'table';
        if (this.elements.channelTableView) this.elements.channelTableView.classList.toggle('hidden', this.viewMode === 'grid');
        if (this.elements.channelGrid) this.elements.channelGrid.classList.toggle('hidden', this.viewMode !== 'grid');
        this.elements.viewToggleBtn.textContent = this.viewMode === 'table' ? '网格视图' : '表格视图';
        this.renderChannelList();
    }

    createChannelRow(index) {
        const channel = this.core.channels[index];
        const row = document.createElement('tr');
        row.dataset.index = index;

        const checkCell = document.createElement('td');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'form-check-input channel-checkbox';
        checkbox.dataset.index = index;
        checkCell.appendChild(checkbox);
        row.appendChild(checkCell);

        const nameCell = document.createElement('td');
        nameCell.className = 'channel-name';
        nameCell.textContent = this.truncateText(channel.name || '未命名', 40);
        if (channel.favorite) {
            nameCell.appendChild(document.createTextNode(' '));
            const star = document.createElement('span');
            star.className = 'fav-badge';
            star.textContent = '★';
            nameCell.appendChild(star);
        }
        row.appendChild(nameCell);

        const urlCell = document.createElement('td');
        if (channel.url) {
            const a = document.createElement('a');
            a.href = channel.url;
            a.className = 'channel-url';
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.textContent = channel.url.length > 35 ? channel.url.substring(0, 35) + '...' : channel.url;
            urlCell.appendChild(a);
        }
        row.appendChild(urlCell);

        const logoCell = document.createElement('td');
        logoCell.appendChild(this.renderLogo(channel));
        row.appendChild(logoCell);

        const groupCell = document.createElement('td');
        groupCell.textContent = channel.group || '未分组';
        row.appendChild(groupCell);

        const statusCell = document.createElement('td');
        statusCell.className = 'channel-status';
        statusCell.innerHTML = this.getStatusHtml(channel);
        row.appendChild(statusCell);

        const actionCell = document.createElement('td');
        this.appendActionButtons(actionCell, index);
        row.appendChild(actionCell);

        return row;
    }

    createChannelCard(index) {
        const channel = this.core.channels[index];
        const card = document.createElement('div');
        card.className = 'channel-card';
        card.dataset.index = index;

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'form-check-input channel-checkbox card-checkbox';
        cb.dataset.index = index;
        card.appendChild(cb);

        const head = document.createElement('div');
        head.className = 'channel-card-head';
        head.appendChild(this.renderLogo(channel));
        const name = document.createElement('div');
        name.className = 'channel-card-name';
        name.textContent = this.truncateText(channel.name || '未命名', 18);
        head.appendChild(name);
        card.appendChild(head);

        const meta = document.createElement('div');
        meta.className = 'channel-card-meta';
        meta.textContent = channel.group || '未分组';
        card.appendChild(meta);

        const status = document.createElement('div');
        status.className = 'channel-card-status channel-status';
        status.innerHTML = this.getStatusHtml(channel);
        card.appendChild(status);

        const actions = document.createElement('div');
        actions.className = 'channel-card-actions';
        this.appendActionButtons(actions, index);
        card.appendChild(actions);

        return card;
    }

    appendActionButtons(container, index) {
        const channel = this.core.channels[index];
        const makeBtn = (text, cls, title, fn) => {
            const b = document.createElement('button');
            b.className = `btn ${cls} btn-sm`;
            b.textContent = text;
            b.title = title;
            b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
            container.appendChild(b);
            container.appendChild(document.createTextNode(' '));
            return b;
        };
        makeBtn(channel.favorite ? '★' : '☆', 'btn-secondary', '收藏/取消收藏', () => this.toggleFavorite(index));
        makeBtn('预览', 'btn-secondary', '播放预览', () => this.previewChannel(index));
        makeBtn('测试', 'btn-secondary', '测试可用性', () => this.testUrl(index));
        makeBtn('编辑', 'btn-secondary', '编辑', () => this.editChannel(index));
        makeBtn('删除', 'btn-danger', '删除', () => this.deleteChannel(index));
    }

    renderLogo(channel) {
        if (!channel.logo) return this.createLogoPlaceholder(channel.name);
        const img = document.createElement('img');
        img.className = 'channel-logo';
        img.alt = (channel.name || '') + ' logo';
        img.referrerPolicy = 'no-referrer';
        img.onerror = () => {
            img.replaceWith(this.createLogoPlaceholder(channel.name));
        };
        if (typeof IntersectionObserver !== 'undefined') {
            img.dataset.src = channel.logo;
            this.getLazyObserver().observe(img);
        } else {
            img.src = channel.logo;
        }
        return img;
    }

    getLazyObserver() {
        if (this._lazyObserver) return this._lazyObserver;
        this._lazyObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                    }
                    this._lazyObserver.unobserve(img);
                }
            });
        }, { rootMargin: '100px' });
        return this._lazyObserver;
    }

    createLogoPlaceholder(name) {
        const div = document.createElement('div');
        div.className = 'logo-placeholder';
        div.textContent = (name || '频道').substring(0, 2);
        div.title = name || '';
        return div;
    }

    getStatusHtml(channel) {
        const s = channel ? channel.status : '';
        const latency = channel && channel.latency ? ` ${channel.latency}ms` : '';
        if (s === 'success') return `<span class="status-indicator status-success"></span>可用${latency}`;
        if (s === 'error') return '<span class="status-indicator status-error"></span>不可用';
        if (s === 'testing') return '<span class="status-indicator status-warning"></span>测试中...';
        return '<span class="status-indicator status-warning"></span>未测试';
    }

    updateChannelRowStatus(index) {
        const channel = this.core.channels[index];
        if (!channel) return;
        const html = this.getStatusHtml(channel);
        document.querySelectorAll(`[data-index="${index}"] .channel-status`).forEach(el => {
            el.innerHTML = html;
        });
    }

    truncateText(text, maxLen) {
        if (!text) return '';
        return text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
    }

    // 频道操作 ======================================================
    toggleFavorite(index) {
        const channel = this.core.channels[index];
        if (!channel) return;
        channel.favorite = !channel.favorite;
        this.renderChannelList();
    }

    previewChannel(index) {
        const channel = this.core.channels[index];
        if (!channel || !channel.url) return;
        const isM3u8 = /\.m3u8(\?|$)/i.test(channel.url);

        // CORS代理：解决流服务器未返回 Access-Control-Allow-Origin 导致的跨域拦截
        const proxy = (this.core.settings.corsProxy || '').trim();
        const streamUrl = proxy ? proxy + channel.url : channel.url;

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content preview-modal">
                <h3>预览：${Utils.escapeHtml(channel.name || '')}</h3>
                <video id="preview-video" class="preview-video" controls autoplay></video>
                <div class="flex flex-between mt-20">
                    <button id="preview-close" class="btn btn-danger">关闭</button>
                </div>
            </div>`;
        document.body.appendChild(modal);

        const video = modal.querySelector('#preview-video');
        const playHls = (src) => {
            if (window.Hls && window.Hls.isSupported()) {
                const hls = new window.Hls();
                hls.loadSource(src);
                hls.attachMedia(video);
                hls.on(window.Hls.Events.ERROR, (e, data) => {
                    if (data && data.fatal) this.showToast('播放失败，流可能不可用', 'error');
                });
            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                video.src = src;
            } else {
                video.src = src;
            }
        };

        if (isM3u8) {
            if (window.Hls && window.Hls.isSupported()) playHls(streamUrl);
            else {
                this.loadHlsModule().then(() => playHls(streamUrl));
            }
        } else {
            video.src = streamUrl;
        }

        modal.querySelector('#preview-close').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    }

    loadScript(src, globalName) {
        if (globalName && window[globalName]) return Promise.resolve();
        return new Promise((resolve) => {
            const s = document.createElement('script');
            s.src = src;
            s.onload = () => resolve();
            s.onerror = () => resolve();
            document.head.appendChild(s);
        });
    }

    // 优先加载本地 hls.js（ES模块），失败或无法使用再回退CDN的UMD版
    loadHlsModule() {
        if (window.Hls && window.Hls.isSupported()) return Promise.resolve();
        if (this._hlsLoading) return this._hlsLoading;
        this._hlsLoading = import('js/hls.js')
            .then(m => {
                const Hls = (m && m.default) || m;
                if (Hls && Hls.isSupported) {
                    window.Hls = Hls;
                } else {
                    return this.loadScript('https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js', 'Hls');
                }
            })
            .catch(() => this.loadScript('https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js', 'Hls'));
        return this._hlsLoading;
    }

    // 并发池测试：限制并发 + 超时 + 测速（ignoreFilter=true 时测试全部频道）
    async testAllUrls(ignoreFilter = false) {
        if (this._testing) {
            this.showToast('正在测试中，请稍候', 'warning');
            return;
        }
        const indices = ignoreFilter
            ? this.core.channels.map((c, i) => i)
            : await this.getVisibleIndices();
        if (indices.length === 0) {
            this.showToast('没有可测试的频道', 'warning');
            return;
        }
        const concurrency = Math.min(Math.max(parseInt(this.core.settings.concurrency, 10) || 5, 1), 20);
        const timeout = parseInt(this.core.settings.timeout, 10) || 10;
        const opts = { silent: true };
        this._testing = true;
        this.showToast(`开始${ignoreFilter ? '一键测试全部' : '测试筛选结果'}：${indices.length} 个URL（并发 ${concurrency}）...`, 'success');

        let cursor = 0;
        let ok = 0;
        let fail = 0;

        const worker = async () => {
            while (cursor < indices.length) {
                const idx = indices[cursor++];
                await this.testUrl(idx, timeout, opts);
                const c = this.core.channels[idx];
                if (c && c.status === 'success') ok++;
                else if (c && c.status === 'error') fail++;
            }
        };

        const workers = [];
        for (let i = 0; i < concurrency; i++) workers.push(worker());
        await Promise.all(workers);

        this._testing = false;
        this.showToast(`测试完成：可用 ${ok} 个，不可用 ${fail} 个`, 'success');
        this.renderReport();
        this.renderChannelList();
    }

    testUrl(index, timeoutSec = 10, opts = {}) {
        const channel = this.core.channels[index];
        if (!channel || !channel.url) return Promise.resolve();

        channel.status = 'testing';
        channel.latency = null;
        this.updateChannelRowStatus(index);

        const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = setTimeout(() => ctrl && ctrl.abort(), (timeoutSec || 10) * 1000);
        const start = performance.now();

        const doFetch = (method) =>
            fetch(channel.url, {
                method,
                mode: 'no-cors',
                cache: 'no-cache',
                signal: ctrl ? ctrl.signal : undefined
            });

        return doFetch('HEAD')
            .then(() => this.setChannelStatus(index, 'success', performance.now() - start, opts))
            .catch(() => doFetch('GET')
                .then(() => this.setChannelStatus(index, 'success', performance.now() - start, opts))
                .catch(() => this.setChannelStatus(index, 'error', null, opts))
            )
            .finally(() => clearTimeout(timer));
    }

    setChannelStatus(index, status, latency, opts = {}) {
        const channel = this.core.channels[index];
        if (!channel) return;
        channel.status = status;
        if (latency != null) channel.latency = Math.round(latency);
        this.updateChannelRowStatus(index);
        if (opts.silent) return;
        if (status === 'success') {
            this.showToast(`${channel.name} 可用${channel.latency ? ' (' + channel.latency + 'ms)' : ''}`, 'success');
        } else {
            this.showToast(`${channel.name} 不可用`, 'error');
        }
    }

    editChannel(index) {
        const channel = this.core.channels[index];
        if (!channel) return;

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>编辑频道</h3>
                <div class="form-group">
                    <label class="form-label">频道名称</label>
                    <input type="text" id="edit-name" class="form-control" value="${Utils.escapeHtml(channel.name || '')}">
                </div>
                <div class="form-group">
                    <label class="form-label">URL</label>
                    <input type="text" id="edit-url" class="form-control" value="${Utils.escapeHtml(channel.url || '')}">
                </div>
                <div class="form-group">
                    <label class="form-label">Logo URL</label>
                    <input type="text" id="edit-logo" class="form-control" value="${Utils.escapeHtml(channel.logo || '')}">
                </div>
                <div class="form-group">
                    <label class="form-label">分组</label>
                    <input type="text" id="edit-group" class="form-control" value="${Utils.escapeHtml(channel.group || '')}">
                </div>
                <div class="flex flex-between mt-20">
                    <button id="edit-cancel" class="btn btn-danger">取消</button>
                    <button id="edit-save" class="btn btn-primary">保存</button>
                </div>
            </div>`;
        document.body.appendChild(modal);

        const saveBtn = modal.querySelector('#edit-save');
        saveBtn.addEventListener('click', () => {
            channel.name = modal.querySelector('#edit-name').value.trim() || channel.name;
            channel.url = modal.querySelector('#edit-url').value.trim();
            channel.logo = modal.querySelector('#edit-logo').value.trim();
            channel.group = modal.querySelector('#edit-group').value.trim();
            modal.remove();
            this.renderChannelList();
            this.updateStats();
            this.showToast('频道已更新', 'success');
        });
        modal.querySelector('#edit-cancel').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    }

    deleteChannel(index) {
        const channel = this.core.channels[index];
        if (!channel) return;
        if (!confirm(`确定删除频道「${channel.name}」吗？`)) return;
        this.core.channels.splice(index, 1);
        this.renderChannelList();
        this.updateStats();
        this.showToast('频道已删除', 'success');
    }

    deleteSelectedChannels() {
        const indices = this.getCheckedIndices();
        if (indices.length === 0) {
            this.showToast('请先选择要删除的频道', 'warning');
            return;
        }
        if (!confirm(`确定删除选中的 ${indices.length} 个频道吗？`)) return;
        indices.sort((a, b) => b - a).forEach(i => this.core.channels.splice(i, 1));
        this.renderChannelList();
        this.updateStats();
        this.showToast(`已删除 ${indices.length} 个频道`, 'success');
    }

    getCheckedIndices() {
        return Array.from(document.querySelectorAll('.channel-checkbox:checked'))
            .map(cb => parseInt(cb.dataset.index, 10))
            .filter(idx => !isNaN(idx));
    }

    // 批量改分组 / 批量重命名
    openBatchModal() {
        const indices = this.getCheckedIndices();
        if (indices.length === 0) {
            this.showToast('请先勾选要操作的频道', 'warning');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>批量操作（已选 ${indices.length} 个）</h3>
                <div class="form-group">
                    <label class="form-label">批量移动分组（留空则不改）</label>
                    <input type="text" id="batch-group" class="form-control" placeholder="输入目标分组名">
                </div>
                <div class="form-group">
                    <label class="form-label">批量重命名（正则查找并替换，留空则不改）</label>
                    <input type="text" id="batch-regex" class="form-control" placeholder="查找（正则，如：CCTV-1）">
                    <input type="text" id="batch-replace" class="form-control mt-10" placeholder="替换为（如：CCTV-2）">
                </div>
                <div class="flex flex-between mt-20">
                    <button id="batch-cancel" class="btn btn-danger">取消</button>
                    <button id="batch-apply" class="btn btn-primary">应用</button>
                </div>
            </div>`;
        document.body.appendChild(modal);

        modal.querySelector('#batch-cancel').addEventListener('click', () => modal.remove());
        modal.querySelector('#batch-apply').addEventListener('click', () => {
            const group = modal.querySelector('#batch-group').value.trim();
            const regex = modal.querySelector('#batch-regex').value;
            const replace = modal.querySelector('#batch-replace').value;
            let regexError = false;
            indices.forEach(i => {
                const c = this.core.channels[i];
                if (!c) return;
                if (group) c.group = group;
                if (regex) {
                    try {
                        c.name = c.name.replace(new RegExp(regex, 'g'), replace);
                    } catch (e) {
                        regexError = true;
                    }
                }
            });
            modal.remove();
            if (regexError) this.showToast('正则表达式无效', 'error');
            else {
                this.renderChannelList();
                this.updateStats();
                this.showToast('批量操作完成', 'success');
            }
        });
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    }

    // 转换与导出 ====================================================
    convertChannels() {
        const format = this.elements.outputFormat.value;
        const fieldOrder = this.getFieldOrder();
        let result;
        try {
            result = this.convertList(this.core.channels, format, fieldOrder);
        } catch (e) {
            this.showToast(`转换失败: ${e.message}`, 'error');
            return;
        }
        if (result) {
            this.elements.outputText.value = result;
            this.core.addHistoryRecord(result, format);
            this.showToast('转换完成', 'success');
        } else {
            this.showToast('没有可转换的频道', 'warning');
        }
    }

    // 按当前筛选结果导出
    async exportFiltered(status) {
        const indices = await this.getVisibleIndices();
        let list = indices.map(i => this.core.channels[i]);
        if (status) list = list.filter(c => c.status === status);
        if (list.length === 0) {
            this.showToast('没有符合条件的频道', 'warning');
            return;
        }
        const format = this.elements.outputFormat.value;
        const fieldOrder = this.getFieldOrder();
        let result;
        try {
            result = this.convertList(list, format, fieldOrder);
        } catch (e) {
            this.showToast(`导出失败: ${e.message}`, 'error');
            return;
        }
        if (result) {
            this.elements.outputText.value = result;
            this.core.addHistoryRecord(result, format);
            this.showToast(`已导出 ${list.length} 个频道`, 'success');
            this.switchTab('converter');
        }
    }

    convertList(list, format, fieldOrder) {
        if (!list || list.length === 0) return '';
        switch (format) {
            case 'm3u': return this.core.convertToM3U(fieldOrder, list);
            case 'txt': return this.core.convertToTXT(fieldOrder, list);
            case 'csv': return this.core.convertToCSV(fieldOrder, list);
            case 'json': return this.core.convertToJSON(fieldOrder, list);
            case 'xml': return this.core.convertToXML(fieldOrder, list);
            case 'excel':
                return this.core.convertToExcel(fieldOrder, list);
            default:
                return this.core.convertToM3U(fieldOrder, list);
        }
    }

    getFieldOrder() {
        const type = this.elements.fieldOrder.value;
        if (type === 'default') return ['name', 'url', 'logo', 'group'];
        if (type === 'groupFirst') return ['group', 'name', 'url', 'logo'];
        if (type === 'urlFirst') return ['url', 'name', 'logo', 'group'];
        if (type === 'logoFirst') return ['logo', 'name', 'url', 'group'];
        if (type === 'custom') return this.getCustomFieldOrder();
        return ['name', 'url', 'logo', 'group'];
    }

    getCustomFieldOrder() {
        const checkedFields = Array.from(this.elements.fieldCheckboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value);
        const sortedFields = Array.from(this.elements.customOrderFields.querySelectorAll('.sortable-item'))
            .map(el => el.dataset.field);
        // 勾选字段按拖拽顺序排列，未出现在拖拽列表中的补充在后
        const finalOrder = sortedFields
            .filter(f => checkedFields.includes(f))
            .concat(checkedFields.filter(f => !sortedFields.includes(f)));
        return finalOrder.length ? finalOrder : ['name', 'url', 'logo', 'group'];
    }

    renderCustomOrderFields() {
        const container = this.elements.customOrderFields;
        const fields = [
            { key: 'name', label: '名称' },
            { key: 'url', label: 'URL' },
            { key: 'logo', label: 'Logo' },
            { key: 'group', label: '分组' }
        ];
        container.innerHTML = fields.map(field => `
            <div class="sortable-item" draggable="true" data-field="${field.key}">
                <span class="drag-handle">≡</span> ${field.label}
            </div>
        `).join('');

        let dragItem = null;
        container.querySelectorAll('.sortable-item').forEach(item => {
            item.addEventListener('dragstart', () => { dragItem = item; item.classList.add('dragging'); });
            item.addEventListener('dragend', () => { dragItem = null; item.classList.remove('dragging'); });
        });
        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            const afterElement = this.getDragAfterElement(container, e.clientY);
            if (afterElement == null) container.appendChild(dragItem);
            else container.insertBefore(dragItem, afterElement);
        });
    }

    getDragAfterElement(container, y) {
        const els = [...container.querySelectorAll('.sortable-item:not(.dragging)')];
        return els.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            }
            return closest;
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    downloadResult() {
        const content = this.elements.outputText.value;
        if (!content) {
            this.showToast('没有可下载的内容', 'warning');
            return;
        }
        const format = this.elements.outputFormat.value;
        const mimeTypes = {
            'm3u': 'audio/x-mpegurl',
            'txt': 'text/plain',
            'csv': 'text/csv',
            'json': 'application/json',
            'xml': 'application/xml',
            'excel': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        };
        const mime = mimeTypes[format] || 'text/plain';
        const blob = new Blob([content], { type: mime + ';charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `channel_list.${format === 'excel' ? 'xlsx' : format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.showToast('下载已开始', 'success');
    }

    clearAll() {
        this.elements.outputText.value = '';
        this.showToast('已清空', 'success');
    }

    // 数据分析 ======================================================
    updateStats() {
        const channels = this.core.channels;
        if (this.elements.totalChannels) this.elements.totalChannels.textContent = channels.length;
        if (this.elements.groupCount) {
            const groups = new Set(channels.map(c => c.group || '未分组'));
            this.elements.groupCount.textContent = groups.size;
        }
    }

    updateChart() {
        if (typeof Chart === 'undefined' || !this.elements.groupChart) return;
        if (this._groupChart) this._groupChart.destroy();

        const groups = this.core.groupChannels();
        const labels = Object.keys(groups);
        if (labels.length === 0) {
            this.elements.groupChart.style.display = 'none';
            return;
        }
        this.elements.groupChart.style.display = '';
        const data = labels.map(g => groups[g].length);

        this._groupChart = new Chart(this.elements.groupChart, {
            type: 'pie',
            data: {
                labels,
                datasets: [{ data, backgroundColor: this.generateColors(labels.length) }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'right' } }
            }
        });
    }

    generateColors(n) {
        const colors = [];
        for (let i = 0; i < n; i++) {
            colors.push(`hsl(${(i * 137.5) % 360}, 70%, 55%)`);
        }
        return colors;
    }

    // 分组可用率报告
    renderReport() {
        const container = this.elements.reportContainer;
        if (!container) return;
        const stats = this.core.getStats();
        if (stats.length === 0) {
            container.innerHTML = '<p class="text-muted text-center">暂无数据，导入频道后点击「测试所有URL」生成报告</p>';
            return;
        }
        let html = '<table class="table report-table"><thead><tr>' +
            '<th>分组</th><th>总数</th><th>可用</th><th>不可用</th><th>未测试</th><th>可用率</th>' +
            '</tr></thead><tbody>';
        stats.forEach(s => {
            html += `<tr><td>${Utils.escapeHtml(s.group)}</td><td>${s.total}</td>` +
                `<td class="text-ok">${s.ok}</td><td class="text-fail">${s.fail}</td><td>${s.untested}</td>` +
                `<td>${s.okRate}%</td></tr>`;
        });
        html += '</tbody></table>';
        html += '<div class="flex flex-wrap mt-10">';
        html += '<button class="btn btn-secondary btn-sm" data-export-status="">导出当前筛选</button> ';
        html += '<button class="btn btn-success btn-sm" data-export-status="success">导出可用</button> ';
        html += '<button class="btn btn-danger btn-sm" data-export-status="error">导出不可用</button>';
        html += '</div>';
        container.innerHTML = html;

        container.querySelectorAll('[data-export-status]').forEach(btn => {
            btn.addEventListener('click', () => {
                const status = btn.getAttribute('data-export-status');
                this.exportFiltered(status === '' ? null : status);
            });
        });
    }

    // 快照与差异对比
    saveSnapshot() {
        this.core._snapshot = this.core.channels.map(c => ({ ...c }));
        try {
            localStorage.setItem('channelConverterSnapshot', JSON.stringify(this.core._snapshot));
        } catch (e) { /* 存储失败忽略 */ }
        this.showToast('已保存当前列表为基准', 'success');
    }

    loadSnapshot() {
        try {
            const s = localStorage.getItem('channelConverterSnapshot');
            return s ? JSON.parse(s) : null;
        } catch (e) {
            return null;
        }
    }

    renderDiff() {
        const container = this.elements.diffResult;
        if (!container) return;
        const base = this.loadSnapshot() || this.core._snapshot;
        if (!base || base.length === 0) {
            container.innerHTML = '<p class="text-muted text-center">请先点击「保存当前为基准」，再导入/更新列表后对比</p>';
            return;
        }
        const { added, removed } = this.core.diffChannels(base, this.core.channels);
        let html = `<div class="diff-summary">新增 <span class="text-ok">${added.length}</span> 个，移除 <span class="text-fail">${removed.length}</span> 个</div>`;
        if (added.length) {
            html += '<h4 class="mt-10">新增频道</h4><ul class="diff-list diff-added">' +
                added.slice(0, 50).map(c => `<li>${Utils.escapeHtml(c.name)} (${Utils.escapeHtml(c.group || '未分组')})</li>`).join('') +
                (added.length > 50 ? `<li class="text-muted">...等 ${added.length} 个</li>` : '') + '</ul>';
        }
        if (removed.length) {
            html += '<h4 class="mt-10">移除频道</h4><ul class="diff-list diff-removed">' +
                removed.slice(0, 50).map(c => `<li>${Utils.escapeHtml(c.name)} (${Utils.escapeHtml(c.group || '未分组')})</li>`).join('') +
                (removed.length > 50 ? `<li class="text-muted">...等 ${removed.length} 个</li>` : '') + '</ul>';
        }
        container.innerHTML = html;
    }

    // 历史记录 ======================================================
    renderHistory() {
        const history = this.core.getHistory();
        const list = this.elements.historyList;
        if (!list) return;

        if (history.length === 0) {
            list.innerHTML = '<p class="text-muted text-center">没有历史记录</p>';
            return;
        }

        list.innerHTML = history.map((record, index) => `
            <div class="history-item">
                <div class="flex flex-between">
                    <span class="history-format">${Utils.escapeHtml(record.format.toUpperCase())}</span>
                    <span class="text-muted">${Utils.escapeHtml(record.time)}</span>
                </div>
                <div class="history-size text-muted">${Utils.formatFileSize(record.size)}</div>
                <div class="flex mt-10">
                    <button class="btn btn-secondary btn-sm" data-action="restore" data-index="${index}">恢复</button>
                    <button class="btn btn-danger btn-sm" data-action="delete" data-index="${index}">删除</button>
                </div>
            </div>
        `).join('');

        list.querySelectorAll('[data-action="restore"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index, 10);
                const record = history[index];
                if (record) {
                    this.elements.outputText.value = record.content;
                    this.elements.outputFormat.value = record.format === 'excel' ? 'm3u' : record.format;
                    this.showToast('已恢复历史记录', 'success');
                }
            });
        });
        list.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index, 10);
                this.core.deleteHistoryRecord(index);
                this.renderHistory();
            });
        });
    }

    clearAllHistory() {
        if (!confirm('确定清除所有历史记录吗？')) return;
        this.core.clearHistory();
        this.renderHistory();
        this.showToast('历史记录已清除', 'success');
    }

    // 提示 ==========================================================
    showToast(message, type = 'info') {
        if (!this.elements.toast) return;
        this.elements.toast.textContent = message;
        this.elements.toast.className = 'toast show';
        if (type !== 'info') this.elements.toast.classList.add(type);
        if (this._toastTimer) clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => {
            this.elements.toast.classList.remove('show');
        }, 3000);
    }
}