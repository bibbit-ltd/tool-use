import axios from 'axios';
import dotenv from 'dotenv';
import zodToJsonSchema from 'zod-to-json-schema';

dotenv.config();

// Types
export type ToolUse = {
    type: 'tool_use';
    id: string;
    name: string;
    input: Record<string, any>;
}

export type TextContent = {
    type: 'text';
    text: string;
}

export type AnthropicResponse = {
    id: string;
    model: string;
    stop_reason: 'tool_use' | 'end_turn' | string;
    role: 'assistant' | 'user';
    content: (TextContent | ToolUse)[];
}

export type ToolResult = {
    type: 'tool_result';
    tool_use_id: string;
    content: string;
}

export type AnthropicRequest = {
    model: string;
    max_tokens: number;
    tools: ToolSchema[];
    messages: {
        role: 'assistant' | 'user';
        content: string | (TextContent | ToolUse | ToolResult)[];
        id?: string;
        tool_choice?: { type: string, name: string }
    }[];
}

export type ToolFunction = (input: any) => Promise<any>;
export type ToolSchema = { name: string, description: string, input_schema: any };

// Add this type near your other type definitions
export type ToolDefinition = {
    schema: ToolSchema;
    toolFunction: ToolFunction;
};

// Update the ToolsMap type
export type ToolsMap = Map<string, ToolDefinition>;

/**
 * A tool is a function that can be used to call a tool.
 * @example
 * const tool = new Tool({ name: 'getWeather', description: 'Get the current weather for a specified location', input_schema: z.object({ location: z.string().describe('The city and state, e.g. San Francisco, CA'), unit: z.string().optional().describe('The unit of measurement, e.g. celsius, fahrenheit' ) }) }, weatherFunction);
 */
export class Tool {
    schema: ToolSchema;
    toolFunction: ToolFunction;

    constructor(schema: ToolSchema, toolFunction: ToolFunction) {
        this.schema = schema;
        this.toolFunction = toolFunction;
    }

    getSchema() {
        const input_schema = zodToJsonSchema(this.schema.input_schema, { target: 'openAi' });
        delete input_schema.$schema;
        delete input_schema.definitions;

        return {
            "name": this.schema.name,
            "description": this.schema.description,
            "input_schema": input_schema
        }
    }

    getToolFunction() {
        return this.toolFunction;
    }
}

// Anthropic Client Class
export class AnthropicClient {
    private apiKey?: string;
    private baseURL: string = 'https://api.anthropic.com/v1';
    private version: string = '2023-06-01';
    private tools: ToolsMap = new Map();
    private model: string = 'claude-3-5-sonnet-20241022';
    private maxTokens: number = 1024;
    private messages: AnthropicRequest['messages'] = [];

    constructor(apiKey?: string, model?: string, maxTokens?: number) {
        this.apiKey = apiKey || process.env.ANTHROPIC_API_KEY || '';
        if (!this.apiKey) {
            throw new Error('Anthropic API key is required');
        }
        this.model = model || this.model;
        this.maxTokens = maxTokens || this.maxTokens;
    }

    addTool(tool: Tool) {
        this.tools.set(tool.schema.name, { schema: tool.getSchema(), toolFunction: tool.getToolFunction() });
        return this;
    }

    async createMessage(messages: AnthropicRequest['messages']): Promise<AnthropicResponse> {
        // Reset conversation if it's a new user message
        if (messages.length === 1 && messages[0].role === 'user') {
            this.messages = [];
        }

        this.messages = [...this.messages, ...messages];

        try {
            console.log('\n🔵 Sending message to Anthropic:', JSON.stringify(this.messages, null, 2));

            const request: AnthropicRequest = {
                model: this.model,
                max_tokens: this.maxTokens,
                tools: Array.from(this.tools.values()).map(tool => tool.schema),
                messages: this.messages
            }
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

            console.log('\n🟣 Received response from Anthropic:', JSON.stringify(response.data, null, 2));
            return await this.handleResponse(response.data);
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const errorMessage = error.response?.data?.error?.message || error.message;
                console.error('\n🔴 Error:', errorMessage);
                throw new Error(`Anthropic API error: ${errorMessage}`);
            }
            throw error;
        }
    }

    private async handleResponse(response: AnthropicResponse): Promise<AnthropicResponse> {
        if (response.stop_reason !== 'tool_use') {
            console.log('\n🟢 Final response (no tools to call):', JSON.stringify(response, null, 2));
            return response;
        }

        console.log('\n🟡 Tool use requested, processing tools...');

        const toolUses = response.content.filter((content): content is ToolUse =>
            content.type === 'tool_use'
        );

        // Execute all tools in parallel
        const toolResults = await Promise.all(toolUses.map(async (toolUse) => {
            console.log(`\n🔧 Executing tool: ${toolUse.name}`, JSON.stringify(toolUse, null, 2));
            const result = await this.handleTool(toolUse);
            console.log(`\n✅ Tool result for ${toolUse.name}:`, JSON.stringify(result, null, 2));

            return {
                role: 'user' as const,
                content: [{
                    type: 'tool_result' as const,
                    tool_use_id: toolUse.id,
                    content: typeof result === 'string' ? result : JSON.stringify(result)
                }]
            };
        }));

        console.log('\n🔄 Continuing conversation with tool results...');

        // Only send tool results, not the last message
        return await this.createMessage(toolResults);
    }

    private async handleTool(toolUse: ToolUse): Promise<any> {
        const tool = this.tools.get(toolUse.name)
        if (!tool) {
            throw new Error(`Unknown tool: ${toolUse.name}`);
        }
        return await tool.toolFunction(toolUse.input);
    }
}

