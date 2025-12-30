const steps = [
    { label: "Query", description: "User sends a question" },
    { label: "Plan", description: "System decides approach" },
    { label: "Retrieve", description: "Fetch relevant context" },
    { label: "Execute", description: "Run MCP tools if needed" },
    { label: "Respond", description: "Grounded, cited answer" }
];

const HowItWorksSection = () => {
    return (
        <section className="relative px-6 py-32 bg-foreground text-background" id="how-it-works">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="text-center mb-20">
                    <h2 className="font-display text-4xl md:text-5xl font-bold mb-6">
                        How the system thinks
                    </h2>
                    <p className="text-background/70 text-lg max-w-2xl mx-auto">
                        Instead of forcing every query through retrieval, the system plans first,
                        retrieves only when needed, and uses tools when documents aren't enough.
                    </p>
                </div>

                {/* Flow */}
                <div className="relative">
                    {/* Connection line */}
                    <div className="hidden md:block absolute top-1/2 left-0 right-0 h-px bg-background/20 -translate-y-1/2" />

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                        {steps.map((step, index) => (
                            <div key={step.label} className="relative text-center">
                                {/* Step circle */}
                                <div className="relative z-10 w-16 h-16 mx-auto mb-4 rounded-full bg-background/10 border-2 border-background/30 flex items-center justify-center">
                                    <span className="font-display text-xl font-bold">{index + 1}</span>
                                </div>

                                <h4 className="font-display text-lg font-semibold mb-1">{step.label}</h4>
                                <p className="text-sm text-background/60">{step.description}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Detail cards */}
                <div className="grid md:grid-cols-3 gap-6 mt-20">
                    {[
                        { title: "Planning First", desc: "The planner evaluates each query to decide if retrieval, tools, or direct response is best." },
                        { title: "Confidence Scoring", desc: "Context is assembled with confidence scores, allowing the LLM to weight information appropriately." },
                        { title: "Ordered Context", desc: "Retrieved chunks are ordered for coherent narrative flow, not random context stuffing." }
                    ].map((card) => (
                        <div key={card.title} className="p-6 rounded-2xl bg-background/5 border border-background/10">
                            <h4 className="font-display text-lg font-semibold mb-2">{card.title}</h4>
                            <p className="text-sm text-background/60 leading-relaxed">{card.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default HowItWorksSection;
