'use client'

import { useState } from 'react'
import { processFile } from './actions'
import { Loader2, Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function Home() {
  const [isUploading, setIsUploading] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' })
  const [result, setResult] = useState<any>(null)

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsUploading(true)
    setStatus({ type: null, message: '' })
    setResult(null)

    const formData = new FormData(e.currentTarget)

    try {
      const res = await processFile(formData)
      if (res.success) {
        setStatus({ type: 'success', message: 'Processing complete!' })
        setResult(res)
      } else {
        setStatus({ type: 'error', message: res.error || 'Unknown error' })
      }
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message })
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl">
        <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
          <FileText className="text-indigo-400" />
          Ingestion MVP
        </h1>
        <p className="text-slate-400 mb-6">Upload a file to generate embeddings via Supabase Edge Functions.</p>

        <form onSubmit={handleUpload} className="space-y-4">
          <div className="border-2 border-dashed border-slate-700 rounded-lg p-8 flex flex-col items-center justify-center hover:border-indigo-500 transition-colors bg-slate-900/50">
            <input
              type="file"
              name="file"
              className="hidden"
              id="file-upload"
              required
            />
            <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
              <Upload className="w-10 h-10 text-slate-500 mb-2" />
              <span className="text-sm text-slate-300">Click to select file</span>
              <span className="text-xs text-slate-500 mt-1">PDF, Docx, TXT, JSON, CSV</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isUploading}
            className={cn(
              "w-full py-2 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2",
              isUploading
                ? "bg-indigo-900/50 text-indigo-300 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
            )}
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              "Process & Embed"
            )}
          </button>
        </form>

        {status.type && (
          <div className={cn(
            "mt-6 p-4 rounded-lg flex items-start gap-3",
            status.type === 'success' ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
          )}>
            {status.type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
            <div>
              <p className="font-medium">{status.message}</p>
              {result && (
                <p className="text-xs mt-1 text-slate-400">
                  Document ID: {result.documentId} <br />
                  Chunks created: {result.count}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
