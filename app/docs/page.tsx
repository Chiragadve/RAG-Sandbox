'use client'

import Link from 'next/link'
import { ArrowLeft, Book, Layers, Database, Code, Shield, Cloud } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function DocsPage() {
    return (
        <div className="min-h-screen bg-background text-foreground font-sans">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-md border-b border-border">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="p-2 hover:bg-primary/10 rounded-full transition-colors">
                            <ArrowLeft className="w-5 h-5 text-muted-foreground hover:text-primary" />
                        </Link>
                        <div className="flex items-center gap-2">
                            <Book className="w-5 h-5 text-primary" />
                            <span className="font-display font-bold text-lg">Documentation</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <Button variant="outline" size="sm" asChild>
                            <Link href="/sandbox">Go to Sandbox</Link>
                        </Button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="pt-24 pb-20 px-6">
                <div className="max-w-4xl mx-auto space-y-16">

                    {/* Introduction */}
                    <section id="introduction" className="space-y-6">
                        <h1 className="text-4xl md:text-5xl font-display font-bold text-gradient-warm">
                            Agentic RAG Platform
                        </h1>
                        <p className="text-xl text-muted-foreground leading-relaxed">
                            A next-generation Retrieval-Augmented Generation system powered by autonomous agents,
                            designed to transform how you interact with your documents through chat and audio.
                        </p>
                    </section>

                    {/* Architecture */}
                    <section id="architecture" className="space-y-8 scroll-mt-24">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-lg bg-primary/10">
                                <Layers className="w-6 h-6 text-primary" />
                            </div>
                            <h2 className="text-3xl font-display font-bold">System Architecture</h2>
                        </div>

                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="p-6 rounded-2xl bg-card border border-border shadow-soft">
                                <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                                    <Database className="w-4 h-4 text-accent" />
                                    Ingestion Layer
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    Handles multi-format document processing (PDF, DOCX, TXT) with robust chunking strategies.
                                    Utilizes vector embeddings stored in Supabase for high-performance semantic search.
                                </p>
                            </div>

                            <div className="p-6 rounded-2xl bg-card border border-border shadow-soft">
                                <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                                    <Shield className="w-4 h-4 text-accent" />
                                    Agentic Core
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    An autonomous orchestrator that analyzes user intent to route queries between
                                    direct retrieval, multi-step reasoning, or external tool usage.
                                </p>
                            </div>

                            <div className="p-6 rounded-2xl bg-card border border-border shadow-soft">
                                <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                                    <Cloud className="w-4 h-4 text-accent" />
                                    Podcast Engine
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    Leverages Groq/Llama for script generation and Cartesia AI for hyper-realistic
                                    voice synthesis to convert static documents into engaging audio conversations.
                                </p>
                            </div>

                            <div className="p-6 rounded-2xl bg-card border border-border shadow-soft">
                                <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                                    <Code className="w-4 h-4 text-accent" />
                                    Frontend Layer
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    Built with Next.js 15, Tailwind CSS, and Framer Motion.
                                    Features a responsive, dark-mode-first UI with real-time updates via Server Actions.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Features */}
                    <section id="capabilities" className="space-y-8 scroll-mt-24">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-lg bg-primary/10">
                                <Code className="w-6 h-6 text-primary" />
                            </div>
                            <h2 className="text-3xl font-display font-bold">Key Capabilities</h2>
                        </div>

                        <div className="space-y-4">
                            <div className="flex gap-4 p-4 rounded-xl hover:bg-card/50 transition-colors border border-transparent hover:border-border">
                                <div className="shrink-0 w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">1</div>
                                <div>
                                    <h3 className="font-bold text-foreground">Advanced RAG Chat</h3>
                                    <p className="text-muted-foreground">Context-aware conversations with citations and source highlighting.</p>
                                </div>
                            </div>

                            <div className="flex gap-4 p-4 rounded-xl hover:bg-card/50 transition-colors border border-transparent hover:border-border">
                                <div className="shrink-0 w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">2</div>
                                <div>
                                    <h3 className="font-bold text-foreground">Audio Generation</h3>
                                    <p className="text-muted-foreground">One-click transformation of technical documents into podcast-style audio summaries.</p>
                                </div>
                            </div>

                            <div className="flex gap-4 p-4 rounded-xl hover:bg-card/50 transition-colors border border-transparent hover:border-border">
                                <div className="shrink-0 w-8 h-8 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center font-bold">3</div>
                                <div>
                                    <h3 className="font-bold text-foreground">Enterprise Security</h3>
                                    <p className="text-muted-foreground">Role-based access control, encrypted storage, and secure authentication flows.</p>
                                </div>
                            </div>
                        </div>
                    </section>

                </div>
            </main>
        </div>
    )
}
