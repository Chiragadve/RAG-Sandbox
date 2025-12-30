'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'

async function createClient() {
    const cookieStore = await cookies()

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
        throw new Error("Missing Supabase Environment Variables in Server Action")
    }

    return createServerClient(
        supabaseUrl,
        supabaseKey,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value
                },
                set(name: string, value: string, options: CookieOptions) {
                    try {
                        cookieStore.set({ name, value, ...options })
                    } catch (error) {
                        // The `set` method was called from a Server Component.
                    }
                },
                remove(name: string, options: CookieOptions) {
                    try {
                        cookieStore.set({ name, value: '', ...options })
                    } catch (error) {
                        // The `delete` method was called from a Server Component.
                    }
                },
            },
        }
    )
}

export async function login(formData: FormData) {
    try {
        const supabase = await createClient()

        const email = formData.get('email') as string
        const password = formData.get('password') as string

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (error) {
            return { error: error.message }
        }
    } catch (err: any) {
        return { error: err.message || 'Login failed' }
    }

    revalidatePath('/', 'layout')
    redirect('/sandbox')
}

export async function signup(formData: FormData) {
    try {
        const supabase = await createClient()

        const email = formData.get('email') as string
        const password = formData.get('password') as string

        const { error } = await supabase.auth.signUp({
            email,
            password,
        })

        if (error) {
            return { error: error.message }
        }
    } catch (err: any) {
        return { error: err.message || 'Signup failed' }
    }

    revalidatePath('/', 'layout')
    redirect('/sandbox')
}

export async function signInWithGoogle() {
    let url = ''
    try {
        const supabase = await createClient()
        const origin = (await headers()).get('origin')

        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${origin}/auth/confirm`,
            },
        })

        if (error) {
            return { error: error.message }
        }
        if (data.url) url = data.url

    } catch (err: any) {
        return { error: err.message }
    }

    if (url) redirect(url)
}

export async function signOut() {
    try {
        const supabase = await createClient()
        await supabase.auth.signOut()
    } catch (err) {
        // Log error but allow redirect to happen to clear client state if possible
        console.error("SignOut Failed:", err)
    }

    // Always redirect, even if server-side signout had issues
    revalidatePath('/', 'layout')
    redirect('/')
}
