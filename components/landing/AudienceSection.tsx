import { Code, FlaskConical, GraduationCap, Wrench } from "lucide-react";

const audiences = [
    { icon: Code, title: "Developers", description: "Building RAG or agent pipelines" },
    { icon: FlaskConical, title: "Researchers", description: "Experimenting with retrieval" },
    { icon: GraduationCap, title: "Students", description: "Learning LLM architecture" },
    { icon: Wrench, title: "Builders", description: "Prototyping assistants" }
];

const AudienceSection = () => {
    return (
        <section className="relative px-6 py-32 bg-muted/30" id="audience">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="text-center mb-16">
                    <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">
                        Built for people who care about{" "}
                        <span className="text-gradient-warm">systems</span>
                    </h2>
                    <p className="text-muted-foreground">Not a consumer toy. A learning and prototyping environment.</p>
                </div>

                {/* Cards */}
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {audiences.map((audience) => (
                        <div
                            key={audience.title}
                            className="group text-center p-8 bg-card rounded-3xl border border-border shadow-soft hover:shadow-elevated hover:-translate-y-1 transition-all duration-300"
                        >
                            <div className="inline-flex p-4 rounded-2xl bg-muted group-hover:bg-primary/10 transition-colors mb-5">
                                <audience.icon className="w-7 h-7 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                            <h3 className="font-display text-xl font-semibold text-foreground mb-2">{audience.title}</h3>
                            <p className="text-sm text-muted-foreground">{audience.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default AudienceSection;
