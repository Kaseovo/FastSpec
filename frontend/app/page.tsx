'use client';

import React, { useState, useEffect } from 'react';
import JsonEditor from '@/components/JsonEditor';
import SwaggerPreview from '@/components/SwaggerPreview';
import VisualEditor from '@/components/VisualEditor';
import { specApi, OpenAPISpec, ValidationResponse } from '@/lib/api';
import { basicTemplate, emptyTemplate } from '@/lib/templates';

export default function Home() {
  const [specs, setSpecs] = useState<OpenAPISpec[]>([]);
  const [currentSpec, setCurrentSpec] = useState<Record<string, unknown>>(basicTemplate);
  const [currentSpecId, setCurrentSpecId] = useState<number | null>(null);
  const [editorMode, setEditorMode] = useState<'json' | 'visual'>('json');
  const [jsonValue, setJsonValue] = useState(JSON.stringify(basicTemplate, null, 2));
  const [validationResult, setValidationResult] = useState<ValidationResponse | null>(null);
  const [showValidation, setShowValidation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadSpecs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSpecs = async () => {
    try {
      const data = await specApi.listSpecs();
      setSpecs(data);
    } catch {
      showMessage('error', 'Failed to load specifications');
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleJsonChange = (value: string) => {
    setJsonValue(value);
    try {
      const parsed = JSON.parse(value);
      setCurrentSpec(parsed);
    } catch {
      // Invalid JSON, don't update spec
    }
  };

  const handleVisualChange = (spec: Record<string, unknown>) => {
    setCurrentSpec(spec);
    setJsonValue(JSON.stringify(spec, null, 2));
  };

  const handleNewSpec = () => {
    if (confirm('Create a new specification? Unsaved changes will be lost.')) {
      setCurrentSpec(emptyTemplate);
      setJsonValue(JSON.stringify(emptyTemplate, null, 2));
      setCurrentSpecId(null);
      setValidationResult(null);
      setShowValidation(false);
    }
  };

  const handleLoadTemplate = () => {
    setCurrentSpec(basicTemplate);
    setJsonValue(JSON.stringify(basicTemplate, null, 2));
    setCurrentSpecId(null);
    showMessage('success', 'Template loaded');
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const name = prompt('Enter a name for this specification:');
      if (!name) {
        setLoading(false);
        return;
      }

      if (currentSpecId) {
        await specApi.updateSpec(currentSpecId, { spec_json: currentSpec });
        showMessage('success', 'Specification updated successfully');
      } else {
        await specApi.createSpec(name, currentSpec);
        showMessage('success', 'Specification created successfully');
      }
      await loadSpecs();
    } catch (error: unknown) {
      const errorResponse = error as { response?: { data?: { detail?: { message?: string } | string } } };
      const detail = errorResponse?.response?.data?.detail;
      let errorMsg = 'Failed to save specification';
      
      if (typeof detail === 'object' && detail?.message) {
        errorMsg = detail.message;
      } else if (typeof detail === 'string') {
        errorMsg = detail;
      }
      
      showMessage('error', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async () => {
    setLoading(true);
    try {
      const result = await specApi.validateSpec(currentSpec);
      setValidationResult(result);
      setShowValidation(true);
      if (result.valid) {
        showMessage('success', 'Specification is valid!');
      } else {
        showMessage('error', 'Specification has validation errors');
      }
    } catch {
      showMessage('error', 'Failed to validate specification');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadSpec = async (spec: OpenAPISpec) => {
    setCurrentSpec(spec.spec_json);
    setJsonValue(JSON.stringify(spec.spec_json, null, 2));
    setCurrentSpecId(spec.id);
    setValidationResult(null);
    setShowValidation(false);
    showMessage('success', `Loaded: ${spec.name}`);
  };

  const handleDeleteSpec = async (id: number) => {
    if (!confirm('Delete this specification?')) return;
    
    try {
      await specApi.deleteSpec(id);
      showMessage('success', 'Specification deleted');
      await loadSpecs();
      if (currentSpecId === id) {
        handleNewSpec();
      }
    } catch {
      showMessage('error', 'Failed to delete specification');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-3xl font-bold text-gray-900">🧩 FastSpec - OpenAPI Editor</h1>
          <p className="text-gray-600 mt-1">Create, edit, and validate your OpenAPI specifications</p>
        </div>
      </header>

      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleNewSpec}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              New
            </button>
            <button
              onClick={handleLoadTemplate}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Load Template
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={handleValidate}
              disabled={loading}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Validating...' : 'Validate'}
            </button>
            <div className="flex-1"></div>
            <button
              onClick={() => setEditorMode(editorMode === 'json' ? 'visual' : 'json')}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
            >
              {editorMode === 'json' ? 'Visual Editor' : 'JSON Editor'}
            </button>
          </div>
        </div>
      </div>

      {/* Message Banner */}
      {message && (
        <div className={`${message.type === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border-b`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <p className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>
              {message.text}
            </p>
          </div>
        </div>
      )}

      {/* Validation Results */}
      {showValidation && validationResult && (
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold mb-2">
                  {validationResult.valid ? '✓ Valid Specification' : '✗ Validation Failed'}
                </h3>
                {validationResult.errors.length > 0 && (
                  <div className="mb-2">
                    <h4 className="font-medium text-red-600 mb-1">Errors:</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {validationResult.errors.map((err, idx) => (
                        <li key={idx} className="text-sm text-red-700">
                          <strong>{err.field}:</strong> {err.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {validationResult.warnings.length > 0 && (
                  <div>
                    <h4 className="font-medium text-yellow-600 mb-1">Warnings:</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {validationResult.warnings.map((warn, idx) => (
                        <li key={idx} className="text-sm text-yellow-700">{warn}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowValidation(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar - Saved Specs */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h2 className="text-lg font-semibold mb-3 text-gray-800">Saved Specs</h2>
              {specs.length === 0 ? (
                <p className="text-gray-500 text-sm">No saved specifications</p>
              ) : (
                <div className="space-y-2">
                  {specs.map((spec) => (
                    <div
                      key={spec.id}
                      className={`p-3 rounded-lg border ${
                        currentSpecId === spec.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      } transition-colors cursor-pointer`}
                      onClick={() => handleLoadSpec(spec)}
                    >
                      <div className="font-medium text-sm text-gray-900">{spec.name}</div>
                      <div className="text-xs text-gray-500 mt-1">{spec.title} v{spec.version}</div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSpec(spec.id);
                        }}
                        className="text-xs text-red-600 hover:text-red-800 mt-2"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Main Editor Area */}
          <div className="lg:col-span-3">
            {editorMode === 'json' ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h2 className="text-xl font-semibold mb-3 text-gray-800">JSON Editor</h2>
                  <JsonEditor value={jsonValue} onChange={handleJsonChange} />
                </div>
                <div>
                  <h2 className="text-xl font-semibold mb-3 text-gray-800">API Documentation Preview</h2>
                  <div className="border border-gray-300 rounded-lg overflow-auto" style={{ height: '600px' }}>
                    <SwaggerPreview spec={currentSpec} />
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <VisualEditor spec={currentSpec} onChange={handleVisualChange} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
