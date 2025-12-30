'use client'

import { useState } from 'react'
import { generatePodcast } from '@/app/actions'
import { Headphones, Loader2, PlayCircle, AlertCircle } from 'lucide-react'

interface PodcastPlayerProps {
    documentId: string
    documentName: string
}

export default function PodcastPlayer({ documentId, documentName }: PodcastPlayerProps) {
    const [status, setStatus] = useState<'idle' | 'generating' | 'ready' | 'error'>('idle')
    const [audioUrl, setAudioUrl] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const handleGenerate = async () => {
        setStatus('generating')
        setError(null)

        try {
            const result = await generatePodcast(documentId)

            if (result.success && result.audioUrl) {
                setAudioUrl(result.audioUrl)
                setStatus('ready')
            } else {
                setError(result.error || "Generation failed")
                setStatus('error')
            }
        } catch (err: any) {
            setError(err.message)
            setStatus('error')
        }
    }

    if (status === 'ready' && audioUrl) {
        return (
            <div className="mt-2 flex items-center gap-2 bg-black/20 p-2 rounded-lg">
                <audio controls src={audioUrl} className="h-8 w-full max-w-[200px]" />
            </div>
        )
    }

    if (status === 'generating') {
        return (
            <button disabled className="mt-2 flex items-center gap-2 text-xs text-blue-400 bg-blue-500/10 px-2 py-1 rounded-md cursor-not-allowed">
                <Loader2 className="w-3 h-3 animate-spin" />
                Creating Podcast...
            </button>
        )
    }

    if (status === 'error') {
        return (
            <div className="mt-2 flex items-center gap-2 text-xs text-red-400">
                <AlertCircle className="w-3 h-3" />
                <span className="truncate max-w-[150px]">{error}</span>
                <button onClick={handleGenerate} className="underline hover:text-red-300">Retry</button>
            </div>
        )
    }

    return (
        <button
            onClick={handleGenerate}
            className="mt-2 flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 px-2 py-1 rounded-md transition-colors"
            title="Generate AI Podcast"
        >
            <Headphones className="w-3 h-3" />
            Generate Podcast
        </button>
    )
}
