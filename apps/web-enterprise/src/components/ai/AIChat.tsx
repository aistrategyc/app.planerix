"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, SendHorizontal } from "lucide-react"
import { AIChatMessage, sendAIChatMessage } from "@/lib/api/ai"

type ChatMessage = AIChatMessage & {
  sources?: Record<string, unknown>[]
  widgetData?: Record<string, unknown>
}

const renderTable = (rows: Record<string, unknown>[]) => {
  if (!rows.length) return null
  const columns = Object.keys(rows[0] || {})
  return (
    <div className="mt-3 overflow-auto glass-table">
      <table className="min-w-full text-xs">
        <thead className="text-muted-foreground">
          <tr>
            {columns.map((col) => (
              <th key={col} className="px-3 py-2 text-left font-semibold text-muted-foreground">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx} className={idx % 2 === 0 ? "bg-card/80" : "bg-muted/40"}>
              {columns.map((col) => (
                <td key={col} className="px-3 py-2 text-foreground">
                  {row[col] === null || row[col] === undefined ? "—" : String(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function AIChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)

  const history = useMemo(
    () => messages.map((msg) => ({ role: msg.role, content: msg.content })),
    [messages]
  )

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return

    setMessages((prev) => [...prev, { role: "user", content: text }])
    setInput("")
    setLoading(true)

    try {
      const response = await sendAIChatMessage(text, history)
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: response.answer,
          sources: response.sources,
          widgetData: response.widget_data,
        },
      ])
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "❌ Ошибка при получении ответа от агента." },
      ])
    } finally {
      setLoading(false)
    }
  }, [history, input, loading])

  useEffect(() => {
    const el = chatRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
  }, [messages, loading])

  return (
    <div className="flex flex-col gap-4">
      <div
        ref={chatRef}
        className="flex-1 glass-card p-4 overflow-y-auto max-h-[60vh] space-y-4"
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] px-4 py-2 rounded-xl text-sm shadow-sm ${
                msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-card/90 border border-border/60"
              }`}
            >
              {msg.content}
              {msg.widgetData?.items && Array.isArray(msg.widgetData.items)
                ? renderTable(msg.widgetData.items as Record<string, unknown>[])
                : null}
              {msg.sources && msg.sources.length > 0 ? (
                <div className="mt-3 text-xs text-muted-foreground">
                  <div className="font-semibold text-foreground mb-1">Источники</div>
                  <ul className="list-disc pl-4 space-y-1">
                    {msg.sources.map((source, idx) => (
                      <li key={idx}>
                        {source.title ? String(source.title) : "Insight"}{" "}
                        {source.widget_key ? `(${source.widget_key})` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        ))}
        {loading && (
          <div className="text-sm text-muted-foreground animate-pulse">
            ⏳ AI обрабатывает ваш запрос…
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Задай вопрос: «Какой канал дал лучший ROAS?»"
          className="flex-1"
          disabled={loading}
        />
        <Button onClick={sendMessage} disabled={loading || !input.trim()} className="gap-2">
          {loading ? <Loader2 size={18} className="animate-spin" /> : <SendHorizontal size={18} />}
          <span className="hidden sm:inline">Отправить</span>
        </Button>
      </div>
    </div>
  )
}
