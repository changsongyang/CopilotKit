import { useState } from "react";
import { Message, Function, FunctionCallHandler } from "../types";
import { nanoid } from "nanoid";
import { ChatCompletionClient } from "../openai/chat-completion-client";

export type UseChatOptions = {
  /**
   * The API endpoint that accepts a `{ messages: Message[] }` object and returns
   * a stream of tokens of the AI chat response. Defaults to `/api/chat`.
   */
  api?: string;
  /**
   * A unique identifier for the chat. If not provided, a random one will be
   * generated. When provided, the `useChat` hook with the same `id` will
   * have shared states across components.
   */
  id?: string;
  /**
   * System messages of the chat. Defaults to an empty array.
   */
  systemMessages?: Message[];
  /**
   * Callback function to be called when a function call is received.
   * If the function returns a `ChatRequest` object, the request will be sent
   * automatically to the API and will be used to update the chat.
   */
  onFunctionCall?: FunctionCallHandler;
  /**
   * HTTP headers to be sent with the API request.
   */
  headers?: Record<string, string> | Headers;
  /**
   * Extra body object to be sent with the API request.
   * @example
   * Send a `sessionId` to the API along with the messages.
   * ```js
   * useChat({
   *   body: {
   *     sessionId: '123',
   *   }
   * })
   * ```
   */
  body?: object;
  /**
   * Function definitions to be sent to the API.
   */
  functions?: Function[];
};

type UseChatHelpers = {
  /** Current messages in the chat */
  messages: Message[];
  /**
   * Append a user message to the chat list. This triggers the API call to fetch
   * the assistant's response.
   * @param message The message to append
   */
  append: (message: Message) => Promise<void>;
  /**
   * Reload the last AI chat response for the given chat history. If the last
   * message isn't from the assistant, it will request the API to generate a
   * new response.
   */
  reload: () => Promise<void>;
  /**
   * Abort the current request immediately, keep the generated tokens if any.
   */
  stop: () => void;
  /** The current value of the input */
  input: string;
  /** setState-powered method to update the input value */
  setInput: React.Dispatch<React.SetStateAction<string>>;
  /** Whether the API request is in progress */
  isLoading: boolean;
};

export function useChat(options: UseChatOptions): UseChatHelpers {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const runChatCompletion = async (): Promise<Message> => {
    return new Promise<Message>((resolve, reject) => {
      setIsLoading(true);

      // Note: The runChatCompletion function closes over the messages state variable.
      // This means that messages will stay static throughout the lifetime of the function.
      // The rest of the code in this function will use the messages variable as it was
      // when runChatCompletion was called.
      const assistantMessage: Message = {
        id: nanoid(),
        createdAt: new Date(),
        content: "",
        role: "assistant",
      };

      // Assistant messages are always copied when using setState
      setMessages([...messages, { ...assistantMessage }]);

      const messagesWithContext = [...(options.systemMessages || []), ...messages];

      const client = new ChatCompletionClient({
        url: options.api || "/api/copilotkit/openai",
      });

      const cleanup = () => {
        client.off("content");
        client.off("end");
        client.off("error");
        client.off("function");
      };

      client.on("content", (content) => {
        assistantMessage.content += content;
        setMessages([...messages, { ...assistantMessage }]);
      });

      client.on("end", () => {
        setIsLoading(false);
        cleanup();
        resolve({ ...assistantMessage });
      });

      client.on("error", (error) => {
        setIsLoading(false);
        cleanup();
        reject(error);
      });

      client.on("function", async (functionCall) => {
        assistantMessage.function_call = functionCall;
        setMessages([...messages, { ...assistantMessage }]);
        // quit early if we get a function call
        setIsLoading(false);
        cleanup();
        resolve({ ...assistantMessage });
      });

      client.fetch({
        messages: messagesWithContext,
        functions: options.functions,
        headers: options.headers,
      });
    });
  };

  const runChatCompletionAndHandleFunctionCall = async (): Promise<void> => {
    const message = await runChatCompletion();
    if (message.function_call && options.onFunctionCall) {
      await options.onFunctionCall(messages, message.function_call);
    }
  };

  const append = async (message: Message): Promise<void> => {
    if (isLoading) {
      return;
    }
    setMessages([...messages, message]);
    return runChatCompletionAndHandleFunctionCall();
  };

  const reload = async (): Promise<void> => {
    if (isLoading || messages.length === 0) {
      return;
    }
    const lastMessage = messages[messages.length - 1];

    if (lastMessage.role === "assistant") {
      setMessages(messages.slice(0, -1));
    }

    return runChatCompletionAndHandleFunctionCall();
  };

  const stop = (): void => {
    throw new Error("Not implemented");
  };

  return {
    messages,
    append,
    reload,
    stop,
    isLoading,
    input,
    setInput,
  };
}
