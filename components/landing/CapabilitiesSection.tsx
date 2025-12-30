import { Upload, Search, Cpu, Shield } from "lucide-react";

const capabilities = [
    {
        icon: Upload,
        number: "01",
        title: "Intelligent Data Ingestion",
        description: "Upload PDF, DOCX, CSV, JSON, and text files. Context-aware chunking preserves meaning with local embeddings via transformers.js.",
        accent: "primary"
    },
    {
        icon: Search,
        number: "02",
        title: "High Quality Retrieval",
        description: "Adaptive vector search with fallback logic. Ordered context reconstruction with confidence-aware injection and source attribution.",
        accent: "secondary"
    },
    {
        icon: Cpu,
        number: "03",
        title: "Agentic Tool Use",
        description: "Planner-driven decision making with MCP-based tool discovery. Clean separation between reasoning and execution.",
        accent: "primary"
    },
    {
        icon: Shield,
        number: "04",
        title: "Secure & Personal",
        description: "Email/password auth with strict row-level security. Each user's data stays completely isolated.",
        accent: "secondary"
    }
];

const CapabilitiesSection = () => {
    return (
        <section className="relative px-6 py-32" id="capabilities">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="max-w-2xl mb-20">
                    <div className="inline-flex items-center gap-2 mb-6">
                        <span className="w-12 h-px bg-primary" />
                        <span className="text-sm font-medium text-primary uppercase tracking-widest">Capabilities</span>
                    </div>
                    <h2 className="font-display text-4xl md:text-5xl font-bold leading-tight">
                        What you can do with the sandbox
                    </h2>
                </div>

                {/* Capabilities grid */}
                <div className="grid md:grid-cols-2 gap-8">
                    {capabilities.map((capability, index) => (
                        <div
                            key={capability.title}
                            className="group relative p-8 md:p-10 bg-card rounded-3xl border border-border shadow-soft hover:shadow-elevated transition-all duration-500"
                        >
                            {/* Number */}
                            <div className="absolute top-8 right-8 font-display text-6xl font-bold text-muted/50">
                                {capability.number}
                            </div>

                            {/* Icon */}
                            <div className={`
                inline-flex p-4 rounded-2xl mb-6 transition-colors
                ${capability.accent === 'primary' ? 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground' : 'bg-secondary/10 text-secondary group-hover:bg-secondary group-hover:text-secondary-foreground'}
              `}>
                                <capability.icon className="w-6 h-6" />
                            </div>

                            {/* Content */}
                            <h3 className="font-display text-2xl font-semibold text-foreground mb-3">{capability.title}</h3>
                            <p className="text-muted-foreground leading-relaxed">{capability.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default CapabilitiesSection;
