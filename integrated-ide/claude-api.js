const axios = require('axios');

class ClaudeAPI {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseURL = 'https://api.anthropic.com/v1';
    }

    async sendMessage(message) {
        try {
            const response = await axios.post(
                `${this.baseURL}/messages`,
                {
                    model: 'claude-3-opus-20240229',
                    max_tokens: 1024,
                    messages: [{
                        role: 'user',
                        content: message
                    }]
                },
                {
                    headers: {
                        'x-api-key': this.apiKey,
                        'anthropic-version': '2023-06-01',
                        'content-type': 'application/json'
                    }
                }
            );

            return response.data.content[0].text;
        } catch (error) {
            console.error('Claude API 오류:', error.response?.data || error.message);
            throw error;
        }
    }
}

module.exports = ClaudeAPI;