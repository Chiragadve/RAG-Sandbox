'use client'

import { useState, useEffect, useRef } from 'react'
import { generatePodcast } from '@/app/actions'
import { Headphones, Loader2, Play, Pause, Download, AlertCircle, Sparkles, Layers, Clock } from 'lucide-react'

interface Document {
    id: string
    name: string
}

interface PodcastStudioProps {
    selectedDocumentIds: string[]
    allDocuments: Document[]
}

interface PodcastItem {
    id: string
    title: string
    audioUrl: string
    createdAt: number
}

export default function PodcastStudio({ selectedDocumentIds, allDocuments }: PodcastStudioProps) {
    const [status, setStatus] = useState<'idle' | 'generating' | 'error'>('idle')
    const [error, setError] = useState<string | null>(null)
    const [podcasts, setPodcasts] = useState<PodcastItem[]>([])

    // Audio Player State
    const [currentPlayingId, setCurrentPlayingId] = useState<string | null>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [speed, setSpeed] = useState(1.0)
    const audioRef = useRef<HTMLAudioElement | null>(null)

    const handleGenerate = async () => {
        if (selectedDocumentIds.length === 0) return

        setStatus('generating')
        setError(null)

        try {
            const result = await generatePodcast(selectedDocumentIds)

            if (result.success && result.audioUrl) {
                // Add to stack
                const newPodcast: PodcastItem = {
                    id: Math.random().toString(36).substring(7),
                    title: result.title || "Combined Podcast",
                    audioUrl: result.audioUrl,
                    createdAt: Date.now()
                }
                setPodcasts(prev => [newPodcast, ...prev])
                setStatus('idle')
            } else {
                setError(result.error || "Generation failed")
                setStatus('error')
            }
        } catch (err: any) {
            setError(err.message)
            setStatus('error')
        }
    }

    const togglePlay = (podcast: PodcastItem) => {
        if (currentPlayingId === podcast.id) {
            if (isPlaying) {
                audioRef.current?.pause()
                setIsPlaying(false)
            } else {
                audioRef.current?.play()
                setIsPlaying(true)
            }
        } else {
            setCurrentPlayingId(podcast.id)
            setIsPlaying(true)
            // Wait for render to update src? No, create global audio or managed one.
            // Simple approach: Use one audio element ref.
            if (audioRef.current) {
                audioRef.current.src = podcast.audioUrl
                audioRef.current.playbackRate = speed
                audioRef.current.play()
            }
        }
    }

    // Update speed when state changes
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.playbackRate = speed
        }
    }, [speed])

    return (
        <div className="h-full flex flex-col bg-card/30 border-l border-border">
            {/* Header */}
            <div className="p-6 border-b border-border">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2 font-display">
                    <Headphones className="w-5 h-5 text-primary" />
                    Podcast Studio
                </h2>
                <p className="text-xs text-muted-foreground mt-1">Generate and listen to your audio</p>
            </div>

            {/* Generated Stack List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {podcasts.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground opacity-50">
                        <Layers className="w-10 h-10 mb-3" />
                        <p className="text-xs">No podcasts generated yet.</p>
                        <p className="text-[10px] mt-1">Select docs on the left to start.</p>
                    </div>
                ) : (
                    podcasts.map(pod => (
                        <div key={pod.id} className={`p-4 rounded-xl border transition-all ${currentPlayingId === pod.id ? 'bg-primary/10 border-primary/50' : 'bg-card border-border hover:border-primary/30'}`}>
                            <div className="flex justify-between items-start mb-3">
                                <div className="min-w-0">
                                    <h3 className="text-sm font-semibold text-foreground truncate pr-2" title={pod.title}>{pod.title}</h3>
                                    <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                                        <Clock className="w-3 h-3" />
                                        {new Date(pod.createdAt).toLocaleTimeString()}
                                    </span>
                                </div>
                                <button
                                    onClick={() => togglePlay(pod)}
                                    className={`cursor-pointer p-2 rounded-full transition-colors ${currentPlayingId === pod.id && isPlaying ? 'bg-primary text-primary-foreground' : 'bg-muted text-primary hover:bg-muted/80'}`}
                                >
                                    {currentPlayingId === pod.id && isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                                </button>
                            </div>

                            {/* Controls only visible if active */}
                            {currentPlayingId === pod.id && (
                                <div className="space-y-3 pt-2 border-t border-border mt-2">
                                    {/* Speed Control */}
                                    <div className="flex flex-wrap gap-1.5">
                                        {[0.25, 0.5, 1.0, 1.25, 1.5, 2.0].map(s => (
                                            <button
                                                key={s}
                                                onClick={() => setSpeed(s)}
                                                className={`cursor-pointer text-[10px] px-2 py-1 rounded-full border transition-colors ${speed === s ? 'bg-primary/20 border-primary text-primary' : 'bg-background border-border text-muted-foreground hover:text-foreground'}`}
                                            >
                                                {s}x
                                            </button>
                                        ))}
                                    </div>
                                    <a href={pod.audioUrl} download className="block text-center text-[10px] text-muted-foreground hover:text-primary transition-colors">
                                        Download Audio
                                    </a>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Hidden Audio Element */}
            <audio ref={audioRef} onEnded={() => setIsPlaying(false)} />

            {/* Bottom Generate Action */}
            <div className="p-6 border-t border-border bg-card/50">
                {error && (
                    <div className="mb-3 p-2 bg-destructive/10 border border-destructive/20 rounded flex items-center gap-2 text-xs text-destructive">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span className="truncate">{error}</span>
                    </div>
                )}

                <button
                    onClick={handleGenerate}
                    disabled={selectedDocumentIds.length === 0 || status === 'generating'}
                    className="cursor-pointer w-full py-4 bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground rounded-xl font-bold shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
                >
                    {status === 'generating' ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Generating...
                        </>
                    ) : (
                        <>
                            <Sparkles className="w-5 h-5" />
                            {selectedDocumentIds.length > 0 ? `Generate (${selectedDocumentIds.length})` : 'Select Docs to Generate'}
                        </>
                    )}
                </button>
            </div>
        </div>
    )
}
