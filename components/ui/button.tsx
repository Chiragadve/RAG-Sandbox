import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
    "cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
    {
        variants: {
            variant: {
                default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-soft hover:shadow-elevated hover:-translate-y-0.5",
                destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
                outline: "border-2 border-foreground/20 bg-transparent hover:bg-foreground/5 text-foreground",
                secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/90",
                ghost: "hover:bg-muted text-foreground",
                link: "text-primary underline-offset-4 hover:underline",
                hero: "bg-foreground text-background font-semibold hover:bg-foreground/90 shadow-elevated hover:shadow-[0_25px_100px_-30px_hsl(30_30%_20%/0.25)] hover:-translate-y-1 active:translate-y-0",
                heroOutline: "border-2 border-foreground/30 text-foreground hover:bg-foreground hover:text-background",
            },
            size: {
                default: "h-11 px-6 py-2",
                sm: "h-9 px-4",
                lg: "h-13 px-8 text-base",
                xl: "h-14 px-10 text-base",
                icon: "h-10 w-10",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    },
);

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : "button";
        return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
    },
);
Button.displayName = "Button";

export { Button, buttonVariants };
