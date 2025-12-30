import { Check, X } from "lucide-react";

const comparisons = [
    { traditional: "Always retrieves", agentic: "Plans before acting" },
    { traditional: "Blind context stuffing", agentic: "Ordered and scored context" },
    { traditional: "No tools", agentic: "MCP based tools" },
    { traditional: "Hallucination prone", agentic: "Refusal when info is missing" },
    { traditional: "Stateless", agentic: "Persistent personal data" }
];

const ComparisonSection = () => {
    return (
        <section className="relative px-6 py-32" id="comparison">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="text-center mb-16">
                    <h2 className="font-display text-4xl md:text-5xl font-bold mb-6">
                        More than a chatbot
                    </h2>
                </div>

                {/* Comparison */}
                <div className="bg-card rounded-3xl border border-border shadow-card overflow-hidden">
                    {/* Header row */}
                    <div className="grid grid-cols-2">
                        <div className="p-6 bg-muted/50 border-r border-border">
                            <h3 className="font-display text-lg font-semibold text-muted-foreground text-center">Traditional RAG</h3>
                        </div>
                        <div className="p-6 bg-primary/5">
                            <h3 className="font-display text-lg font-semibold text-primary text-center">Agentic RAG Sandbox</h3>
                        </div>
                    </div>

                    {/* Rows */}
                    {comparisons.map((row, index) => (
                        <div key={index} className="grid grid-cols-2 border-t border-border">
                            <div className="p-5 flex items-center justify-center gap-3 border-r border-border">
                                <X className="w-4 h-4 text-accent shrink-0" />
                                <span className="text-muted-foreground text-sm">{row.traditional}</span>
                            </div>
                            <div className="p-5 flex items-center justify-center gap-3 bg-primary/5">
                                <Check className="w-4 h-4 text-secondary shrink-0" />
                                <span className="text-foreground font-medium text-sm">{row.agentic}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default ComparisonSection;
