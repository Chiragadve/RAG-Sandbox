import { Button } from "@/components/ui/button";
import { Cpu, Menu, X } from "lucide-react";
import { useState } from "react";
import Link from "next/link";

const Navbar = () => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4">
            <div className="max-w-6xl mx-auto flex items-center justify-between bg-card/90 backdrop-blur-xl rounded-full border border-border shadow-soft px-6 py-3">
                {/* Logo */}
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-primary/10">
                        <Cpu className="w-5 h-5 text-primary" />
                    </div>
                    <span className="font-display font-bold text-foreground">Agentic RAG</span>
                </div>

                {/* Desktop nav */}
                <div className="hidden md:flex items-center gap-8">
                    {["Capabilities", "How It Works", "Tech Stack"].map((item) => (
                        <a
                            key={item}
                            href={`#${item.toLowerCase().replace(/\s+/g, '-')}`}
                            className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        >
                            {item}
                        </a>
                    ))}
                    <Link
                        href="/docs"
                        className="cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Docs
                    </Link>
                    <Link
                        href="/docs#architecture"
                        className="cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Architecture
                    </Link>
                </div>

                {/* CTA */}
                <div className="hidden md:block">
                    <Button variant="default" size="sm" asChild>
                        <Link href="/sandbox">Try Sandbox</Link>
                    </Button>
                </div>

                {/* Mobile toggle */}
                <button
                    className="md:hidden p-2 text-foreground"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
            </div>

            {/* Mobile menu */}
            {isOpen && (
                <div className="md:hidden absolute top-full left-6 right-6 mt-2 bg-card border border-border rounded-2xl shadow-elevated p-4 animate-fade-in">
                    <div className="flex flex-col gap-4">
                        {["Capabilities", "How It Works", "Tech Stack"].map((item) => (
                            <a
                                key={item}
                                href={`#${item.toLowerCase().replace(/\s+/g, '-')}`}
                                className="text-sm text-muted-foreground hover:text-foreground transition-colors py-2 cursor-pointer"
                                onClick={() => setIsOpen(false)}
                            >
                                {item}
                            </a>
                        ))}
                        <Link
                            href="/docs"
                            className="cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
                            onClick={() => setIsOpen(false)}
                        >
                            Docs
                        </Link>
                        <Link
                            href="/docs#architecture"
                            className="cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
                            onClick={() => setIsOpen(false)}
                        >
                            Architecture
                        </Link>
                        <Button variant="default" size="sm" className="mt-2" asChild>
                            <Link href="/sandbox">Try Sandbox</Link>
                        </Button>
                    </div>
                </div>
            )}
        </nav>
    );
};

export default Navbar;
