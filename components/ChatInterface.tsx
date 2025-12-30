'use client'

import { useState, useRef, useEffect } from 'react'
import { chat } from '@/app/actions'
import { Send, Bot, User, Loader2, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Message {
    role: 'user' | 'assistant'
    content: string
    sources?: any[]
}

export default function ChatInterface() {
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: 'Hello! Upload a document on the left, then ask me anything about it.' }
    ])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const scrollRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages])

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!input.trim() || isLoading) return

        const userMsg = input
        setInput('')

        // Optimistic UI update
        const newMessages = [...messages, { role: 'user', content: userMsg } as Message]
        setMessages(newMessages)
        setIsLoading(true)

        try {
            // Pass history (excluding the very last message we just added effectively, 
            // but the API expects 'history' as PREVIOUS messages usually, 
            // or we can pass all and let server slice.
            // Let's pass the valid history (previous messages).
            const history = messages.map(m => ({
                role: m.role,
                content: m.content
            }))

            const response = await chat(userMsg, history)

            if (response.success) {
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: response.message || "",
                    sources: response.sources
                }])
            } else {
                setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${response.error}` }])
            }
        } catch (error) {
            setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong.' }])
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="flex flex-col h-[calc(100vh-120px)] bg-card/30 border border-border rounded-2xl overflow-hidden shadow-soft">
            {/* Messages Area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6">
                {messages.map((m, i) => (
                    <div key={i} className={cn(
                        "flex gap-3 max-w-[90%]",
                        m.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
                    )}>
                        <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm",
                            m.role === 'user' ? "bg-primary text-primary-foreground" : "bg-muted text-foreground border border-border"
                        )}>
                            {m.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                        </div>

                        <div className={cn(
                            "p-4 rounded-2xl text-sm leading-relaxed shadow-sm",
                            m.role === 'user'
                                ? "bg-primary text-primary-foreground rounded-br-none"
                                : "bg-card text-foreground rounded-bl-none border border-border"
                        )}>
                            <p className="whitespace-pre-wrap">{m.content}</p>

                            {/* Sources/Citations */}
                            {m.sources && m.sources.length > 0 && (
                                <div className="mt-4 pt-3 border-t border-border/20">
                                    <p className="text-xs font-semibold opacity-70 mb-2">Sources:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {m.sources.map((s: any, idx: number) => (
                                            <span key={idx} className="text-xs bg-background/20 px-2 py-1 rounded border border-border/20 flex items-center gap-1">
                                                <FileText className="w-3 h-3" />
                                                Match {(s.similarity * 100).toFixed(0)}%
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center border border-border">
                            <Bot className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div className="bg-card p-4 rounded-2xl rounded-bl-none border border-border flex items-center shadow-sm">
                            <Loader2 className="w-5 h-5 text-primary animate-spin" />
                        </div>
                    </div>
                )}
            </div>

            {/* Input Area */}
            <form onSubmit={handleSubmit} className="p-4 bg-card/50 border-t border-border backdrop-blur-sm">
                <div className="relative">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask about your documents..."
                        className="w-full bg-background border border-border text-foreground rounded-xl pl-4 pr-12 py-4 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all shadow-sm placeholder:text-muted-foreground"
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isLoading}
                        className="cursor-pointer absolute right-2 top-2 p-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </div>
            </form>
        </div>
    )
}
