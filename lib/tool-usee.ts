import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Type definitions
interface Tool {
    name: string;
    description: string;
    input_schema: {
        type: string;
        properties: {
            [key: string]: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
}

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

interface AnthropicRequest {
    model: string;
    max_tokens: number;
    tools?: Tool[];
    messages: Message[];
}

interface AnthropicResponse {
    id: string;
    type: string;
    role: string;
    content: Array<{
        type: string;
        text: string;
    }>;
    model: string;
    stop_reason: string;
    stop_sequence: string | null;
    usage: {
        input_tokens: number;
        output_tokens: number;
    };
}

// Anthropic API client class
class AnthropicClient {
    private apiKey: string;
    private baseURL: string = 'https://api.anthropic.com/v1';
    private version: string = '2023-06-01';

    constructor(apiKey?: string) {
        this.apiKey = apiKey || process.env.ANTHROPIC_API_KEY || '';
        if (!this.apiKey) {
            throw new Error('Anthropic API key is required');
        }
    }

    async createMessage(request: AnthropicRequest): Promise<AnthropicResponse> {
        try {
            const response = await axios.post<AnthropicResponse>(
                `${this.baseURL}/messages`,
                request,
                {
                    headers: {
                        'content-type': 'application/json',
                        'x-api-key': this.apiKey,
                        'anthropic-version': this.version,
                    },
                }
            );
            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(`Anthropic API error: ${error.response?.data?.error?.message || error.message}`);
            }
            throw error;
        }
    }
}

// Example usage
async function main() {
    const client = new AnthropicClient();

    const weatherTool: Tool = {
        name: 'get_weather',
        description: 'Get the current weather in a given location',
        input_schema: {
            type: 'object',
            properties: {
                location: {
                    type: 'string',
                    description: 'The city and state, e.g. San Francisco, CA',
                },
            },
            required: ['location'],
        },
    };

    const request: AnthropicRequest = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        tools: [weatherTool],
        messages: [
            {
                role: 'user',
                content: 'What is the weather like in San Francisco?',
            },
        ],
    };

    try {
        const response = await client.createMessage(request);
        console.log('Response:', JSON.stringify(response, null, 2));
    } catch (error) {
        console.error('Error:', error);
    }
}

// Run the example
main();