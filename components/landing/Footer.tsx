import { Github, FileText, BookOpen } from "lucide-react";
import Link from "next/link";

const Footer = () => {
    return (
        <footer className="relative px-6 py-12 border-t border-border">
            <div className="max-w-6xl mx-auto">
                <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                    {/* Logo */}
                    <div className="text-center md:text-left">
                        <h3 className="font-display text-lg font-bold text-foreground mb-1">Agentic RAG Sandbox</h3>
                        <p className="text-sm text-muted-foreground">Experimental sandbox for agentic RAG systems.</p>
                    </div>

                    {/* Links */}
                    <div className="flex items-center gap-8">
                        <a
                            href="https://github.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                        >
                            <Github className="w-4 h-4" />
                            GitHub
                        </a>
                        <Link
                            href="/docs"
                            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                        >
                            <FileText className="w-4 h-4" />
                            Docs
                        </Link>
                        <Link
                            href="/docs#architecture"
                            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                        >
                            <BookOpen className="w-4 h-4" />
                            Architecture
                        </Link>
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-border text-center">
                    <p className="text-xs text-muted-foreground">
                        Experimental sandbox for learning and prototyping. Not intended for production use.
                    </p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
