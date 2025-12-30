'use client'

import { login, signup } from '../auth/actions'
import { useState } from 'react'
import { RocketIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function LoginPage() {
    const [isSignUp, setIsSignUp] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    async function handleSubmit(formData: FormData) {
        setLoading(true)
        setError(null)

        const action = isSignUp ? signup : login
        const result = await action(formData)

        if (result?.error) {
            setError(result.error)
            setLoading(false)
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4 font-sans text-foreground">
            <div className="w-full max-w-md space-y-8 rounded-3xl bg-card p-8 shadow-elevated border border-border">
                <div className="text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                        <RocketIcon className="h-6 w-6 text-primary" />
                    </div>
                    <h2 className="mt-4 text-3xl font-display font-bold tracking-tight text-foreground">
                        {isSignUp ? 'Create an account' : 'Welcome back'}
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Sign in to access your Agentic RAG Platform
                    </p>
                </div>

                <form action={handleSubmit} className="mt-8 space-y-6">
                    <div className="space-y-4">
                        <div>
                            <input
                                id="email-address"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                className="relative block w-full rounded-xl border border-input bg-background/50 py-3 px-4 text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                                placeholder="Email address"
                            />
                        </div>
                        <div>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                className="relative block w-full rounded-xl border border-input bg-background/50 py-3 px-4 text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                                placeholder="Password"
                            />
                        </div>
                    </div>

                    <div>
                        <Button
                            type="submit"
                            disabled={loading}
                            className="cursor-pointer w-full"
                            size="lg"
                        >
                            {loading ? 'Processing...' : (isSignUp ? 'Sign up' : 'Sign in')}
                        </Button>
                    </div>

                    {error && (
                        <div className="text-destructive text-sm text-center bg-destructive/10 p-3 rounded-xl border border-destructive/20">
                            {error}
                        </div>
                    )}
                </form>

                <div className="text-center">
                    <button
                        onClick={() => {
                            setIsSignUp(!isSignUp)
                            setError(null)
                        }}
                        className="cursor-pointer text-sm text-primary hover:text-primary/80 transition-colors font-medium"
                    >
                        {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                    </button>
                </div>
            </div>
        </div>
    )
}
