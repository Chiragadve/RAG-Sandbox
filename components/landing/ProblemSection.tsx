import { AlertTriangle, XCircle, Shuffle, Ban, Lock } from "lucide-react";

const problems = [
    { icon: Shuffle, text: "Static retrieval with poor recall" },
    { icon: AlertTriangle, text: "Hallucinations when context is weak" },
    { icon: XCircle, text: "No ordering or confidence signals" },
    { icon: Ban, text: "No tools beyond document search" },
    { icon: Lock, text: "No isolation for personal data" }
];

const ProblemSection = () => {
    return (
        <section className="relative px-6 py-32 bg-muted/30" id="problem">
            <div className="max-w-6xl mx-auto">
                <div className="grid lg:grid-cols-2 gap-16 items-center">
                    {/* Left - Statement */}
                    <div>
                        <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-8">
                            Most RAG demos{" "}
                            <span className="relative">
                                break
                                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 100 12" preserveAspectRatio="none">
                                    <path d="M0,8 Q25,0 50,8 T100,8" stroke="hsl(var(--accent))" strokeWidth="3" fill="none" strokeLinecap="round" />
                                </svg>
                            </span>
                            {" "}in real usage.
                        </h2>
                        <p className="text-lg text-muted-foreground leading-relaxed">
                            Generic retrieval systems fail when they hit production complexity.
                            Agentic RAG Sandbox was built to fix these problems at the system level.
                        </p>
                    </div>

                    {/* Right - Problems list */}
                    <div className="space-y-4">
                        {problems.map((problem, index) => (
                            <div
                                key={index}
                                className="group flex items-center gap-5 p-5 bg-card rounded-2xl border border-border shadow-soft hover:shadow-card transition-all duration-300"
                            >
                                <div className="p-3 rounded-xl bg-accent/10 text-accent group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
                                    <problem.icon className="w-5 h-5" />
                                </div>
                                <span className="text-foreground font-medium">{problem.text}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default ProblemSection;
