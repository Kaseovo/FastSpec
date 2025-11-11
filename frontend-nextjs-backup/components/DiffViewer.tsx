'use client';

import React from 'react';

interface FieldChange {
  name: string;
  type?: string;
  required?: boolean;
  changes?: Record<string, { old: unknown; new: unknown }>;
}

interface SchemaChanges {
  added_fields?: FieldChange[];
  removed_fields?: FieldChange[];
  modified_fields?: FieldChange[];
  has_changes: boolean;
}

interface EndpointChange {
  path: string;
  method: string;
  summary?: string;
  summary_changed?: boolean;
  summary_old?: string;
  summary_new?: string;
  request_body_changes?: SchemaChanges;
  response_changes?: Record<string, SchemaChanges>;
  has_changes?: boolean;
}

interface DiffData {
  added_endpoints?: EndpointChange[];
  removed_endpoints?: EndpointChange[];
  modified_endpoints?: EndpointChange[];
  info_changes?: Record<string, { old: unknown; new: unknown }>;
  has_changes: boolean;
  message?: string;
}

interface DiffViewerProps {
  diff: DiffData | null;
  onClose: () => void;
}

export default function DiffViewer({ diff, onClose }: DiffViewerProps) {
  if (!diff) return null;

  if (!diff.has_changes) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Version Comparison</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
            >
              ×
            </button>
          </div>
          <div className="text-center py-8">
            <p className="text-gray-600 text-lg">
              {diff.message || 'No changes detected between versions'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-start p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Version Comparison</h2>
            <p className="text-gray-600 mt-1">Changes between previous and current version</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-6 space-y-6">
          {/* Info Changes */}
          {diff.info_changes && Object.keys(diff.info_changes).length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-blue-900 mb-3">API Information Changes</h3>
              <div className="space-y-2">
                {Object.entries(diff.info_changes).map(([field, change]) => (
                  <div key={field} className="flex items-center gap-2">
                    <span className="font-medium text-blue-800 capitalize">{field}:</span>
                    <span className="line-through text-red-600">{String(change.old)}</span>
                    <span className="text-gray-500">→</span>
                    <span className="text-green-600 font-medium">{String(change.new)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Added Endpoints */}
          {diff.added_endpoints && diff.added_endpoints.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-green-900 mb-3">✅ Added Endpoints</h3>
              <div className="space-y-2">
                {diff.added_endpoints.map((endpoint, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <span
                      className={`px-2 py-1 text-xs font-bold uppercase rounded ${
                        endpoint.method === 'get'
                          ? 'bg-blue-100 text-blue-800'
                          : endpoint.method === 'post'
                          ? 'bg-green-100 text-green-800'
                          : endpoint.method === 'put'
                          ? 'bg-yellow-100 text-yellow-800'
                          : endpoint.method === 'delete'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {endpoint.method}
                    </span>
                    <span className="font-medium text-gray-900">{endpoint.path}</span>
                    {endpoint.summary && (
                      <span className="text-gray-600 text-sm">- {endpoint.summary}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Removed Endpoints */}
          {diff.removed_endpoints && diff.removed_endpoints.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-red-900 mb-3">❌ Removed Endpoints</h3>
              <div className="space-y-2">
                {diff.removed_endpoints.map((endpoint, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <span
                      className={`px-2 py-1 text-xs font-bold uppercase rounded ${
                        endpoint.method === 'get'
                          ? 'bg-blue-100 text-blue-800'
                          : endpoint.method === 'post'
                          ? 'bg-green-100 text-green-800'
                          : endpoint.method === 'put'
                          ? 'bg-yellow-100 text-yellow-800'
                          : endpoint.method === 'delete'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {endpoint.method}
                    </span>
                    <span className="font-medium text-gray-900 line-through">{endpoint.path}</span>
                    {endpoint.summary && (
                      <span className="text-gray-600 text-sm">- {endpoint.summary}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Modified Endpoints */}
          {diff.modified_endpoints && diff.modified_endpoints.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-yellow-900 mb-3">🔄 Modified Endpoints</h3>
              <div className="space-y-4">
                {diff.modified_endpoints.map((endpoint, idx) => (
                  <div key={idx} className="bg-white rounded-lg p-4 border border-yellow-300">
                    <div className="flex items-center gap-3 mb-3">
                      <span
                        className={`px-2 py-1 text-xs font-bold uppercase rounded ${
                          endpoint.method === 'get'
                            ? 'bg-blue-100 text-blue-800'
                            : endpoint.method === 'post'
                            ? 'bg-green-100 text-green-800'
                            : endpoint.method === 'put'
                            ? 'bg-yellow-100 text-yellow-800'
                            : endpoint.method === 'delete'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {endpoint.method}
                      </span>
                      <span className="font-medium text-gray-900">{endpoint.path}</span>
                    </div>

                    {endpoint.summary_changed && (
                      <div className="mb-3 text-sm">
                        <span className="font-medium">Summary: </span>
                        <span className="line-through text-red-600">{endpoint.summary_old}</span>
                        <span className="text-gray-500 mx-2">→</span>
                        <span className="text-green-600">{endpoint.summary_new}</span>
                      </div>
                    )}

                    {endpoint.request_body_changes?.has_changes && (
                      <div className="mb-3">
                        <h4 className="font-semibold text-sm text-gray-700 mb-2">Request Body Changes:</h4>
                        {renderSchemaChanges(endpoint.request_body_changes)}
                      </div>
                    )}

                    {endpoint.response_changes &&
                      Object.entries(endpoint.response_changes).map(([status, changes]) =>
                        changes.has_changes ? (
                          <div key={status} className="mb-3">
                            <h4 className="font-semibold text-sm text-gray-700 mb-2">
                              Response {status} Changes:
                            </h4>
                            {renderSchemaChanges(changes)}
                          </div>
                        ) : null
                      )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function renderSchemaChanges(changes: SchemaChanges) {
  return (
    <div className="space-y-2 text-sm">
      {changes.added_fields && changes.added_fields.length > 0 && (
        <div>
          <span className="font-medium text-green-700">Added fields:</span>
          <ul className="list-disc list-inside ml-4 text-green-600">
            {changes.added_fields.map((field, idx) => (
              <li key={idx}>
                {field.name} ({field.type}){field.required ? ' [required]' : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      {changes.removed_fields && changes.removed_fields.length > 0 && (
        <div>
          <span className="font-medium text-red-700">Removed fields:</span>
          <ul className="list-disc list-inside ml-4 text-red-600">
            {changes.removed_fields.map((field, idx) => (
              <li key={idx}>
                {field.name} ({field.type}){field.required ? ' [required]' : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      {changes.modified_fields && changes.modified_fields.length > 0 && (
        <div>
          <span className="font-medium text-yellow-700">Modified fields:</span>
          <ul className="list-disc list-inside ml-4">
            {changes.modified_fields.map((field, idx) => (
              <li key={idx} className="text-gray-700">
                <span className="font-medium">{field.name}:</span>
                {field.changes &&
                  Object.entries(field.changes).map(([changeType, change]) => (
                    <div key={changeType} className="ml-4 text-xs">
                      {changeType}:{' '}
                      <span className="line-through text-red-600">{String(change.old)}</span>
                      {' → '}
                      <span className="text-green-600">{String(change.new)}</span>
                    </div>
                  ))}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
