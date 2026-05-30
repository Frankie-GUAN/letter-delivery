// 此刻·此地 — AI润色服务（DeepSeek API）
const AIPolishService = {
  _API_URL: 'https://api.deepseek.com/v1/chat/completions',
  _MODEL: 'deepseek-chat',

  // 构建润色prompt
  _buildPrompt(inputText, mood) {
    const moodGuides = {
      '温柔': '语气轻柔温暖，像在耳边低语，用自然的意象（光、风、叶子）表达情感，句子短而舒缓',
      '俏皮': '语气活泼调皮，带点幽默感，可以用感叹号和轻松的口语，让人会心一笑',
      '深情': '语气真挚深情，表达思念或爱意，可以略带感伤但不过度，真诚动人',
      '怀念': '语气带着淡淡的怀旧感，回忆过去的美好，珍惜当下的感受，温暖而不过分伤感',
      '期待': '语气充满希望和憧憬，面向未来的自己，鼓励、温暖、有力量',
      '感谢': '语气真诚感激，表达对某人或某事发自内心的谢意，朴素而有温度',
    };

    const guide = moodGuides[mood] || moodGuides['温柔'];

    return `你是一位温暖的信件润色师。请将用户的大白话改写成一段有氛围感的短笺。

情绪要求：${guide}

格式要求：
- 3-5句话即可，不要过长
- 不分段，保持一个自然段落
- 保持第一人称
- 不要使用书信格式（不要"亲爱的"、"此致"等）
- 保留用户原文的核心意思和关键细节
- 自然地融入情绪基调

用户原文：
${inputText}

请直接输出润色后的文本，不要加任何说明。`;
  },

  // 调用DeepSeek API进行润色
  async polish(inputText, mood = '温柔') {
    if (!API_KEYS || !API_KEYS.DEEPSEEK) {
      console.warn('DeepSeek API密钥未配置，降级使用本地模板');
      return null;
    }

    const prompt = this._buildPrompt(inputText, mood);

    try {
      const response = await fetch(this._API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEYS.DEEPSEEK}`,
        },
        body: JSON.stringify({
          model: this._MODEL,
          messages: [
            { role: 'system', content: '你是一个温暖有才华的信件润色师，帮助人们把心里话写成动人的短笺。' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.8,
          max_tokens: 300,
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`API请求失败 (${response.status}): ${errText}`);
      }

      const data = await response.json();
      const polished = data.choices?.[0]?.message?.content?.trim();

      if (!polished) {
        throw new Error('API返回内容为空');
      }

      return polished;
    } catch (e) {
      console.warn('AI润色API调用失败，降级使用本地模板:', e.message);
      return null;
    }
  },

  // 带降级的润色：先尝试API，失败则用本地模板
  async polishWithFallback(inputText, mood = '温柔') {
    const result = await this.polish(inputText, mood);
    if (result) return result;

    // 降级到本地模板
    return LEditorTemplates.wrap(inputText, mood);
  },
};
