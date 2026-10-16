// Minimal types for WebMCP (navigator.modelContext), a browser API that lets an AI agent call tools a page registers.
// Spec draft: https://webmachinelearning.github.io/webmcp/. Only the parts Scam Shield uses.
export interface ToolContent { type: "text"; text: string }
export interface ToolResult { content: ToolContent[]; isError?: boolean }

export interface ModelContextTool {
  name: string;
  description: string;
  /** JSON Schema for the arguments. */
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean };
  execute(input: Record<string, unknown>, client?: unknown): Promise<ToolResult>;
}

export interface ModelContext {
  registerTool?(tool: ModelContextTool): unknown;
  provideContext?(context: { tools: ModelContextTool[] }): unknown;
}

declare global {
  interface Navigator {
    modelContext?: ModelContext;
  }
}
