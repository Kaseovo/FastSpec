'use client';

import React from 'react';
import dynamic from 'next/dynamic';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: string;
}

export default function JsonEditor({ value, onChange, height = '600px' }: JsonEditorProps) {
  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      <MonacoEditor
        height={height}
        defaultLanguage="json"
        theme="vs-dark"
        value={value}
        onChange={(newValue) => onChange(newValue || '')}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: 'on',
          automaticLayout: true,
          scrollBeyondLastLine: false,
        }}
      />
    </div>
  );
}
