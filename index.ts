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
        async (location: string) => { return { temperature: 18, condition: 'Heavy Rain', humidity: 75, unit: 'celsius' } }
    );

    const trafficTool = new Tool({
        name: 'getTraffic',
        description: 'Get the current traffic for a specified location',
        input_schema: z.object({
            traffic: z.string().describe('The traffic status for the specified location'),
            status: z.string().describe('The traffic status for the specified location'),
            unit: z.string().describe('The unit of measurement for the traffic status')
        })
    },
        async (weather: string) => { return { traffic: 'Heavy', status: 'Slow', unit: '10 miles per hour' } }
    );

    try {
        const response = await llm
            .addTool(weatherTool)
            .addTool(trafficTool)
            .createMessage(
                [
                    {
                        role: 'user',
                        content: 'What is the weather like in San Francisco? Is the weather affecting the traffic?',
                    },
                ]);

        console.log('Response:', JSON.stringify(response, null, 2));

    } catch (error) {
        console.error('Error:', error);
    }
}

// Run the example
main();
