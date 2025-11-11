'use client';

import React, { useState } from 'react';

export interface FieldConstraints {
  // String constraints
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  // Number constraints
  maximum?: number;
  minimum?: number;
  // Array constraints
  maxItems?: number;
  minItems?: number;
}

export interface Field {
  name: string;
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  required: boolean;
  description?: string;
  constraints?: FieldConstraints;
  items?: { type: string }; // For array types
  properties?: Record<string, Field>; // For object types
}

interface FieldEditorProps {
  fields: Record<string, Field>;
  onChange: (fields: Record<string, Field>) => void;
  title?: string;
}

export default function FieldEditor({ fields, onChange, title = 'Fields' }: FieldEditorProps) {
  const [expandedField, setExpandedField] = useState<string | null>(null);
  const [showAddField, setShowAddField] = useState(false);
  const [newField, setNewField] = useState<Field>({
    name: '',
    type: 'string',
    required: false,
    description: '',
    constraints: {},
  });

  const handleAddField = () => {
    if (!newField.name) {
      alert('Field name is required');
      return;
    }
    if (fields[newField.name]) {
      alert('Field with this name already exists');
      return;
    }

    const updatedFields = {
      ...fields,
      [newField.name]: { ...newField },
    };
    onChange(updatedFields);
    setNewField({
      name: '',
      type: 'string',
      required: false,
      description: '',
      constraints: {},
    });
    setShowAddField(false);
  };

  const handleDeleteField = (fieldName: string) => {
    if (!confirm(`Delete field "${fieldName}"?`)) return;
    const updatedFields = { ...fields };
    delete updatedFields[fieldName];
    onChange(updatedFields);
  };

  const handleUpdateField = (fieldName: string, updates: Partial<Field>) => {
    const updatedFields = {
      ...fields,
      [fieldName]: { ...fields[fieldName], ...updates },
    };
    onChange(updatedFields);
  };

  const handleConstraintChange = (fieldName: string, constraint: string, value: string | number) => {
    const field = fields[fieldName];
    const constraints = { ...field.constraints };
    
    if (value === '' || value === null || value === undefined) {
      delete constraints[constraint as keyof FieldConstraints];
    } else {
      (constraints as Record<string, string | number>)[constraint] = value;
    }

    handleUpdateField(fieldName, { constraints });
  };

  const renderConstraints = (fieldName: string, field: Field) => {
    const { type, constraints = {} } = field;

    return (
      <div className="mt-3 space-y-3 bg-gray-50 p-3 rounded-lg">
        <h5 className="font-medium text-sm text-gray-700">Constraints</h5>
        
        {type === 'string' && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Min Length</label>
                <input
                  type="number"
                  min="0"
                  value={constraints.minLength || ''}
                  onChange={(e) => handleConstraintChange(fieldName, 'minLength', parseInt(e.target.value) || '')}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Max Length</label>
                <input
                  type="number"
                  min="0"
                  value={constraints.maxLength || ''}
                  onChange={(e) => handleConstraintChange(fieldName, 'maxLength', parseInt(e.target.value) || '')}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                  placeholder="∞"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Pattern (Regex)</label>
              <input
                type="text"
                value={constraints.pattern || ''}
                onChange={(e) => handleConstraintChange(fieldName, 'pattern', e.target.value)}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                placeholder="^[A-Za-z]+$"
              />
            </div>
          </>
        )}

        {(type === 'number' || type === 'integer') && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Minimum</label>
              <input
                type="number"
                value={constraints.minimum !== undefined ? constraints.minimum : ''}
                onChange={(e) => handleConstraintChange(fieldName, 'minimum', e.target.value ? parseFloat(e.target.value) : '')}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                placeholder="-∞"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Maximum</label>
              <input
                type="number"
                value={constraints.maximum !== undefined ? constraints.maximum : ''}
                onChange={(e) => handleConstraintChange(fieldName, 'maximum', e.target.value ? parseFloat(e.target.value) : '')}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                placeholder="∞"
              />
            </div>
          </div>
        )}

        {type === 'array' && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Min Items</label>
              <input
                type="number"
                min="0"
                value={constraints.minItems || ''}
                onChange={(e) => handleConstraintChange(fieldName, 'minItems', parseInt(e.target.value) || '')}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Max Items</label>
              <input
                type="number"
                min="0"
                value={constraints.maxItems || ''}
                onChange={(e) => handleConstraintChange(fieldName, 'maxItems', parseInt(e.target.value) || '')}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                placeholder="∞"
              />
            </div>
          </div>
        )}

        {type === 'array' && (
          <div>
            <label className="block text-xs text-gray-600 mb-1">Item Type</label>
            <select
              value={field.items?.type || 'string'}
              onChange={(e) => handleUpdateField(fieldName, { items: { type: e.target.value } })}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
            >
              <option value="string">String</option>
              <option value="number">Number</option>
              <option value="integer">Integer</option>
              <option value="boolean">Boolean</option>
              <option value="object">Object</option>
            </select>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="font-semibold text-gray-800">{title}</h4>
        <button
          onClick={() => setShowAddField(!showAddField)}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          {showAddField ? 'Cancel' : '+ Add Field'}
        </button>
      </div>

      {showAddField && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Field Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={newField.name}
              onChange={(e) => setNewField({ ...newField, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="fieldName"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={newField.type}
              onChange={(e) => setNewField({ ...newField, type: e.target.value as Field['type'] })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="string">String</option>
              <option value="number">Number</option>
              <option value="integer">Integer</option>
              <option value="boolean">Boolean</option>
              <option value="array">Array</option>
              <option value="object">Object</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              type="text"
              value={newField.description || ''}
              onChange={(e) => setNewField({ ...newField, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Field description"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="new-field-required"
              checked={newField.required}
              onChange={(e) => setNewField({ ...newField, required: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="new-field-required" className="ml-2 text-sm text-gray-700">
              Required field
            </label>
          </div>

          <button
            onClick={handleAddField}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Add Field
          </button>
        </div>
      )}

      {Object.keys(fields).length === 0 ? (
        <p className="text-gray-500 text-sm py-4">No fields defined. Click &quot;Add Field&quot; to create one.</p>
      ) : (
        <div className="space-y-2">
          {Object.entries(fields).map(([fieldName, field]) => (
            <div
              key={fieldName}
              className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{fieldName}</span>
                    {field.required && (
                      <span className="px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-800 rounded">
                        Required
                      </span>
                    )}
                    <span className="px-2 py-0.5 text-xs font-semibold bg-gray-100 text-gray-700 rounded">
                      {field.type}
                    </span>
                  </div>
                  {field.description && (
                    <p className="text-sm text-gray-600 mt-1">{field.description}</p>
                  )}
                  {Object.keys(field.constraints || {}).length > 0 && (
                    <div className="mt-1 text-xs text-gray-500">
                      Constraints: {Object.entries(field.constraints || {}).map(([key, value]) => `${key}: ${value}`).join(', ')}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setExpandedField(expandedField === fieldName ? null : fieldName)}
                    className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                  >
                    {expandedField === fieldName ? 'Collapse' : 'Edit'}
                  </button>
                  <button
                    onClick={() => handleDeleteField(fieldName)}
                    className="px-3 py-1 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {expandedField === fieldName && (
                <div className="mt-4 space-y-3 pt-3 border-t border-gray-200">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <input
                      type="text"
                      value={field.description || ''}
                      onChange={(e) => handleUpdateField(fieldName, { description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Field description"
                    />
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id={`required-${fieldName}`}
                      checked={field.required}
                      onChange={(e) => handleUpdateField(fieldName, { required: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor={`required-${fieldName}`} className="ml-2 text-sm text-gray-700">
                      Required field
                    </label>
                  </div>

                  {renderConstraints(fieldName, field)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
