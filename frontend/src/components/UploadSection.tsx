'use client';

import { useState, useRef } from 'react';
import { Upload, FileImage, X, CheckCircle, AlertCircle, Save, Eye, Loader2 } from 'lucide-react';

interface ExtractedData {
  village_name?: string;
  survey_number?: string;
  buyer_name?: string;
  seller_name?: string;
  notice_date?: string;
  advocate_name?: string;
  advocate_address?: string;
  advocate_mobile?: string;
}

interface ProcessingResult {
  extractedData: ExtractedData;
  rawText: string;
  confidenceScore: number;
  processingTime: number;
  aiService: string;
  filename: string;
  needsConfirmation: boolean;
}

interface UploadSectionProps {
  onNoticeUploaded: () => void;
}

export default function UploadSection({ onNoticeUploaded }: UploadSectionProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processingSteps = [
    { title: 'Uploading Image', icon: Upload },
    { title: 'Vision OCR Processing', icon: Eye },
    { title: 'Gemini AI Extraction', icon: CheckCircle },
    { title: 'Results Ready', icon: Save }
  ];

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (JPEG, PNG, etc.)');
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    setSelectedFile(file);
    setError(null);
    processImage(file);
  };

  const processImage = async (file: File) => {
    setProcessing(true);
    setProcessingStep(0);
    setResult(null);
    setError(null);

    const formData = new FormData();
    formData.append('image', file);

    try {
      // Simulate processing steps
      for (let i = 0; i < processingSteps.length - 1; i++) {
        setProcessingStep(i);
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/api/process-notice`, {
        method: 'POST',
        body: formData,
      });

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        throw new Error(`Server returned invalid response. Status: ${response.status}`);
      }

      if (!response.ok) {
        throw new Error(data?.error || data?.message || `Server error: ${response.status}`);
      }

      setProcessingStep(3);
      setResult(data.data);
      
    } catch (error) {
      console.error('Processing error:', error);
      setError(error instanceof Error ? error.message : 'Processing failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleSaveToDatabase = async () => {
    if (!result) return;

    setSaving(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/api/save-notice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(result),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save');
      }

      // Success - trigger refresh and reset
      onNoticeUploaded();
      resetForm();
      
    } catch (error) {
      console.error('Save error:', error);
      setError(error instanceof Error ? error.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setResult(null);
    setError(null);
    setProcessing(false);
    setProcessingStep(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatConfidence = (confidence: number) => {
    const percentage = Math.round(confidence * 100);
    let colorClass = 'text-red-600 bg-red-100';
    if (percentage >= 80) colorClass = 'text-green-600 bg-green-100';
    else if (percentage >= 60) colorClass = 'text-yellow-600 bg-yellow-100';
    
    return (
      <span className={`px-2 py-1 rounded-full text-sm font-medium ${colorClass}`}>
        {percentage}%
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      {!selectedFile && (
        <div
          className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${
            dragActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="space-y-4">
            <div className="flex justify-center">
              <Upload className="h-12 w-12 text-gray-400" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">Upload Property Notice</h3>
              <p className="text-gray-500">Drag and drop your image here, or click to browse</p>
            </div>
            <div className="text-sm text-gray-400">
              Supports: JPEG, PNG (Max 10MB)
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      )}

      {/* Selected File Preview */}
      {selectedFile && !processing && !result && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FileImage className="h-8 w-8 text-blue-600" />
              <div>
                <h3 className="font-medium text-gray-900">{selectedFile.name}</h3>
                <p className="text-sm text-gray-500">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            <button
              onClick={resetForm}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Processing Steps */}
      {processing && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-6">Processing Your Notice</h3>
          <div className="space-y-4">
            {processingSteps.map((step, index) => {
              const Icon = step.icon;
              const isActive = processingStep === index;
              const isCompleted = processingStep > index;
              
              return (
                <div
                  key={index}
                  className={`flex items-center space-x-3 p-3 rounded-lg transition-all ${
                    isActive ? 'bg-blue-50 border-l-4 border-blue-500' :
                    isCompleted ? 'bg-green-50' : 'bg-gray-50'
                  }`}
                >
                  {isActive ? (
                    <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                  ) : isCompleted ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <Icon className="h-5 w-5 text-gray-400" />
                  )}
                  <span className={`font-medium ${
                    isActive ? 'text-blue-900' :
                    isCompleted ? 'text-green-900' : 'text-gray-500'
                  }`}>
                    {step.title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* Results and Save Confirmation */}
      {result && (
        <div className="space-y-6">
          {/* Save Confirmation */}
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 text-center">
            <div className="space-y-4">
              <div className="flex justify-center">
                <Save className="h-8 w-8 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-blue-900">Save to Database?</h3>
                <p className="text-blue-700">Do you want to save this extracted information to the database?</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={handleSaveToDatabase}
                  disabled={saving}
                  className="flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  <span>{saving ? 'Saving...' : 'Yes, Save to Database'}</span>
                </button>
                <button
                  onClick={() => setResult(null)}
                  className="flex items-center justify-center space-x-2 px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  <X className="h-4 w-4" />
                  <span>No, Just View Results</span>
                </button>
              </div>
            </div>
          </div>

          {/* Extracted Data */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium text-gray-900">Extracted Information</h3>
              {formatConfidence(result.confidenceScore)}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { key: 'village_name', label: 'Village Name (ગામનું નામ)' },
                { key: 'survey_number', label: 'Survey Number (સર્વે નં.)' },
                { key: 'buyer_name', label: 'Buyer Name (ખરીદનાર)' },
                { key: 'seller_name', label: 'Seller Name (વેચનાર)' },
                { key: 'notice_date', label: 'Notice Date (તારીખ)' },
                { key: 'advocate_name', label: 'Advocate Name (એડવોકેટ)' },
                { key: 'advocate_address', label: 'Advocate Address (સરનામું)' },
                { key: 'advocate_mobile', label: 'Mobile Number (મો.)' }
              ].map((field) => (
                <div key={field.key} className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">{field.label}</label>
                  <div className="p-3 bg-gray-50 rounded-lg border">
                    <span className="text-gray-900">
                      {result.extractedData[field.key as keyof ExtractedData] || 
                       <span className="text-gray-400 italic">Not found</span>}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Processing Info */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                <div>
                  <span className="font-medium">Processing Time:</span> {result.processingTime}ms
                </div>
                <div>
                  <span className="font-medium">AI Service:</span> {result.aiService}
                </div>
                <div>
                  <span className="font-medium">File:</span> {result.filename}
                </div>
                <div>
                  <span className="font-medium">Text Length:</span> {result.rawText.length} chars
                </div>
              </div>
            </div>
          </div>

          {/* Raw Text */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Raw Extracted Text</h3>
            <div className="bg-gray-50 rounded-lg p-4 max-h-48 overflow-y-auto">
              <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono">
                {result.rawText}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 