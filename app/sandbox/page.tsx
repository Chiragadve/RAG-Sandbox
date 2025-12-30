'use client'

import { useState, useEffect } from 'react'
import { processFile, getUserDocuments, deleteDocument } from '../actions'
import { signOut } from '../auth/actions'
import ChatInterface from '@/components/ChatInterface'
import { UploadCloud, FileText, Trash2, MessageSquare, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import PodcastStudio from '@/components/PodcastStudio'

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
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([])

  const toggleSelection = (id: string, multiSelect: boolean = true) => {
    setSelectedDocIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(d => d !== id)
      } else {
        return multiSelect ? [...prev, id] : [id]
      }
    })
  }

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
            message: `Success!`
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

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!confirm('Are you sure you want to delete this document?')) return

    await deleteDocument(id)
    if (selectedDocIds.includes(id)) setSelectedDocIds(prev => prev.filter(d => d !== id))
    await loadUserDocs()
  }

  return (
    <main className="flex h-screen bg-background text-foreground font-sans overflow-hidden">

      {/* COL 1: LEFT SIDEBAR (Files) */}
      <div className="w-[320px] shrink-0 border-r border-border bg-card/50 flex flex-col z-10">
        {/* Header */}
        <div className="p-5 border-b border-border">
          <h1 className="text-xl font-display font-bold tracking-tight text-foreground">
            Agentic RAG
          </h1>
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{userDocs.length} Documents</span>
            <form action={signOut}>
              <button className="cursor-pointer text-xs border border-destructive/50 text-destructive hover:bg-destructive/10 hover:border-destructive px-3 py-1.5 rounded-full transition-all font-medium shadow-sm hover:shadow">Sign Out</button>
            </form>
          </div>
        </div>

        {/* Scrollable List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">

          {/* Upload Area */}
          <div className="group relative border-2 border-dashed border-border hover:border-primary/50 rounded-xl p-6 text-center transition-all bg-muted/30 hover:bg-muted/50">
            <input
              type="file"
              onChange={handleFileSelect}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              accept=".pdf,.docx,.txt,.json,.csv,.md"
              multiple
            />
            <div className="flex flex-col items-center gap-2">
              <div className="p-2 rounded-full bg-primary/10 text-primary">
                <UploadCloud className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Drop PDFs</p>
                <p className="text-[10px] text-muted-foreground">or click to upload</p>
              </div>
            </div>
          </div>

          {/* Queue Status */}
          {files.length > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] uppercase text-muted-foreground font-bold">Upload Queue</span>
                <button
                  onClick={handleProcessAll}
                  disabled={isProcessing || files.every(f => f.status === 'completed')}
                  className="cursor-pointer bg-primary hover:bg-primary/90 text-primary-foreground px-2 py-1 text-[10px] rounded uppercase font-bold tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? 'Processing' : 'Start'}
                </button>
              </div>
              {files.map(f => (
                <div key={f.id} className="text-xs flex justify-between text-muted-foreground">
                  <span className="truncate max-w-[150px]">{f.file.name}</span>
                  <span className={f.status === 'completed' ? 'text-green-500' : f.status === 'error' ? 'text-destructive' : 'text-primary'}>
                    {f.status}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Document List */}
          <div className="space-y-2">
            {userDocs.length === 0 ? (
              <div className="text-center py-10 opacity-50">
                <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">No documents yet</p>
              </div>
            ) : (
              userDocs.map(doc => (
                <div
                  key={doc.id}
                  onClick={() => toggleSelection(doc.id)}
                  className={cn(
                    "group flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer",
                    selectedDocIds.includes(doc.id)
                      ? "bg-primary/10 border-primary/50"
                      : "bg-card border-border hover:border-primary/30 hover:bg-muted/50"
                  )}
                >
                  {/* Select Checkbox/Indicator */}
                  <div className={cn(
                    "w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0",
                    selectedDocIds.includes(doc.id) ? "bg-primary border-primary" : "border-muted-foreground group-hover:border-foreground"
                  )}>
                    {selectedDocIds.includes(doc.id) && <ChevronRight className="w-3 h-3 text-primary-foreground" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-medium truncate", selectedDocIds.includes(doc.id) ? "text-primary" : "text-muted-foreground group-hover:text-foreground")}>{doc.name}</p>
                  </div>

                  {/* Delete Button */}
                  <button
                    onClick={(e) => handleDelete(e, doc.id)}
                    className={cn(
                      "cursor-pointer p-1.5 rounded hover:bg-destructive/10 hover:text-destructive transition-colors",
                      selectedDocIds.includes(doc.id) ? "opacity-100 text-muted-foreground" : "opacity-0 group-hover:opacity-100 text-muted-foreground"
                    )}
                    title="Delete Document"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* COL 2: MAIN CHAT (Center) */}
      <div className="flex-1 flex flex-col bg-background relative border-r border-border">
        {/* Clean Header */}
        <div className="flex items-center gap-3 p-6 border-b border-border bg-background/50 backdrop-blur-sm z-10">
          <div className="p-2 bg-primary/10 rounded-lg">
            <MessageSquare className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground font-display">Agentic Chat</h2>
            <p className="text-xs text-muted-foreground">Context: {selectedDocIds.length > 0 ? `${selectedDocIds.length} Selected` : 'All Documents'}</p>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 h-full">
          <ChatInterface />
        </div>
      </div>

      {/* COL 3: PODCAST STUDIO (Right) */}
      <div className="w-[400px] border-l border-border bg-card/30">
        <PodcastStudio selectedDocumentIds={selectedDocIds} allDocuments={userDocs} />
      </div>

    </main>
  )
}
