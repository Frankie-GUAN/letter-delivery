/**
 * 数据持久化层 (Data Persistence Layer)
 *
 * 负责所有本地数据的增删改查。
 * Demo阶段仅使用 localStorage，后续可迁至 IndexedDB。
 *
 * 数据模型:
 *   letters[]      - 所有信件
 *   echoes[]       - 回响物件
 *   timeLetters[]  - 时光信
 *   userStats{}    - 用户统计
 */

const Storage = (() => {
    const PREFIX = 'unsent_';

    // ========== 基础方法 ==========

    function get(key) {
        try {
            const raw = localStorage.getItem(PREFIX + key);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            console.warn('[Storage] 读取失败:', key, e);
            return null;
        }
    }

    function set(key, value) {
        try {
            localStorage.setItem(PREFIX + key, JSON.stringify(value));
        } catch (e) {
            console.warn('[Storage] 写入失败:', key, e);
        }
    }

    function remove(key) {
        try {
            localStorage.removeItem(PREFIX + key);
        } catch (e) {
            console.warn('[Storage] 删除失败:', key, e);
        }
    }

    // ========== 信件 (Letters) ==========

    function getLetters() {
        return get('letters') || [];
    }

    function saveLetter(letter) {
        const letters = getLetters();
        letters.unshift(letter);
        set('letters', letters);
        return letter;
    }

    function getLetterById(id) {
        const letters = getLetters();
        return letters.find(l => l.id === id) || null;
    }

    // ========== 回响 (Echoes) ==========

    function getEchoes() {
        return get('echoes') || {};
    }

    function addEcho(letterId, echoType) {
        const echoes = getEchoes();
        if (!echoes[letterId]) echoes[letterId] = { stone: 0, leaf: 0, lamp: 0, dandelion: 0, drop: 0 };
        echoes[letterId][echoType] = (echoes[letterId][echoType] || 0) + 1;
        set('echoes', echoes);
        return echoes[letterId];
    }

    function getEchoesForLetter(letterId) {
        const echoes = getEchoes();
        return echoes[letterId] || { stone: 0, leaf: 0, lamp: 0, dandelion: 0, drop: 0 };
    }

    // ========== 时光信 (Time Letters) ==========

    function getTimeLetters() {
        return get('timeLetters') || [];
    }

    function saveTimeLetter(timeLetter) {
        const list = getTimeLetters();
        list.unshift(timeLetter);
        set('timeLetters', list);
        return timeLetter;
    }

    function getTimeLetterById(id) {
        const list = getTimeLetters();
        return list.find(l => l.id === id) || null;
    }

    function unlockTimeLetter(id, photoDataUrl) {
        const list = getTimeLetters();
        const item = list.find(l => l.id === id);
        if (item) {
            item.unlocked = true;
            item.unlockPhoto = photoDataUrl;
            item.unlockedAt = Date.now();
            set('timeLetters', list);
        }
        return item;
    }

    // ========== 用户统计 ==========

    function getUserStats() {
        return get('stats') || { lettersSent: 0, echoesGiven: 0, timeLettersCreated: 0 };
    }

    function incrementStat(key) {
        const stats = getUserStats();
        stats[key] = (stats[key] || 0) + 1;
        set('stats', stats);
        return stats;
    }

    // ========== 草稿 ==========

    function getDrafts() {
        return get('drafts') || [];
    }

    function saveDraft(draft) {
        const drafts = getDrafts();
        drafts.unshift(draft);
        set('drafts', drafts);
        return draft;
    }

    function deleteDraft(id) {
        const drafts = getDrafts().filter(d => d.id !== id);
        set('drafts', drafts);
        return drafts;
    }

    function getDraftById(id) {
        return getDrafts().find(d => d.id === id) || null;
    }

    return {
        getLetters,
        saveLetter,
        getLetterById,
        getEchoes,
        addEcho,
        getEchoesForLetter,
        getTimeLetters,
        saveTimeLetter,
        getTimeLetterById,
        unlockTimeLetter,
        getUserStats,
        incrementStat,
        getDrafts,
        saveDraft,
        deleteDraft,
        getDraftById
    };
})();
