"use client";

import { useState, useRef, useEffect } from "react";
import FarmerTopBar from "@/components/FarmerTopBar";
import FarmerNav from "@/components/FarmerNav";
import { Send, Sparkles } from "lucide-react";

type Msg = { role: "user" | "assistant"; text: string };

const SUGGESTIONS = ["When is my turn?", "Payment status?", "Booking status?", "Centre timing?"];

export default function AssistantPage() {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", text: "Namaste! Ask me about your token, queue, procurement, or payment status." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    if (!text.trim()) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/farmer/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "assistant", text: data.reply || "Sorry, I couldn't find that." }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: "Something went wrong. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen pb-24 bg-surface flex flex-col">
      <FarmerTopBar name="Farmer" title="Assistant" />
      <div className="max-w-lg mx-auto w-full px-4 py-4 flex-1 flex flex-col">
        <div className="flex-1 space-y-3 overflow-y-auto">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} animate-rise-in`}>
              {m.role === "assistant" && (
                <span className="w-7 h-7 rounded-full bg-brand-600 text-white flex items-center justify-center shrink-0 mr-2">
                  <Sparkles size={13} />
                </span>
              )}
              <div
                className={`max-w-[78%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.role === "user" ? "bg-brand-600 text-white rounded-br-sm" : "bg-white border border-line rounded-bl-sm"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-xs text-ink-faint pl-9">
              <span className="w-1.5 h-1.5 rounded-full bg-ink-faint animate-pulse-dot" />
              Assistant is typing...
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="flex flex-wrap gap-2 my-3">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => send(s)} className="text-xs px-3 py-1.5 rounded-full border border-line text-ink-soft hover:border-brand-600 hover:text-brand-700 transition-colors">
              {s}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex gap-2"
        >
          <input className="input" placeholder="Type your question..." value={input} onChange={(e) => setInput(e.target.value)} />
          <button type="submit" className="btn-primary !px-4" disabled={loading}>
            <Send size={18} />
          </button>
        </form>
      </div>
      <FarmerNav />
    </main>
  );
}
