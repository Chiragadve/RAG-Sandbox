#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const SERPER_API_KEY = process.env.SERPER_API_KEY;

if (!SERPER_API_KEY) {
    console.error("Error: SERPER_API_KEY environment variable is required");
    process.exit(1);
}

const server = new Server(
    {
        name: "serper-search-server",
        version: "0.1.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// Define the tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "web_search",
                description: "Search the web for real-time information using Google. Use this when the user asks about recent events, facts not in the documents, or general knowledge.",
                inputSchema: {
                    type: "object",
                    properties: {
                        query: {
                            type: "string",
                            description: "The search query optimized for a search engine",
                        },
                        type: {
                            type: "string",
                            enum: ["search", "news", "places"],
                            description: "The type of search to perform (default: search)",
                        },
                    },
                    required: ["query"],
                },
            },
            {
                name: "get_current_time",
                description: "Get the current time and date. Use this when the user asks 'What time is it?', 'What is the date?', or time-relative questions.",
                inputSchema: {
                    type: "object",
                    properties: {},
                },
            },
        ],
    };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === "get_current_time") {
        const now = new Date();
        return {
            content: [
                {
                    type: "text",
                    text: `Current Time: ${now.toLocaleTimeString()}\nCurrent Date: ${now.toLocaleDateString()}\nFull ISO: ${now.toISOString()}`,
                },
            ],
        };
    }



    if (name === "web_search") {
        const { query, type = "search" } = args as { query: string; type?: string };

        try {
            const url = `https://google.serper.dev/${type}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'X-API-KEY': SERPER_API_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ q: query })
            });

            const data: any = await response.json();

            // Format the results into a readable string
            let content = "";

            if (data.organic) {
                content += "Search Results:\n";
                data.organic.slice(0, 5).forEach((result: any, index: number) => {
                    content += `${index + 1}. [${result.title}](${result.link})\n   ${result.snippet}\n\n`;
                });
            }

            if (data.answerBox) {
                content = `Direct Answer: ${data.answerBox.snippet || data.answerBox.answer}\n\n` + content;
            }

            if (data.knowledgeGraph) {
                content = `Knowledge: ${data.knowledgeGraph.title} - ${data.knowledgeGraph.description}\n\n` + content;
            }

            return {
                content: [
                    {
                        type: "text",
                        text: content,
                    },
                ],
            };

        } catch (error: any) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error performing search: ${error.message}`,
                    },
                ],
                isError: true,
            };
        }
    }

    throw new Error(`Tool not found: ${name}`);
});

// Start the server
async function run() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

run().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
});
