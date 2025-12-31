'use client'

import { useState, useEffect } from 'react'
import { processFile, getUserDocuments, deleteDocument } from '../actions'
import { signOut } from '../auth/actions'
import ChatInterface from '@/components/ChatInterface'
import { UploadCloud, FileText, Trash2, MessageSquare, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import PodcastStudio from '@/components/PodcastStudio'
import { Toast, ToastType } from '@/components/ui/Toast'

type FileStatus = 'queued' | 'processing' | 'completed' | 'error' | 'requires_ocr'

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
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null)

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

  const handleProcessAll = () => {
    // Don't await - process in background
    processFilesInBackground()
  }

  // Non-blocking background processor using streaming API
  const processFilesInBackground = async () => {
    if (isProcessing) return
    setIsProcessing(true)

    // Get copy of files to process
    const filesToProcess = files.filter(f => f.status === 'queued')

    // Process each file via streaming API (truly non-blocking)
    for (const item of filesToProcess) {
      // Update to processing
      setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'processing' } : f))

      try {
        const formData = new FormData()
        formData.append('file', item.file)

        // Use streaming API route instead of server action
        const response = await fetch('/api/process-file', {
          method: 'POST',
          body: formData
        })

        if (!response.ok) {
          throw new Error('Upload failed')
        }

        // Read SSE stream for status updates
        const reader = response.body?.getReader()
        if (reader) {
          const decoder = new TextDecoder()
          let done = false
          let success = false
          let buffer = ''

          while (!done) {
            const { value, done: readerDone } = await reader.read()
            done = readerDone
            if (value) {
              const text = decoder.decode(value, { stream: true })
              buffer += text
              const lines = buffer.split('\n')

              // Process all complete lines
              buffer = lines.pop() || '' // Keep the last partial line in buffer

              for (const line of lines) {
                if (line.trim().startsWith('data: ')) {
                  try {
                    const jsonStr = line.trim().slice(6)
                    const data = JSON.parse(jsonStr)

                    if (data.status === 'complete') {
                      success = true
                    } else if (data.status === 'requires_ocr') {
                      setFiles(prev => prev.map(f => f.id === item.id ? {
                        ...f,
                        status: 'requires_ocr',
                        message: data.message
                      } : f))
                      // Don't mark as success (keeps item in list), but don't error out
                    } else if (data.status === 'error') {
                      // Use warn instead of error to avoid Next.js error overlay
                      console.warn(`Processing failed: ${data.message}`)
                      setToast({ message: data.message || 'Processing failed', type: 'error' })
                      setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'error', message: data.message } : f))
                    }
                  } catch (e) {
                    console.warn('Failed to parse SSE message:', line)
                  }
                }
              }
            }
          }

          if (success) {
            setFiles(prev => prev.filter(f => f.id !== item.id))
            loadUserDocs()
          } else {
            // If requires_ocr, keep it in the list. If error, keep in list.
            // Only remove if success or if we want to clear errors?
            // Logic above handles removal on success.
            // We want to KEEP requires_ocr items.
          }
        }

      } catch (err: unknown) {
        const error = err as Error
        setFiles(prev => prev.filter(f => f.id !== item.id))

        // Log as warning to avoid dev overlay
        console.warn(`Error processing ${item.file.name}: ${error.message}`)
        setToast({ message: error.message || 'Upload failed', type: 'error' })
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

  const handleRunOCR = async (fileItem: FileItem) => {
    // Reset status to queued, but we need to trigger processing with ocrEnabled
    // Custom processing for this item
    setFiles(prev => prev.map(f => f.id === fileItem.id ? { ...f, status: 'processing', message: 'Running OCR...' } : f))

    try {
      const formData = new FormData()
      formData.append('file', fileItem.file)
      formData.append('ocrEnabled', 'true') // Enable OCR

      const response = await fetch('/api/process-file', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) throw new Error('OCR Upload failed')

      const reader = response.body?.getReader()
      if (reader) {
        const decoder = new TextDecoder()
        let done = false
        let success = false
        let buffer = ''

        while (!done) {
          const { value, done: readerDone } = await reader.read()
          done = readerDone
          if (value) {
            const text = decoder.decode(value, { stream: true })
            buffer += text
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              if (line.trim().startsWith('data: ')) {
                const data = JSON.parse(line.trim().slice(6))
                if (data.status === 'complete') success = true
                else if (data.status === 'error') {
                  setToast({ message: data.message, type: 'error' })
                  setFiles(prev => prev.map(f => f.id === fileItem.id ? { ...f, status: 'error', message: data.message } : f))
                }
              }
            }
          }
        }

        if (success) {
          setFiles(prev => prev.filter(f => f.id !== fileItem.id))
          loadUserDocs()
          setToast({ message: 'OCR completed successfully', type: 'success' })
        }
      }
    } catch (e) {
      const err = e as Error
      console.warn(err)
      setToast({ message: err.message || 'OCR failed', type: 'error' })
      setFiles(prev => prev.map(f => f.id === fileItem.id ? { ...f, status: 'error', message: err.message || 'OCR failed' } : f))
    }
  }

  return (
    <main className="flex h-screen bg-background text-foreground font-sans overflow-hidden">

      {/* COL 1: LEFT SIDEBAR (Files) */}
      <div className="w-[320px] shrink-0 border-r border-border bg-card/50 flex flex-col z-10">
        {/* Header */}
        <div className="h-24 px-6 flex flex-col justify-center border-b border-border">
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
                  <span className={
                    f.status === 'completed' ? 'text-green-500' :
                      f.status === 'error' ? 'text-destructive' :
                        f.status === 'requires_ocr' ? 'text-amber-500' :
                          'text-primary'
                  }>
                    {f.status === 'requires_ocr' ? (
                      <button
                        onClick={() => handleRunOCR(f)}
                        className="text-[10px] bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 px-2 py-0.5 rounded border border-amber-500/30 transition-colors font-bold"
                      >
                        Run OCR
                      </button>
                    ) : f.status}
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

                  <div className="flex-1 min-w-0 overflow-hidden">
                    <p
                      className={cn("text-sm font-medium truncate", selectedDocIds.includes(doc.id) ? "text-primary" : "text-muted-foreground group-hover:text-foreground")}
                      title={doc.name}
                    >
                      {doc.name}
                    </p>
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
        <div className="h-24 flex items-center gap-3 px-6 border-b border-border bg-background/50 backdrop-blur-sm z-10">
          <div className="p-2 bg-primary/10 rounded-lg">
            <MessageSquare className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground font-display">Agentic Chat</h2>
            <p className="text-xs text-muted-foreground">Context: {selectedDocIds.length > 0 ? `${selectedDocIds.length} Selected` : 'All Documents'}</p>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 h-full min-h-0">
          <ChatInterface />
        </div>
      </div>

      {/* COL 3: PODCAST STUDIO (Right) */}
      <div className="w-[400px] border-l border-border bg-card/30">
        <PodcastStudio selectedDocumentIds={selectedDocIds} allDocuments={userDocs} />
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </main>
  )
}
