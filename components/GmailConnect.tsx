'use client'

import { useState, useEffect } from 'react'
import { connectGmail, ingestGmail } from '@/app/actions'
import { Mail, RefreshCw, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { useSearchParams, useRouter } from 'next/navigation'

export default function GmailConnect() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const [isConnected, setIsConnected] = useState(false)
    const [isSyncing, setIsSyncing] = useState(false)
    const [syncStatus, setSyncStatus] = useState<string | null>(null)

    useEffect(() => {
        // Check URL params for connection status
        if (searchParams.get('gmail') === 'connected') {
            setIsConnected(true)
            // Optional: Auto-sync on fresh connect? Maybe better to let user click.
        }
    }, [searchParams])

    const handleConnect = async () => {
        await connectGmail()
        // This will redirect, so no state update needed here really
    }

    const handleSync = async () => {
        setIsSyncing(true)
        setSyncStatus('Syncing...')
        try {
            const result = await ingestGmail()
            if (result.success) {
                setSyncStatus(`Synced ${result.count} emails`)
                // Refresh to show new files
                router.refresh()
                // Wait a bit then clear status
                setTimeout(() => setSyncStatus(null), 3000)
            } else {
                setSyncStatus(`Error: ${result.error}`)
            }
        } catch (e: any) {
            setSyncStatus(`Error: ${e.message}`)
        } finally {
            setIsSyncing(false)
        }
    }

    return (
        <div className="p-4 border-t border-gray-800">
            <div className="flex flex-col gap-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Integrations</h3>

                {!isConnected && (searchParams.get('gmail') !== 'connected') ? (
                    <button
                        onClick={handleConnect}
                        className="flex items-center gap-2 w-full bg-white text-black hover:bg-gray-200 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                    >
                        <Mail className="w-4 h-4" />
                        Connect Gmail
                    </button>
                ) : (
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-green-400 text-xs">
                            <CheckCircle className="w-3 h-3" />
                            <span>Gmail Connected</span>
                        </div>

                        <button
                            onClick={handleSync}
                            disabled={isSyncing}
                            className="flex items-center justify-center gap-2 w-full bg-gray-800 hover:bg-gray-700 text-gray-200 px-3 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                        >
                            {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                            {isSyncing ? 'Syncing...' : 'Sync Recent Emails'}
                        </button>

                        {syncStatus && (
                            <p className="text-[10px] text-gray-400 text-center truncate">{syncStatus}</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
