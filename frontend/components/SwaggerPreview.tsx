'use client';

import React from 'react';
import dynamic from 'next/dynamic';

const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false });
import 'swagger-ui-react/swagger-ui.css';

interface SwaggerPreviewProps {
  spec: any;
}

export default function SwaggerPreview({ spec }: SwaggerPreviewProps) {
  if (!spec || Object.keys(spec).length === 0) {
    return (
      <div className="p-4 text-gray-500">
        <p>No specification available for preview</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm">
      <SwaggerUI spec={spec} />
    </div>
  );
}
