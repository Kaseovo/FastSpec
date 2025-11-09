'use client';

import React, { useState, useEffect } from 'react';
import FieldEditor, { Field } from './FieldEditor';

interface VisualEditorProps {
  spec: Record<string, unknown>;
  onChange: (spec: Record<string, unknown>) => void;
}

export default function VisualEditor({ spec, onChange }: VisualEditorProps) {
  const [apiInfo, setApiInfo] = useState({
    title: '',
    version: '',
    description: '',
    server: '',
  });
  const [expandedEndpoint, setExpandedEndpoint] = useState<string | null>(null);

  useEffect(() => {
    const info = spec?.info as { title?: string; version?: string; description?: string } | undefined;
    const servers = spec?.servers as { url?: string }[] | undefined;
    
    setApiInfo({
      title: info?.title || '',
      version: info?.version || '',
      description: info?.description || '',
      server: servers?.[0]?.url || '',
    });
  }, [spec]);

  const handleInfoChange = (field: string, value: string) => {
    const newInfo = { ...apiInfo, [field]: value };
    setApiInfo(newInfo);

    const updatedSpec = {
      ...spec,
      info: {
        ...(spec.info as Record<string, unknown> || {}),
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
        ...(spec.paths as Record<string, unknown> || {}),
        [path]: {
          ...(spec.paths as Record<string, Record<string, unknown>> || {})?.[path] || {},
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

    const updatedPaths = { ...(spec.paths as Record<string, Record<string, unknown>> || {}) };
    delete updatedPaths[path]?.[method];

    if (Object.keys(updatedPaths[path] || {}).length === 0) {
      delete updatedPaths[path];
    }

    onChange({ ...spec, paths: updatedPaths });
  };

  const updateEndpointRequestBody = (path: string, method: string, fields: Record<string, Field>) => {
    const updatedPaths = { ...(spec.paths as Record<string, Record<string, unknown>> || {}) };
    const endpoint = { ...(updatedPaths[path]?.[method] as Record<string, unknown> || {}) };
    
    // Convert fields to OpenAPI schema
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    
    Object.entries(fields).forEach(([fieldName, field]) => {
      const property: Record<string, unknown> = {
        type: field.type,
      };
      
      if (field.description) {
        property.description = field.description;
      }
      
      // Add constraints
      if (field.constraints) {
        Object.entries(field.constraints).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            property[key] = value;
          }
        });
      }
      
      // Handle array items
      if (field.type === 'array' && field.items) {
        property.items = field.items;
      }
      
      properties[fieldName] = property;
      
      if (field.required) {
        required.push(fieldName);
      }
    });
    
    endpoint.requestBody = {
      required: required.length > 0,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties,
            ...(required.length > 0 ? { required } : {}),
          },
        },
      },
    };
    
    updatedPaths[path] = {
      ...updatedPaths[path],
      [method]: endpoint,
    };
    
    onChange({ ...spec, paths: updatedPaths });
  };

  const updateEndpointResponse = (path: string, method: string, statusCode: string, fields: Record<string, Field>) => {
    const updatedPaths = { ...(spec.paths as Record<string, Record<string, unknown>> || {}) };
    const endpoint = { ...(updatedPaths[path]?.[method] as Record<string, unknown> || {}) };
    const responses = { ...(endpoint.responses as Record<string, unknown> || {}) };
    
    // Convert fields to OpenAPI schema
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    
    Object.entries(fields).forEach(([fieldName, field]) => {
      const property: Record<string, unknown> = {
        type: field.type,
      };
      
      if (field.description) {
        property.description = field.description;
      }
      
      // Add constraints
      if (field.constraints) {
        Object.entries(field.constraints).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            property[key] = value;
          }
        });
      }
      
      // Handle array items
      if (field.type === 'array' && field.items) {
        property.items = field.items;
      }
      
      properties[fieldName] = property;
      
      if (field.required) {
        required.push(fieldName);
      }
    });
    
    responses[statusCode] = {
      description: (responses[statusCode] as Record<string, unknown>)?.description || 'Successful response',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties,
            ...(required.length > 0 ? { required } : {}),
          },
        },
      },
    };
    
    endpoint.responses = responses;
    
    updatedPaths[path] = {
      ...updatedPaths[path],
      [method]: endpoint,
    };
    
    onChange({ ...spec, paths: updatedPaths });
  };

  const getRequestBodyFields = (path: string, method: string): Record<string, Field> => {
    const endpoint = (spec.paths as Record<string, Record<string, unknown>>)?.[path]?.[method] as Record<string, unknown> | undefined;
    const requestBody = endpoint?.requestBody as Record<string, unknown> | undefined;
    const content = requestBody?.content as Record<string, unknown> | undefined;
    const applicationJson = content?.['application/json'] as Record<string, unknown> | undefined;
    const schema = applicationJson?.schema as Record<string, unknown> | undefined;
    const properties = schema?.properties as Record<string, unknown> | undefined;
    const required = (schema?.required as string[]) || [];
    
    if (!properties) return {};
    
    const fields: Record<string, Field> = {};
    Object.entries(properties).forEach(([fieldName, property]) => {
      const prop = property as Record<string, unknown>;
      const field: Field = {
        name: fieldName,
        type: (prop.type as Field['type']) || 'string',
        required: required.includes(fieldName),
        description: prop.description as string | undefined,
        constraints: {},
      };
      
      // Extract constraints
      ['maxLength', 'minLength', 'pattern', 'maximum', 'minimum', 'maxItems', 'minItems'].forEach(constraint => {
        if (prop[constraint] !== undefined) {
          field.constraints = field.constraints || {};
          (field.constraints as Record<string, unknown>)[constraint] = prop[constraint];
        }
      });
      
      // Handle array items
      if (field.type === 'array' && prop.items) {
        field.items = prop.items as { type: string };
      }
      
      fields[fieldName] = field;
    });
    
    return fields;
  };

  const getResponseFields = (path: string, method: string, statusCode: string): Record<string, Field> => {
    const endpoint = (spec.paths as Record<string, Record<string, unknown>>)?.[path]?.[method] as Record<string, unknown> | undefined;
    const responses = endpoint?.responses as Record<string, unknown> | undefined;
    const response = responses?.[statusCode] as Record<string, unknown> | undefined;
    const content = response?.content as Record<string, unknown> | undefined;
    const applicationJson = content?.['application/json'] as Record<string, unknown> | undefined;
    const schema = applicationJson?.schema as Record<string, unknown> | undefined;
    const properties = schema?.properties as Record<string, unknown> | undefined;
    const required = (schema?.required as string[]) || [];
    
    if (!properties) return {};
    
    const fields: Record<string, Field> = {};
    Object.entries(properties).forEach(([fieldName, property]) => {
      const prop = property as Record<string, unknown>;
      const field: Field = {
        name: fieldName,
        type: (prop.type as Field['type']) || 'string',
        required: required.includes(fieldName),
        description: prop.description as string | undefined,
        constraints: {},
      };
      
      // Extract constraints
      ['maxLength', 'minLength', 'pattern', 'maximum', 'minimum', 'maxItems', 'minItems'].forEach(constraint => {
        if (prop[constraint] !== undefined) {
          field.constraints = field.constraints || {};
          (field.constraints as Record<string, unknown>)[constraint] = prop[constraint];
        }
      });
      
      // Handle array items
      if (field.type === 'array' && prop.items) {
        field.items = prop.items as { type: string };
      }
      
      fields[fieldName] = field;
    });
    
    return fields;
  };

  const paths = (spec?.paths || {}) as Record<string, Record<string, unknown>>;

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
          <p className="text-gray-500 py-4">No endpoints yet. Click &quot;Add Endpoint&quot; to create one.</p>
        ) : (
          <div className="space-y-3">
            {Object.entries(paths).map(([path, methods]) =>
              Object.entries(methods).map(([method, operation]) => {
                const endpointKey = `${path}-${method}`;
                const isExpanded = expandedEndpoint === endpointKey;
                const op = operation as Record<string, unknown>;
                
                return (
                  <div
                    key={endpointKey}
                    className="border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                  >
                    {/* Endpoint Header */}
                    <div className="flex items-center justify-between p-4">
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
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{path}</div>
                          {typeof op.summary === 'string' && op.summary && (
                            <div className="text-sm text-gray-500">{op.summary}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setExpandedEndpoint(isExpanded ? null : endpointKey)}
                          className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                        >
                          {isExpanded ? 'Collapse' : 'Expand'}
                        </button>
                        <button
                          onClick={() => deleteEndpoint(path, method)}
                          className="px-3 py-1 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {/* Expanded Section */}
                    {isExpanded && (
                      <div className="border-t border-gray-200 p-4 space-y-6 bg-gray-50">
                        {/* Request Body Section */}
                        <div className="bg-white p-4 rounded-lg border border-gray-200">
                          <h4 className="text-lg font-semibold text-gray-800 mb-3">Request Body</h4>
                          <FieldEditor
                            fields={getRequestBodyFields(path, method)}
                            onChange={(fields) => updateEndpointRequestBody(path, method, fields)}
                            title="Request Fields"
                          />
                        </div>

                        {/* Response Section */}
                        <div className="bg-white p-4 rounded-lg border border-gray-200">
                          <h4 className="text-lg font-semibold text-gray-800 mb-3">Response (200)</h4>
                          <FieldEditor
                            fields={getResponseFields(path, method, '200')}
                            onChange={(fields) => updateEndpointResponse(path, method, '200', fields)}
                            title="Response Fields"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
