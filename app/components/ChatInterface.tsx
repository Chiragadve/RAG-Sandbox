'use client'

import { useState, useRef, useEffect } from 'react'
import { chat } from '../actions'
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
        setMessages(prev => [...prev, { role: 'user', content: userMsg }])
        setIsLoading(true)

        try {
            const response = await chat(userMsg)

            if (response.success) {
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: response.message,
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
        <div className="flex flex-col h-[calc(100vh-120px)] bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
            {/* Messages Area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6">
                {messages.map((m, i) => (
                    <div key={i} className={cn(
                        "flex gap-3 max-w-[90%]",
                        m.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
                    )}>
                        <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                            m.role === 'user' ? "bg-blue-600" : "bg-purple-600"
                        )}>
                            {m.role === 'user' ? <User className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-white" />}
                        </div>

                        <div className={cn(
                            "p-4 rounded-2xl text-sm leading-relaxed",
                            m.role === 'user'
                                ? "bg-blue-600 text-white rounded-br-none"
                                : "bg-gray-800 text-gray-100 rounded-bl-none border border-gray-700"
                        )}>
                            <p className="whitespace-pre-wrap">{m.content}</p>

                            {/* Sources/Citations */}
                            {m.sources && m.sources.length > 0 && (
                                <div className="mt-4 pt-3 border-t border-gray-700/50">
                                    <p className="text-xs font-semibold text-gray-400 mb-2">Sources:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {m.sources.map((s: any, idx: number) => (
                                            <span key={idx} className="text-xs bg-gray-900/50 text-gray-400 px-2 py-1 rounded border border-gray-700 flex items-center gap-1">
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
                        <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center">
                            <Bot className="w-5 h-5 text-white" />
                        </div>
                        <div className="bg-gray-800 p-4 rounded-2xl rounded-bl-none border border-gray-700 flex items-center">
                            <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                        </div>
                    </div>
                )}
            </div>

            {/* Input Area */}
            <form onSubmit={handleSubmit} className="p-4 bg-gray-900 border-t border-gray-800">
                <div className="relative">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask about your documents..."
                        className="w-full bg-gray-950 border border-gray-800 text-gray-100 rounded-xl pl-4 pr-12 py-4 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isLoading}
                        className="absolute right-2 top-2 p-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </div>
            </form>
        </div>
    )
}
