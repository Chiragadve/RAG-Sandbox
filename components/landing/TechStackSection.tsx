const techStack = [
    { name: "Supabase", role: "Auth, storage, pgvector" },
    { name: "transformers.js", role: "Local embeddings" },
    { name: "Groq", role: "Fast inference" },
    { name: "MCP", role: "Tool interfaces" },
    { name: "Next.js", role: "Frontend" }
];

const TechStackSection = () => {
    return (
        <section className="relative px-6 py-32" id="tech-stack">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="text-center mb-16">
                    <div className="inline-flex items-center gap-2 mb-6 justify-center">
                        <span className="w-12 h-px bg-primary" />
                        <span className="text-sm font-medium text-primary uppercase tracking-widest">Tech Stack</span>
                        <span className="w-12 h-px bg-primary" />
                    </div>
                    <h2 className="font-display text-3xl md:text-4xl font-bold">
                        Built with modern, inspectable tech
                    </h2>
                </div>

                {/* Stack */}
                <div className="flex flex-wrap justify-center gap-4">
                    {techStack.map((tech) => (
                        <div
                            key={tech.name}
                            className="group flex items-center gap-4 px-6 py-4 bg-card rounded-full border border-border shadow-soft hover:shadow-card hover:border-primary/30 transition-all duration-300"
                        >
                            <span className="font-display font-semibold text-foreground">{tech.name}</span>
                            <span className="text-xs text-muted-foreground">{tech.role}</span>
                        </div>
                    ))}
                </div>

                {/* Flow */}
                <div className="mt-12 text-center">
                    <p className="inline-block px-6 py-3 rounded-full bg-muted text-sm text-muted-foreground font-mono">
                        Client → Edge Functions → Vector DB → LLM → Response
                    </p>
                </div>
            </div>
        </section>
    );
};

export default TechStackSection;
