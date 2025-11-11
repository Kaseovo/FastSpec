# FastSpec Frontend - Vue.js

This is the frontend application for FastSpec, built with Vue.js 3, TypeScript, and PrimeVue.

## Tech Stack

- **Vue.js 3**: Progressive JavaScript framework with Composition API
- **TypeScript**: Type-safe development
- **Vite**: Fast build tool and dev server
- **PrimeVue**: Rich component library
- **PrimeIcons**: Icon library
- **PrimeFlex**: CSS utility library
- **Monaco Editor**: Code editor for JSON editing
- **Swagger UI**: OpenAPI documentation preview
- **Axios**: HTTP client for API calls

## Development

### Install Dependencies

```bash
npm install
```

### Run Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Type Check

```bash
npm run type-check
```

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

### Lint Code

```bash
npm run lint
```

### Format Code

```bash
npm run format
```

## Project Structure

```
src/
├── components/          # Vue components
│   ├── DiffViewer.vue
│   ├── FieldConstraints.vue
│   ├── FieldEditor.vue
│   ├── JsonEditor.vue
│   ├── SchemaChanges.vue
│   ├── SwaggerPreview.vue
│   └── VisualEditor.vue
├── views/               # Page components
│   └── HomeView.vue
├── lib/                 # Shared utilities
│   ├── api.ts          # API client
│   └── templates.ts    # OpenAPI templates
├── router/             # Vue Router configuration
│   └── index.ts
├── assets/             # Static assets
├── App.vue             # Root component
└── main.ts             # Application entry point
```

## Environment Variables

Create a `.env.local` file in the frontend directory:

```bash
cp .env.example .env.local
```

Available variables:

- `VITE_API_URL`: Backend API URL (default: `http://localhost:8000`)

## Features

### JSON Editor Mode
- Monaco code editor with syntax highlighting
- Real-time OpenAPI JSON editing
- Live Swagger UI preview

### Visual Editor Mode
- Form-based API specification editing
- Endpoint management
- Field editor with type validation
- Constraint configuration

### Specification Management
- List all saved specifications
- Load, save, update, and delete specifications
- Version comparison (diff viewer)

### Validation
- OpenAPI specification validation
- Error and warning display
- Detailed validation messages

## Development Notes

### Component Communication
- Uses Vue 3 Composition API with `<script setup>` syntax
- Props and emits for parent-child communication
- Reactive state management with `ref` and `reactive`

### Styling
- PrimeVue components for UI elements
- TailwindCSS utility classes for custom styling
- Responsive design with flexbox and grid

### TypeScript
- Strict type checking enabled
- Interface definitions for all data structures
- Type-safe API client

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## Contributing

When adding new features:

1. Create components in `src/components/`
2. Add views in `src/views/`
3. Update router if needed
4. Maintain TypeScript types
5. Follow Vue 3 Composition API patterns
6. Use PrimeVue components when possible

## Troubleshooting

### Build Errors

If you encounter build errors:

```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Type Errors

Run type checking separately:

```bash
npm run type-check
```

### Dev Server Issues

Try clearing Vite cache:

```bash
rm -rf node_modules/.vite
npm run dev
```
