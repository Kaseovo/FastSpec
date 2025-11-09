'use client';

import React, { useState, useEffect } from 'react';

interface VisualEditorProps {
  spec: any;
  onChange: (spec: any) => void;
}

export default function VisualEditor({ spec, onChange }: VisualEditorProps) {
  const [apiInfo, setApiInfo] = useState({
    title: '',
    version: '',
    description: '',
    server: '',
  });

  useEffect(() => {
    setApiInfo({
      title: spec?.info?.title || '',
      version: spec?.info?.version || '',
      description: spec?.info?.description || '',
      server: spec?.servers?.[0]?.url || '',
    });
  }, [spec]);

  const handleInfoChange = (field: string, value: string) => {
    const newInfo = { ...apiInfo, [field]: value };
    setApiInfo(newInfo);

    const updatedSpec = {
      ...spec,
      info: {
        ...spec.info,
        title: newInfo.title,
        version: newInfo.version,
        description: newInfo.description,
      },
      servers: newInfo.server ? [{ url: newInfo.server }] : [],
    };
    onChange(updatedSpec);
  };

  const addEndpoint = () => {
    const path = prompt('Enter endpoint path (e.g., /users/{id}):');
    if (!path) return;

    if (!path.startsWith('/')) {
      alert('Path must start with /');
      return;
    }

    const method = prompt('Enter HTTP method (get, post, put, delete):')?.toLowerCase();
    if (!method || !['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
      alert('Invalid HTTP method');
      return;
    }

    const summary = prompt('Enter endpoint summary:') || `${method.toUpperCase()} ${path}`;

    const updatedSpec = {
      ...spec,
      paths: {
        ...spec.paths,
        [path]: {
          ...spec.paths?.[path],
          [method]: {
            summary,
            responses: {
              '200': {
                description: 'Successful response',
              },
            },
          },
        },
      },
    };
    onChange(updatedSpec);
  };

  const deleteEndpoint = (path: string, method: string) => {
    if (!confirm(`Delete ${method.toUpperCase()} ${path}?`)) return;

    const updatedPaths = { ...spec.paths };
    delete updatedPaths[path]?.[method];

    if (Object.keys(updatedPaths[path] || {}).length === 0) {
      delete updatedPaths[path];
    }

    onChange({ ...spec, paths: updatedPaths });
  };

  const paths = spec?.paths || {};

  return (
    <div className="space-y-6">
      {/* API Information */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">API Information</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              API Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={apiInfo.title}
              onChange={(e) => handleInfoChange('title', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="My API"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Version <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={apiInfo.version}
              onChange={(e) => handleInfoChange('version', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="1.0.0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={apiInfo.description}
              onChange={(e) => handleInfoChange('description', e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="API description"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Base URL
            </label>
            <input
              type="text"
              value={apiInfo.server}
              onChange={(e) => handleInfoChange('server', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="https://api.example.com/v1"
            />
          </div>
        </div>
      </div>

      {/* Endpoints */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Endpoints</h2>
          <button
            onClick={addEndpoint}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Add Endpoint
          </button>
        </div>

        {Object.keys(paths).length === 0 ? (
          <p className="text-gray-500 py-4">No endpoints yet. Click "Add Endpoint" to create one.</p>
        ) : (
          <div className="space-y-3">
            {Object.entries(paths).map(([path, methods]: [string, any]) =>
              Object.entries(methods).map(([method, operation]: [string, any]) => (
                <div
                  key={`${path}-${method}`}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <span
                      className={`px-3 py-1 text-xs font-bold uppercase rounded ${
                        method === 'get'
                          ? 'bg-blue-100 text-blue-800'
                          : method === 'post'
                          ? 'bg-green-100 text-green-800'
                          : method === 'put'
                          ? 'bg-yellow-100 text-yellow-800'
                          : method === 'delete'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {method}
                    </span>
                    <div>
                      <div className="font-medium text-gray-900">{path}</div>
                      {operation.summary && (
                        <div className="text-sm text-gray-500">{operation.summary}</div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteEndpoint(path, method)}
                    className="px-3 py-1 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                  >
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
