'use client'

import { useEffect, useState } from 'react'
import { X, CheckCircle, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ToastType = 'success' | 'error' | 'info'

interface ToastProps {
    message: string
    type?: ToastType
    onClose: () => void
    duration?: number
}

export function Toast({ message, type = 'info', onClose, duration = 5000 }: ToastProps) {
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        // Small delay to allow enter animation
        const enterTimer = setTimeout(() => setIsVisible(true), 10)

        // Auto dismiss
        const exitTimer = setTimeout(() => {
            setIsVisible(false)
            // Wait for exit animation to finish before calling onClose
            setTimeout(onClose, 300)
        }, duration)

        return () => {
            clearTimeout(enterTimer)
            clearTimeout(exitTimer)
        }
    }, [duration, onClose])

    const handleClose = () => {
        setIsVisible(false)
        setTimeout(onClose, 300)
    }

    return (
        <div
            className={cn(
                "fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border backdrop-blur-md transition-all duration-300 ease-out transform -translate-y-2 opacity-0 max-w-sm w-full sm:w-auto",
                isVisible && "translate-y-0 opacity-100",
                type === 'error' && "bg-destructive/10 border-destructive/20 text-destructive",
                type === 'success' && "bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400",
                type === 'info' && "bg-background/80 border-border text-foreground"
            )}
        >
            <div className="shrink-0 mt-0.5">
                {type === 'error' && <AlertCircle className="w-5 h-5" />}
                {type === 'success' && <CheckCircle className="w-5 h-5" />}
                {type === 'info' && <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />}
            </div>

            <div className="flex-1 text-sm font-medium leading-tight">
                {message}
            </div>

            <button
                onClick={handleClose}
                className="shrink-0 text-current/50 hover:text-current transition-colors"
            >
                <X className="w-4 h-4" />
                <span className="sr-only">Close</span>
            </button>
        </div>
    )
}
