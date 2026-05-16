'use client'

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/app/context/auth-context'
import { cn } from '@/lib/utils'
import { UploadIcon, FileTextIcon, CheckIcon } from 'lucide-react'

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    onImported?: () => void
}

export function AppleHealthImportDialog({ open, onOpenChange, onImported }: Props) {
    const { user } = useAuth()
    const [file, setFile] = useState<File | null>(null)
    const [uploading, setUploading] = useState(false)
    const [result, setResult] = useState<{ ok: boolean; imported?: number; error?: string } | null>(null)

    function reset() {
        setFile(null)
        setUploading(false)
        setResult(null)
    }

    function handleClose() {
        if (uploading) return
        reset()
        onOpenChange(false)
    }

    async function handleUpload() {
        if (!file || !user) return
        setUploading(true)
        setResult(null)

        const form = new FormData()
        form.append('userId', user.id)
        form.append('file', file)

        try {
            const res = await fetch('/api/sleep-logs/import-apple-health', { method: 'POST', body: form })
            const data = await res.json()
            if (!res.ok) {
                setResult({ ok: false, error: data.error ?? 'Import failed' })
            } else {
                setResult({ ok: true, imported: data.nights_imported })
                onImported?.()
            }
        } catch (e) {
            setResult({ ok: false, error: e instanceof Error ? e.message : 'Upload failed' })
        } finally {
            setUploading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={v => { if (!v) handleClose() }}>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Import from Apple Health</DialogTitle>
                </DialogHeader>

                {!result && (
                    <div className="space-y-4">
                        {/* How-to */}
                        <div className="rounded-xl bg-primary/[0.06] border border-primary/[0.15] p-4">
                            <div className="text-[12px] font-semibold text-foreground mb-2">How to export your sleep data:</div>
                            <ol className="space-y-1.5 text-[12px] text-muted-foreground leading-relaxed list-decimal pl-4">
                                <li>On your iPhone, open <strong className="text-foreground">Health</strong></li>
                                <li>Tap your profile picture (top right)</li>
                                <li>Scroll down → tap <strong className="text-foreground">Export All Health Data</strong></li>
                                <li>Wait ~1 minute — it&apos;ll create <code className="text-[11px] bg-muted px-1 rounded">export.zip</code></li>
                                <li>AirDrop or email it to your laptop, then <strong className="text-foreground">unzip it</strong></li>
                                <li>Upload <code className="text-[11px] bg-muted px-1 rounded">export.xml</code> below</li>
                            </ol>
                        </div>

                        {/* File picker */}
                        <label
                            className={cn(
                                'block w-full rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors',
                                file ? 'border-primary bg-primary/[0.04]' : 'border-border hover:border-primary/50 hover:bg-muted/40'
                            )}
                        >
                            <input
                                type="file"
                                accept=".xml"
                                className="hidden"
                                onChange={e => setFile(e.target.files?.[0] ?? null)}
                            />
                            {file ? (
                                <div className="flex items-center gap-3 justify-center">
                                    <FileTextIcon className="w-5 h-5 text-primary flex-shrink-0" />
                                    <div className="text-left">
                                        <div className="text-[13px] font-semibold text-foreground truncate max-w-[220px]">{file.name}</div>
                                        <div className="text-[11px] text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB · tap to change</div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-2">
                                    <UploadIcon className="w-6 h-6 text-muted-foreground" />
                                    <div className="text-[13px] font-semibold text-foreground">Choose export.xml</div>
                                    <div className="text-[11px] text-muted-foreground">Up to 200 MB</div>
                                </div>
                            )}
                        </label>

                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                            Your file is parsed once and discarded — only sleep records are extracted and saved.
                            Other health data in the file is ignored.
                        </p>
                    </div>
                )}

                {result?.ok && (
                    <div className="py-4 flex flex-col items-center text-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-success/15 flex items-center justify-center">
                            <CheckIcon className="w-6 h-6 text-success" />
                        </div>
                        <div>
                            <div className="text-[15px] font-semibold text-foreground">Import complete</div>
                            <div className="text-[13px] text-muted-foreground mt-1">
                                {result.imported === 0
                                    ? 'No sleep records found in this export.'
                                    : `${result.imported} night${result.imported === 1 ? '' : 's'} of sleep imported.`}
                            </div>
                        </div>
                    </div>
                )}

                {result && !result.ok && (
                    <div className="rounded-xl bg-danger/10 border border-danger/30 p-4">
                        <div className="text-[13px] font-semibold text-danger mb-1">Import failed</div>
                        <div className="text-[12px] text-danger-dark">{result.error}</div>
                    </div>
                )}

                <DialogFooter>
                    {!result && (
                        <>
                            <Button variant="outline" onClick={handleClose} disabled={uploading}>Cancel</Button>
                            <Button onClick={handleUpload} disabled={!file || uploading}>
                                {uploading ? 'Importing…' : 'Import'}
                            </Button>
                        </>
                    )}
                    {result && (
                        <Button onClick={handleClose}>Done</Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
