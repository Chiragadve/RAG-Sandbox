import { Button } from "@/components/ui/button";
import { ArrowRight, BookOpen } from "lucide-react";
import Link from "next/link";

const Hero = () => {
    return (
        <section className="relative min-h-screen flex items-center px-6 py-32 overflow-hidden">
            {/* Decorative elements */}
            <div className="absolute top-20 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-secondary/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 max-w-7xl mx-auto w-full">
                <div className="grid lg:grid-cols-2 gap-16 items-center">
                    {/* Left column - Text */}
                    <div className="animate-fade-up">
                        {/* Eyebrow */}
                        <div className="inline-flex items-center gap-2 mb-8">
                            <span className="w-12 h-px bg-primary" />
                            <span className="text-sm font-medium text-primary uppercase tracking-widest">Experimental Sandbox</span>
                        </div>

                        {/* Headline */}
                        <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
                            <span className="text-foreground">Agentic</span>
                            <br />
                            <span className="text-gradient-warm">RAG Sandbox</span>
                        </h1>

                        {/* Subheadline */}
                        <p className="text-lg md:text-xl text-muted-foreground max-w-lg mb-10 leading-relaxed">
                            Build, test, and reason with your data using agentic retrieval and tools.
                            Extend your assistant with MCP—not prompts.
                        </p>

                        {/* CTAs */}
                        <div className="flex flex-wrap items-center gap-4">
                            <Button variant="hero" size="xl" asChild>
                                <Link href="/sandbox">
                                    Try the Sandbox
                                    <ArrowRight className="w-5 h-5 ml-2" />
                                </Link>
                            </Button>
                            <Button variant="heroOutline" size="xl" asChild>
                                <Link href="/docs#architecture">
                                    <BookOpen className="w-5 h-5 mr-2" />
                                    Architecture
                                </Link>
                            </Button>
                        </div>

                        {/* Stats */}
                        <div className="flex gap-12 mt-16 pt-8 border-t border-border">
                            <div>
                                <div className="font-display text-3xl font-bold text-foreground">Local</div>
                                <div className="text-sm text-muted-foreground">Embeddings</div>
                            </div>
                            <div>
                                <div className="font-display text-3xl font-bold text-foreground">MCP</div>
                                <div className="text-sm text-muted-foreground">Tool Protocol</div>
                            </div>
                            <div>
                                <div className="font-display text-3xl font-bold text-foreground">RLS</div>
                                <div className="text-sm text-muted-foreground">Security</div>
                            </div>
                        </div>
                    </div>

                    {/* Right column - Visual */}
                    <div className="relative animate-fade-up delay-200">
                        <div className="relative bg-card rounded-3xl shadow-elevated p-2 border border-border">
                            {/* Window chrome */}
                            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
                                <div className="w-3 h-3 rounded-full bg-accent/60" />
                                <div className="w-3 h-3 rounded-full bg-primary/60" />
                                <div className="w-3 h-3 rounded-full bg-secondary/60" />
                            </div>

                            <div className="p-6">
                                {/* Chat interface mockup */}
                                <div className="space-y-4">
                                    {/* User message */}
                                    <div className="flex justify-end">
                                        <div className="bg-muted rounded-2xl rounded-tr-md px-4 py-3 max-w-[80%]">
                                            <p className="text-sm text-foreground">What are the key findings from the research paper?</p>
                                        </div>
                                    </div>

                                    {/* Assistant response */}
                                    <div className="flex justify-start">
                                        <div className="bg-background border border-border rounded-2xl rounded-tl-md px-4 py-3 max-w-[85%] shadow-soft">
                                            <p className="text-sm text-foreground mb-3">Based on the retrieved documents, the key findings include three main areas of improvement...</p>

                                            {/* Citations */}
                                            <div className="flex flex-wrap gap-2 pt-3 border-t border-border">
                                                <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                                                    confidence: 0.94
                                                </span>
                                                <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                                                    research.pdf:12
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Tool usage indicator */}
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground pl-2">
                                        <div className="w-4 h-4 rounded border border-secondary/50 flex items-center justify-center">
                                            <div className="w-2 h-2 rounded-sm bg-secondary" />
                                        </div>
                                        <span>Used: vector_search, planner</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Floating accent */}
                        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-primary/20 rounded-2xl rotate-12 -z-10" />
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Hero;
