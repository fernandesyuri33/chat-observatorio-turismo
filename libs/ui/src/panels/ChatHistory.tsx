import type { ChatMessage } from "../types";

type Props = {
  messages: ChatMessage[];
};

export function ChatHistory({ messages }: Props) {
  return (
    <div className="chat-history">
      {messages.map((message) => (
        <div key={message.id} className={`chat-message chat-${message.role}`}>
          <span className="chat-role">{message.role === "user" ? "Voce" : "Assistente"}</span>
          <p>{message.content}</p>
        </div>
      ))}
    </div>
  );
}
