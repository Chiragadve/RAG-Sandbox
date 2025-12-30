import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";

// Singleton to avoid spawning too many processes in dev
// In production serverless, you might need a different strategy (e.g. separate service)
// But for this project, checking the global space works.

let mcpClient: Client | null = null;
let transport: StdioClientTransport | null = null;

export async function getMcpClient() {
    if (mcpClient) return mcpClient;

    const scriptPath = path.resolve(process.cwd(), "scripts/mcp-serper.ts");

    // We use 'ts-node' to run the script. 
    // Make sure 'ts-node' is installed or use 'node' if compiling.
    // For this environment, we'll try running with 'npx ts-node'

    console.log("Starting MCP Server at:", scriptPath);

    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) {
        console.error("CRITICAL CHECK: SERPER_API_KEY is undefined in Next.js backend.");
    } else {
        console.log("CRITICAL CHECK: SERPER_API_KEY found (Starting with " + apiKey.substring(0, 4) + "...)");
    }

    transport = new StdioClientTransport({
        command: "npx",
        args: ["ts-node", scriptPath],
        env: {
            ...process.env,
            SERPER_API_KEY: apiKey as string,
            PATH: process.env.PATH as string
        } as Record<string, string>
    });

    const client = new Client(
        {
            name: "nextjs-client",
            version: "1.0.0",
        },
        {
            capabilities: {},
        }
    );

    await client.connect(transport);
    mcpClient = client;

    console.log("MCP Client Connected");
    return client;
}

export async function listTools() {
    const client = await getMcpClient();
    return await client.listTools();
}

export async function callTool(name: string, args: any) {
    const client = await getMcpClient();
    return await client.callTool({
        name,
        arguments: args
    });
}
