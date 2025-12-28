'use client'

import { useState, useEffect } from 'react'
import { processFile, getUserDocuments } from './actions'
import { signOut } from './auth/actions'
import ChatInterface from './components/ChatInterface'
import { UploadCloud, FileText, CheckCircle, AlertCircle, X, LogOut, Loader2, Database, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

type FileStatus = 'queued' | 'processing' | 'completed' | 'error'

interface FileItem {
  id: string
  file: File
  status: FileStatus
  message?: string
}

export default function Home() {
  const [files, setFiles] = useState<FileItem[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [userDocs, setUserDocs] = useState<any[]>([])

  // Load existing documents on mount
  useEffect(() => {
    loadUserDocs()
  }, [])

  async function loadUserDocs() {
    const docs = await getUserDocuments()
    setUserDocs(docs || [])
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map((file) => ({
        id: Math.random().toString(36).substring(7),
        file,
        status: 'queued' as FileStatus,
      }))
      setFiles((prev) => [...prev, ...newFiles])
    }
  }

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const handleProcessAll = async () => {
    setIsProcessing(true)

    // Process files sequentially
    for (const item of files) {
      if (item.status === 'completed') continue

      // Update to processing
      setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'processing' } : f))

      try {
        const formData = new FormData()
        formData.append('file', item.file)

        const result = await processFile(formData)

        if (result.success) {
          setFiles(prev => prev.map(f => f.id === item.id ? {
            ...f,
            status: 'completed',
            message: `Success! Doc ID: ${result.documentId?.slice(0, 8)}...`
          } : f))

          await loadUserDocs()
        } else {
          setFiles(prev => prev.map(f => f.id === item.id ? {
            ...f,
            status: 'error',
            message: result.error || 'Unknown error'
          } : f))
        }
      } catch (err: any) {
        setFiles(prev => prev.map(f => f.id === item.id ? {
          ...f,
          status: 'error',
          message: err.message
        } : f))
      }
    }

    setIsProcessing(false)
  }

  return (
    <main className="flex min-h-screen bg-black text-gray-100 font-sans overflow-hidden">

      {/* LEFT SIDEBAR: Files */}
      <div className="w-[400px] border-r border-gray-800 bg-gray-950 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-800">
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Agentic RAG
          </h1>
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-gray-400">File Manager</p>
            <form action={signOut}>
              <button className="text-xs text-gray-500 hover:text-white flex items-center gap-1 transition-colors">
                <LogOut className="w-3 h-3" />
                Sign Out
              </button>
            </form>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">

          {/* Upload Box */}
          <div className="group relative border-2 border-dashed border-gray-800 hover:border-blue-500/50 rounded-xl p-8 text-center transition-all bg-gray-900/30 hover:bg-gray-900/50">
            <input
              type="file"
              onChange={handleFileSelect}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              accept=".pdf,.docx,.txt,.json,.csv,.md"
              multiple
            />
            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="p-3 rounded-full bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
                <UploadCloud className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-300">
                  Upload Documents
                </p>
              </div>
            </div>
          </div>

          {/* Queue */}
          {files.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Queue ({files.length})</h2>
                <button
                  onClick={handleProcessAll}
                  disabled={isProcessing || files.every(f => f.status === 'completed')}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 text-xs rounded-md font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {isProcessing && <Loader2 className="w-3 h-3 animate-spin" />}
                  {isProcessing ? 'Processing...' : 'Process'}
                </button>
              </div>
              <div className="space-y-2">
                {files.map((item) => (
                  <div key={item.id} className="bg-gray-900 border border-gray-800 rounded-lg p-3 flex items-center justify-between">
                    <span className="text-sm truncate max-w-[180px] text-gray-300">{item.file.name}</span>
                    {item.status === 'completed' ? <CheckCircle className="w-4 h-4 text-green-500" /> :
                      item.status === 'processing' ? <Loader2 className="w-4 h-4 animate-spin text-blue-500" /> :
                        item.status === 'error' ? <AlertCircle className="w-4 h-4 text-red-500" /> :
                          <span className="text-xs text-gray-500">Queued</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Saved Docs */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-2">
              <Database className="w-3 h-3" />
              Knowledge Base ({userDocs.length})
            </h2>
            {userDocs.length === 0 ? (
              <p className="text-xs text-gray-600 italic">No files yet.</p>
            ) : (
              <div className="space-y-2">
                {userDocs.map(doc => (
                  <div key={doc.id} className="p-3 bg-gray-900/50 border border-gray-800 rounded-lg hover:border-purple-500/30 transition-colors flex items-center gap-3">
                    <FileText className="w-4 h-4 text-purple-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-gray-300 text-sm truncate">{doc.name}</p>
                      <p className="text-[10px] text-gray-500">
                        {new Date(doc.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT MAIN: Chat */}
      <div className="flex-1 bg-gray-950 p-6 flex flex-col h-screen">
        <div className="mb-6 flex items-center gap-3">
          <div className="p-2 bg-purple-500/10 rounded-lg">
            <MessageSquare className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">AI Assistant</h2>
            <p className="text-sm text-gray-400">Ask questions about your documents</p>
          </div>
        </div>

        <div className="flex-1 min-h-0">
          <ChatInterface />
        </div>
      </div>

    </main>
  )
}
