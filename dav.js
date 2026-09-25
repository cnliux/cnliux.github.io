"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const webdav_1 = require("webdav");

let cachedData = {};

function getClient() {
    const { url, username, password, searchPath } = env?.getUserVariables?.() ?? {};
    if (!(url && username && password)) {
        return null;
    }
    if (!(cachedData.url === url &&
        cachedData.username === username &&
        cachedData.password === password &&
        cachedData.searchPath === searchPath)) {
        cachedData.url = url;
        cachedData.username = username;
        cachedData.password = password;
        cachedData.searchPath = searchPath;
        cachedData.searchPathList = searchPath?.split?.(",");
        cachedData.cacheFileList = null;
    }
    return (0, webdav_1.createClient)(url, {
        authType: webdav_1.AuthType.Password,
        username,
        password,
    });
}

// 递归收集音频和视频文件
async function getAudioFilesRecursively(client, path, depth = 0) {
    // 防御：最多递归 8 层，避免小雅目录太深卡死
    if (depth > 8) return [];
    let result = [];
    let items;
    try {
        items = await client.getDirectoryContents(path);
    } catch (e) {
        return [];
    }
    for (const it of items) {
        // 同时接受 audio 和 video 类型的文件
        if (it.type === "file" && it.mime && (it.mime.startsWith("audio") || it.mime.startsWith("video"))) {
            result.push(it);
        } else if (it.type === "directory") {
            result = result.concat(
                await getAudioFilesRecursively(client, it.filename, depth + 1)
            );
        }
    }
    return result;
}

async function searchMusic(query) {
    const client = getClient();
    if (!cachedData.cacheFileList) {
        const searchPathList = cachedData.searchPathList?.length
            ? cachedData.searchPathList
            : ["/"];
        let result = [];
        for (let 搜索 of searchPathList) {
            const files = await getAudioFilesRecursively(client, 搜索);
            result = [...result, ...files];
        }
        cachedData.cacheFileList = result;
    }
    return {
        isEnd: true,
        data: (cachedData.cacheFileList ?? [])
            .筛选((it) => it.basename.includes(query))
            .map((it) => ({
                title: it.basename,
                id: it.filename,
                artist: "未知作者",
                album: "未知专辑",
            })),
    };
}

async function getTopLists() {
    getClient();
    const data = {
        title: "全部歌曲",
        data: (cachedData.searchPathList || []).map((it) => ({
            title: it,
            id: it,
        })),
    };
    return [data];
}

async function getTopListDetail(topListItem) {
    const client = getClient();
    const fileItems = await getAudioFilesRecursively(client, topListItem.id);
    return {
        musicList: fileItems.map((it) => ({
            title: it.basename,
            id: it.filename,
            artist: "未知作者",
            album: "未知专辑",
        })),
    };
}

module.exports = {
    platform: "WebDAV",
    作者: "猫头猫（递归增强版）",
    description: "支持多层目录递归扫描、兼容音频与视频的 WebDAV 插件，使用前先配置用户变量",
    userVariables: [
        { key: "url", name: "WebDAV地址" },
        { key: "username", name: "用户名" },
        { key: "password", name: "密码", type: "password" },
        { key: "searchPath", name: "存放歌曲的路径（多个用英文逗号分隔）" },
    ],
    version: "0.2.0",
    supportedSearchType: ["music"],
    srcUrl: "",
    cacheControl: "no-cache",
    搜索(query, page, type) {
        if (type === "music") {
            return searchMusic(query);
        }
    },
    getTopLists,
    getTopListDetail,
    getMediaSource(musicItem) {
        const client = getClient();
        return {
            url: client.getFileDownloadLink(musicItem.id),
        };
    },
};
