# FastSpec - OpenAPI Editor

🧩 FastSpec — define, validate, and document your FastAPI endpoints with type-safe OpenAPI specs.

## Web Application

FastSpec now includes a powerful web-based OpenAPI (Swagger) editor that lets you visually create, edit, and validate OpenAPI JSON definitions for your APIs.

### Features

- **Dual-Mode Editor**: Switch between JSON editor and visual form-based editor
- **Syntax Highlighting**: Clean JSON editor with real-time syntax validation
- **OpenAPI Validation**: Built-in validator that checks your spec against OpenAPI 3.0 standards
- **Live Preview**: See your API documentation rendered in real-time
- **Template Library**: Quick-start templates for common API patterns (Basic, Pet Store, E-Commerce)
- **Visual Endpoint Builder**: Create and edit endpoints using intuitive forms
- **Import/Export**: Load and save OpenAPI JSON files
- **Comprehensive Validation**: Detailed error and warning messages to help you fix issues

### Getting Started

1. **Open the Editor**
   - Simply open `index.html` in a web browser
   - No installation or build process required!

2. **Choose Your Starting Point**
   - Click "New" to start from scratch
   - Click "Load Template" to use a pre-built template
   - Click "Import JSON" to load an existing OpenAPI file

3. **Edit Your API**
   
   **JSON Editor Mode:**
   - Edit the OpenAPI JSON directly in the left panel
   - See live documentation preview in the right panel
   - Changes are validated automatically
   
   **Visual Editor Mode:**
   - Click "Visual Editor" to switch modes
   - Fill in API information (title, version, description, base URL)
   - Add endpoints using the "Add Endpoint" button
   - Edit or delete existing endpoints

4. **Validate Your Spec**
   - Click "Validate" to check for errors and warnings
   - Fix any issues reported by the validator
   - Green checkmark means your spec is valid!

5. **Export Your Work**
   - Click "Export JSON" to download your OpenAPI specification
   - Use it with Swagger UI, FastAPI, or any OpenAPI-compatible tool

### Usage Tips

- **Path Parameters**: Use curly braces in paths, e.g., `/users/{id}`
- **Tags**: Add comma-separated tags to organize endpoints
- **Response Schemas**: Define JSON schemas for response bodies
- **Validation**: Run validation frequently to catch issues early
- **Templates**: Use templates as learning examples for OpenAPI structure

### OpenAPI 3.0 Support

The editor supports OpenAPI 3.0.x specifications and validates:

- Required fields (`openapi`, `info`, `paths`)
- Info object (title, version)
- Path definitions and HTTP methods
- Operation objects (responses, parameters, requestBody)
- Response definitions
- Parameter definitions
- Content types and schemas

### File Structure

```
FastSpec/
├── index.html        # Main HTML page
├── styles.css        # Styling and layout
├── app.js           # Application logic and UI handlers
├── validator.js     # OpenAPI validation engine
├── templates.js     # Pre-built OpenAPI templates
└── README.md        # This file
```

### Browser Compatibility

Works in all modern browsers:
- Chrome/Edge (recommended)
- Firefox
- Safari
- Opera

### Examples

The app includes three starter templates:

1. **Basic API**: Simple REST API with user endpoints
2. **Pet Store**: Classic Swagger Petstore example
3. **E-Commerce**: Products and orders API

### Contributing

Feel free to contribute by:
- Adding more templates
- Improving validation rules
- Enhancing the UI
- Fixing bugs

### License

Open source and free to use!

---

**Note**: This is a client-side application. All data is processed in your browser and nothing is sent to any server. Your API specifications remain private and secure.
