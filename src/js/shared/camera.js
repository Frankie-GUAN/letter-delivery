/**
 * 相机与照片处理模块
 *
 * 职责:
 *   1. 调用设备相机拍照
 *   2. 提取照片视觉特征（用于时光信角度匹配）
 *   3. 生成"褪色老照片"风格预览图
 *
 * Demo阶段所有处理均在本地完成（Canvas + 纯 JS 算法）。
 */

const Camera = (() => {
    /**
     * 调用相机拍照
     * @returns {Promise<string>} base64 data URL
     */
    function takePhoto() {
        return new Promise((resolve, reject) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.capture = 'environment'; // 后置摄像头优先

            input.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return reject(new Error('未选择照片'));

                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(new Error('读取照片失败'));
                reader.readAsDataURL(file);
            };

            input.click();
        });
    }

    /**
     * 提取照片视觉特征
     * 降采样至小尺寸后提取亮度/色相分布，作为角度匹配的指纹
     * @param {string} dataUrl - 照片 base64
     * @returns {Promise<object>} 特征对象
     */
    function extractFeatures(dataUrl) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                // 降采样至 80px 宽
                const scale = 80 / img.width;
                canvas.width = 80;
                canvas.height = Math.round(img.height * scale);
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const pixels = imageData.data;

                // 分区计算亮度
                const zones = { tl: [], tr: [], bl: [], br: [], center: [] };
                const midX = canvas.width / 2;
                const midY = canvas.height / 2;

                for (let y = 0; y < canvas.height; y++) {
                    for (let x = 0; x < canvas.width; x++) {
                        const idx = (y * canvas.width + x) * 4;
                        const r = pixels[idx];
                        const g = pixels[idx + 1];
                        const b = pixels[idx + 2];
                        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

                        const point = { x, y, l: luminance };

                        if (x < midX && y < midY) zones.tl.push(point);
                        else if (x >= midX && y < midY) zones.tr.push(point);
                        else if (x < midX && y >= midY) zones.bl.push(point);
                        else if (x >= midX && y >= midY) zones.br.push(point);

                        if (Math.abs(x - midX) < canvas.width * 0.15 && Math.abs(y - midY) < canvas.height * 0.15) {
                            zones.center.push(point);
                        }
                    }
                }

                // 每区平均亮度
                const features = {};
                for (const [zone, pts] of Object.entries(zones)) {
                    if (pts.length === 0) { features[zone] = 0; continue; }
                    features[zone] = pts.reduce((s, p) => s + p.l, 0) / pts.length;
                }

                // 整体亮度直方图（简化版：5个桶）
                const histogram = [0, 0, 0, 0, 0];
                for (let i = 0; i < pixels.length; i += 4) {
                    const l = 0.299 * pixels[i] + 0.587 * pixels[i+1] + 0.114 * pixels[i+2];
                    const bucket = Math.min(4, Math.floor(l / 51));
                    histogram[bucket]++;
                }
                const total = histogram.reduce((s, v) => s + v, 0) || 1;
                features.histogram = histogram.map(v => v / total);

                resolve(features);
            };
            img.src = dataUrl;
        });
    }

    /**
     * 比对两张照片的视觉特征，返回相似度 (0~1)
     * @param {object} featuresA
     * @param {object} featuresB
     * @returns {number} 0~1 相似度
     */
    function compareFeatures(featuresA, featuresB) {
        // 区域亮度差异
        const zones = ['tl', 'tr', 'bl', 'br', 'center'];
        let zoneDiff = 0;
        for (const z of zones) {
            zoneDiff += Math.abs((featuresA[z] || 0) - (featuresB[z] || 0)) / 255;
        }
        zoneDiff /= zones.length;

        // 直方图差异
        let histDiff = 0;
        for (let i = 0; i < 5; i++) {
            histDiff += Math.abs((featuresA.histogram?.[i] || 0) - (featuresB.histogram?.[i] || 0));
        }
        histDiff /= 2; // 归一化到 0~1

        const totalDiff = (zoneDiff + histDiff) / 2;
        return Math.max(0, 1 - totalDiff);
    }

    /**
     * 生成"褪色老照片"预览图
     * @param {string} dataUrl
     * @returns {Promise<string>} 处理后的 data URL
     */
    function makeFadedPhoto(dataUrl) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');

                // 原图
                ctx.drawImage(img, 0, 0);

                // 褪色：降低饱和度 + 叠暖色
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const d = imageData.data;
                for (let i = 0; i < d.length; i += 4) {
                    const avg = (d[i] + d[i+1] + d[i+2]) / 3;
                    d[i]     = (d[i]   * 0.6 + avg * 0.35 + 30 * 0.05);
                    d[i+1]   = (d[i+1] * 0.6 + avg * 0.30 + 25 * 0.10);
                    d[i+2]   = (d[i+2] * 0.6 + avg * 0.28 + 20 * 0.12);
                }
                ctx.putImageData(imageData, 0, 0);

                // 叠一层噪点
                ctx.globalAlpha = 0.04;
                for (let y = 0; y < canvas.height; y += 4) {
                    for (let x = 0; x < canvas.width; x += 4) {
                        ctx.fillStyle = `rgb(${Math.random()*255},${Math.random()*255},${Math.random()*255})`;
                        ctx.fillRect(x, y, 4, 4);
                    }
                }

                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.src = dataUrl;
        });
    }

    return { takePhoto, extractFeatures, compareFeatures, makeFadedPhoto };
})();
