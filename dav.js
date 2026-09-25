"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

const axios = require("axios");

let cachedData = {};

// 规范化 URL 和路径
function normalizeUrl(url) {
    if (!url) return "";
    url = url.replace(/\/+$/, "");
    if (!url.endsWith("/dav")) {
        url = url + "/dav";
    }
    return url;
}

function normalizePath(path) {
    if (!path) return "/";
    path = path.replace(/\/+$/, "");
    if (!path.startsWith("/")) {
        path = "/" + path;
    }
    return path || "/";
}

function getClient() {
    let { url, username, password, searchPath } = env?.getUserVariables?.() ?? {};
    if (!(url && username && password)) {
        return null;
    }
    url = normalizeUrl(url);
    if (searchPath) {
        searchPath = searchPath.replace(/\/+$/, "");
    }
    if (!(cachedData.url === url &&
        cachedData.username === username &&
        cachedData.password === password &&
        cachedData.searchPath === searchPath)) {
        cachedData.url = url;
        cachedData.username = username;
        cachedData.password = password;
        cachedData.searchPath = searchPath;
        cachedData.searchPathList = searchPath?.split?.(",").map(p => p.replace(/\/+$/, ""));
        cachedData.cacheFileList = null;
    }
    return {
        baseUrl: url,
        username,
        password,
    };
}

// 用 axios 发 PROPFIND，返回解析后的文件列表
async function propfind(client, path) {
    path = normalizePath(path);
    const fullUrl = client.baseUrl + path;
    try {
        const res = await axios({
            method: "PROPFIND",
            url: fullUrl,
            headers: {
                "Depth": "1",
                "Content-Type": "application/xml",
            },
            auth: {
                username: client.username,
                password: client.password,
            },
            timeout: 15000,
        });
        return parsePropfindResponse(res.data, path);
    } catch (e) {
        console.log("PROPFIND error:", fullUrl, e?.message);
        return [];
    }
}

// 手动解析 WebDAV XML 响应
function parsePropfindResponse(xml, basePath) {
    if (typeof xml !== "string") return [];
    const results = [];
    // 用正则提取每个 <D:response> 块
    const responseRegex = /<D:response>([\s\S]*?)<\/D:response>/g;
    let match;
    while ((match = responseRegex.exec(xml)) !== null) {
        const block = match[1];
        const hrefMatch = block.match(/<D:href>(.*?)<\/D:href>/);
        if (!hrefMatch) continue;
        let href = decodeURIComponent(hrefMatch[1]);
        // 跳过目录自身
        const normalizedHref = normalizePath(href);
        const normalizedBase = normalizePath(basePath);
        if (normalizedHref === normalizedBase || normalizedHref === normalizedBase + "/") {
            continue;
        }
        // 判断是文件还是目录
        const isCollection = /<D:resourcetype>\s*<D:collection/.test(block);
        const displayNameMatch = block.match(/<D:displayname>(.*?)<\/D:displayname>/);
        const mimeMatch = block.match(/<D:getcontenttype>(.*?)<\/D:getcontenttype>/);
        const displayName = displayNameMatch
            ? displayNameMatch[1]
            : href.split("/").filter(Boolean).pop() || "";
        const mime = mimeMatch ? mimeMatch[1] : "";
        results.push({
            type: isCollection ? "directory" : "file",
            filename: normalizedHref,
            basename: displayName,
            mime: mime,
            href: href,
        });
    }
    return results;
}

// 递归收集音频和视频文件
async function getAudioFilesRecursively(client, path, depth = 0) {
    if (depth > 8) return [];
    let result = [];
    const items = await propfind(client, path);
    for (const it of items) {
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
    if (!client) return { isEnd: true, data: [] };
    if (!cachedData.cacheFileList) {
        const searchPathList = cachedData.searchPathList?.length
            ? cachedData.searchPathList
            : ["/"];
        let result = [];
        for (let search of searchPathList) {
            const files = await getAudioFilesRecursively(client, search);
            result = [...result, ...files];
        }
        cachedData.cacheFileList = result;
    }
    return {
        isEnd: true,
        data: (cachedData.cacheFileList ?? [])
            .filter((it) => it.basename.includes(query))
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
    if (!client) return { musicList: [] };
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
    作者: "猫头猫（axios 重写版）",
    description: "支持多层递归、兼容音视频、绕开 webdav 库兼容性问题的 WebDAV 插件",
    userVariables: [
        { key: "url", name: "WebDAV地址" },
        { key: "username", name: "用户名" },
        { key: "password", name: "密码", type: "password" },
        { key: "searchPath", name: "存放歌曲的路径（多个用英文逗号分隔）" },
    ],
    version: "0.3.0",
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
        if (!client) return { url: "" };
        // 直接用 baseUrl + 文件路径拼下载链接
        return {
            url: client.baseUrl + musicItem.id,
        };
    },
};
