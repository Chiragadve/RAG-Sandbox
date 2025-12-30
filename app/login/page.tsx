'use client'

import { login, signup, signInWithGoogle } from '../auth/actions'
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

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-border" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <Button
                            variant="outline"
                            type="button"
                            onClick={() => signInWithGoogle()}
                            className="cursor-pointer w-full h-12 relative group overflow-hidden border-border/50 hover:border-primary/50 hover:bg-muted/20 transition-all duration-300"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                            <svg className="mr-3 h-5 w-5" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                                <path fill="#4285F4" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
                                <path fill="#34A853" d="M248 504c70.6 0 131-23.7 175.6-64.4l-64.2-54.8c-21.6 14.9-50.5 24.5-86.8 24.5-56.9 0-106.8-37.1-125-90.3H32v18.5c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
                                <path fill="#FBBC05" d="M123 358c-8.6-25-13.6-51.5-13.6-79s5-54 13.6-79H32c-15.5 30.6-24.3 65.4-24.3 103s8.8 72.4 24.3 103l91-27z"></path>
                                <path fill="#EA4335" d="M248 113c38.1 0 72.4 13.7 99.1 38.6l74-74C376.6 34.6 317.3 8 248 8 110.8 8 0 119.2 0 256c0 10.7 .6 21.2 1.7 31.6l109.8-85.6c9.7-52 55.4-91 109.8-91z"></path>
                                <path d="M248 504c70.6 0 131-23.7 175.6-64.4l-64.2-54.8c-21.6 14.9-50.5 24.5-86.8 24.5-56.9 0-106.8-37.1-125-90.3H32v57.8C75.3 462.6 156.4 504 248 504z" fill="#34A853"></path>
                                <path d="M123 358c-8.6-25-13.6-51.5-13.6-79s5-54 13.6-79H32c-15.5 30.6-24.3 65.4-24.3 103s8.8 72.4 24.3 103l91-63z" fill="#FBBC05"></path>
                            </svg>
                            <span className="font-medium text-foreground group-hover:text-foreground/90 transition-colors">Continue with Google</span>
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
            </div >
        </div >
    )
}
