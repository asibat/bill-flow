'use client'

import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'

interface UploadDropzoneProps {
  uploading: boolean
  onUpload: (file: File) => void
}

export function UploadDropzone({ uploading, onUpload }: UploadDropzoneProps) {
  const onDrop = useCallback((files: File[]) => {
    const file = files[0]
    if (file) onUpload(file)
  }, [onUpload])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
    maxFiles: 1,
    disabled: uploading,
  })

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
        isDragActive ? 'border-brand-500 bg-brand-50' : 'border-gray-300 hover:border-brand-400'
      }`}
    >
      <input {...getInputProps()} />
      <div className="text-4xl mb-3">{uploading ? '⏳' : '📎'}</div>
      <p className="font-medium text-gray-700">
        {uploading ? 'Extracting with AI…' : 'Drop your bill PDF or screenshot here'}
      </p>
      <p className="text-sm text-gray-500 mt-1">or click to browse — PDF, PNG, JPG, WebP</p>
    </div>
  )
}
