import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";

export type ModelResponse = { type: "message"; content: string } | { type: "tool-call"; toolName: string; args: unknown };

export interface ModelRequest {
  messages: Array<{ role: "system" | "user" | "assistant" | "tool"; content: string; name?: string }>;
  tools: Array<{ name: string; description: string; parameters: unknown }>;
}

export function createLmStudioClient(options: { baseURL?: string; apiKey?: string; model?: string }) {
  const client = new OpenAI({
    baseURL: options.baseURL ?? "http://localhost:1234/v1",
    apiKey: options.apiKey ?? "lm-studio",
  });
  const model = options.model ?? "local-model";

  return {
    async complete(request: ModelRequest): Promise<ModelResponse> {
      const completion = await client.chat.completions.create({
        model,
        messages: request.messages as ChatCompletionMessageParam[],
        tools: request.tools.map((tool): ChatCompletionTool => ({
          type: "function",
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters as Record<string, unknown>,
          },
        })),
      });
      const message = completion.choices[0]?.message;
      const toolCall = message?.tool_calls?.[0];
      if (toolCall?.type === "function") {
        return { type: "tool-call", toolName: toolCall.function.name, args: JSON.parse(toolCall.function.arguments) };
      }
      return { type: "message", content: message?.content ?? "" };
    },
  };
}
