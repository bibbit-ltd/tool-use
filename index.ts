import { AnthropicClient, type ToolsMap, Tool } from './lib/tool-use';
import z from 'zod';

// Example usage
async function main() {
    const llm = new AnthropicClient();


    const weatherSchema = z.object({
        location: z.string().describe("The city and state, e.g. San Francisco, CA"),
    });

    const weatherTool = new Tool({
        name: 'getWeather',
        description: 'Get the current weather for a specified location',
        input_schema: weatherSchema
    },
        async (location: string) => { return { temperature: 18, condition: 'Partly cloudy', humidity: 75, unit: 'celsius' } }
    );

    try {
        const response = await llm.addTool(weatherTool).createMessage(
            [
                {
                    role: 'user',
                    content: 'What is the weather like in San Francisco?',
                },
            ]);

        console.log('Response:', JSON.stringify(response, null, 2));

    } catch (error) {
        console.error('Error:', error);
    }
}

// Run the example
main();
