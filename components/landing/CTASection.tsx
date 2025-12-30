import { Button } from "@/components/ui/button";
import { ArrowRight, BookOpen } from "lucide-react";
import Link from "next/link";

const CTASection = () => {
    return (
        <section className="relative px-6 py-32 overflow-hidden">
            {/* Background accent */}
            <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/5 to-background pointer-events-none" />

            <div className="relative z-10 max-w-3xl mx-auto text-center">
                <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
                    Experiment with agentic RAG{" "}
                    <span className="text-gradient-warm">the right way.</span>
                </h2>

                <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto">
                    A transparent, secure, and extensible environment for building retrieval augmented generation systems.
                </p>

                {/* CTAs */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Button variant="hero" size="xl" asChild>
                        <Link href="/sandbox">
                            Launch Sandbox
                            <ArrowRight className="w-5 h-5 ml-2" />
                        </Link>
                    </Button>
                    <Button variant="heroOutline" size="lg">
                        <BookOpen className="w-5 h-5 mr-2" />
                        Read the Docs
                    </Button>
                </div>
            </div>
        </section>
    );
};

export default CTASection;
