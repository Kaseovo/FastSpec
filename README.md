# FastSpec - OpenAPI Editor

🧩 FastSpec — A full-stack web application to create, edit, validate, and manage your OpenAPI specifications with a modern visual editor.

## Stack

- **Backend**: Python + FastAPI
- **Frontend**: Next.js + React + TypeScript
- **Styling**: TailwindCSS
- **Database**: SQLite (via SQLAlchemy)
- **Validation**: openapi-spec-validator
- **Deployment**: Docker + Docker Compose

## Features

### Backend (FastAPI)
- **REST API** for CRUD operations on OpenAPI specifications
- **Pydantic models** for request/response validation
- **OpenAPI validation** using openapi-spec-validator
- **Detailed error messages** for invalid specifications
- **SQLite database** for persistent storage
- **CORS enabled** for frontend integration

### Frontend (Next.js + React + TypeScript)
- **Dual-mode editor**: Switch between JSON editor and visual form-based editor
- **Monaco Editor**: Powerful code editor with syntax highlighting
- **Visual editor**: Intuitive forms to create and edit API information and endpoints
- **Live preview**: Integrated Swagger UI for real-time API documentation preview
- **Validation**: Frontend validation with detailed error messages
- **Responsive design**: TailwindCSS for modern, mobile-friendly interface
- **Spec management**: Save, load, update, and delete OpenAPI specifications

## Getting Started

### Prerequisites

- Docker and Docker Compose (recommended)
- OR Node.js 20+ and Python 3.11+ (for local development)

### Option 1: Using Docker (Recommended)

1. **Clone the repository**
   ```bash
   git clone https://github.com/DishWatcher/FastSpec.git
   cd FastSpec
   ```

2. **Start the application**
   ```bash
   docker-compose up --build
   ```

3. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

4. **Stop the application**
   ```bash
   docker-compose down
   ```

### Option 2: Local Development

#### Backend Setup

1. **Navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Create a virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Run the backend**
   ```bash
   python main.py
   ```
   
   The backend will be available at http://localhost:8000

#### Frontend Setup

1. **Navigate to frontend directory** (in a new terminal)
   ```bash
   cd frontend
   ```

2. **Install dependencies**
   ```bash
   npm install --legacy-peer-deps
   ```

3. **Create environment file**
   ```bash
   echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
   ```

4. **Run the frontend**
   ```bash
   npm run dev
   ```
   
   The frontend will be available at http://localhost:3000

## Usage Guide

### Creating a New Specification

1. Click **"New"** to start with an empty specification
2. Or click **"Load Template"** to start with a pre-built template
3. Edit the API information (title, version, description, base URL)
4. Add endpoints using the **"Add Endpoint"** button
5. Click **"Save"** and enter a name to save the specification

### Editing Modes

#### JSON Editor Mode
- Edit the OpenAPI JSON directly in a Monaco code editor
- See live Swagger UI preview on the right
- Automatic syntax validation

#### Visual Editor Mode
- Fill in forms for API information
- Add, edit, and delete endpoints visually
- User-friendly interface for non-technical users

### Validation

1. Click **"Validate"** to check your specification
2. View detailed error messages and warnings
3. Fix any issues reported by the validator
4. Re-validate until all errors are resolved

### Managing Specifications

- **Saved Specs Sidebar**: View all saved specifications
- **Load**: Click on a spec to load it into the editor
- **Delete**: Click the delete button to remove a spec
- **Update**: Load a spec, make changes, and click "Save" to update

## API Endpoints

### Specifications

- `GET /api/specs` - List all specifications
- `GET /api/specs/{id}` - Get a specific specification
- `POST /api/specs` - Create a new specification
- `PUT /api/specs/{id}` - Update a specification
- `DELETE /api/specs/{id}` - Delete a specification

### Validation

- `POST /api/validate` - Validate an OpenAPI specification

## Project Structure

```
FastSpec/
├── backend/
│   ├── main.py              # FastAPI application
│   ├── database.py          # Database models and setup
│   ├── schemas.py           # Pydantic schemas
│   ├── validator.py         # OpenAPI validation logic
│   ├── requirements.txt     # Python dependencies
│   └── Dockerfile           # Backend Docker configuration
├── frontend/
│   ├── app/
│   │   ├── page.tsx         # Main application page
│   │   ├── layout.tsx       # Root layout
│   │   └── globals.css      # Global styles
│   ├── components/
│   │   ├── JsonEditor.tsx   # Monaco editor component
│   │   ├── SwaggerPreview.tsx # Swagger UI preview
│   │   └── VisualEditor.tsx # Visual form editor
│   ├── lib/
│   │   ├── api.ts           # API client
│   │   └── templates.ts     # OpenAPI templates
│   ├── package.json         # Node dependencies
│   ├── Dockerfile           # Frontend Docker configuration
│   └── next.config.ts       # Next.js configuration
├── docker-compose.yml       # Docker Compose orchestration
├── .gitignore              # Git ignore rules
└── README.md               # This file
```

## Technology Details

### Backend Technologies
- **FastAPI**: Modern, fast web framework for building APIs
- **Pydantic**: Data validation using Python type annotations
- **SQLAlchemy**: SQL toolkit and ORM
- **openapi-spec-validator**: Comprehensive OpenAPI validation
- **Uvicorn**: ASGI web server

### Frontend Technologies
- **Next.js 15**: React framework with App Router
- **React 19**: UI library
- **TypeScript**: Type-safe JavaScript
- **TailwindCSS**: Utility-first CSS framework
- **Monaco Editor**: VS Code's code editor
- **Swagger UI React**: OpenAPI documentation renderer
- **Axios**: HTTP client

## Development

### Running Tests

Backend:
```bash
cd backend
pytest
```

Frontend:
```bash
cd frontend
npm run test
```

### Building for Production

Using Docker:
```bash
docker-compose up --build -d
```

Manual build:
```bash
# Backend
cd backend
pip install -r requirements.txt

# Frontend
cd frontend
npm install --legacy-peer-deps
npm run build
npm start
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

Open source and free to use!

## Acknowledgments

- OpenAPI Specification
- FastAPI framework
- Next.js team
- All contributors and users

