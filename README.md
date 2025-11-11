# FastSpec - OpenAPI Editor

🧩 FastSpec — A full-stack web application to create, edit, validate, and manage your OpenAPI specifications with a modern visual editor.

📚 **[Quick Start Guide](./QUICKSTART.md)** - Get running in 5 minutes!

## Stack

- **Backend**: Python + FastAPI
- **Frontend**: Vue.js 3 + TypeScript + Vite
- **UI Library**: PrimeVue with PrimeIcons & PrimeFlex
- **Styling**: TailwindCSS + PrimeVue Themes
- **Database**: SQLite (via SQLAlchemy)
- **Validation**: openapi-spec-validator
- **Deployment**: Docker (optional, see `/docker` directory)

## Features

### Backend (FastAPI)
- **REST API** for CRUD operations on OpenAPI specifications
- **Pydantic models** for request/response validation
- **OpenAPI validation** using openapi-spec-validator
- **Detailed error messages** for invalid specifications
- **SQLite database** for persistent storage
- **CORS enabled** for frontend integration

### Frontend (Vue.js 3 + PrimeVue)
- **Dual-mode editor**: Switch between JSON editor and visual form-based editor
- **Monaco Editor**: Powerful code editor with syntax highlighting
- **Visual editor**: Intuitive forms to create and edit API information and endpoints
- **Live preview**: Integrated Swagger UI for real-time API documentation preview
- **Validation**: Frontend validation with detailed error messages
- **Modern UI**: PrimeVue components with consistent design
- **Responsive design**: Mobile-friendly interface
- **Spec management**: Save, load, update, and delete OpenAPI specifications
- **TypeScript**: Full type safety across the application

## Getting Started

### Prerequisites

- **Node.js 20+** and **npm**
- **Python 3.11+** and **pip**
- **Optional**: Docker and Docker Compose (for production deployment)

### Local Development (Recommended)

This is the primary development method for fast iteration and easy debugging.

#### 1. Clone the Repository

```bash
git clone https://github.com/DishWatcher/FastSpec.git
cd FastSpec
```

#### 2. Backend Setup

1. **Navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Create and activate a virtual environment** (recommended)
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Create environment file** (optional)
   ```bash
   cp .env.example .env
   # Edit .env if you need custom configuration
   ```

5. **Run the backend**
   ```bash
   python main.py
   ```
   
   ✅ Backend will be available at **http://localhost:8000**
   
   📚 API Documentation: **http://localhost:8000/docs**

#### 3. Frontend Setup

Open a **new terminal** and keep the backend running.

1. **Navigate to frontend directory**
   ```bash
   cd frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create environment file**
   ```bash
   cp .env.example .env.local
   # The default configuration points to http://localhost:8000
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```
   
   ✅ Frontend will be available at **http://localhost:5173** (Vite default port)

#### 4. Verify the Setup

1. Open **http://localhost:3000** in your browser
2. The application should load and connect to the backend
3. Try creating a new OpenAPI specification to verify communication

### Docker Deployment (Optional)

Docker configuration files are available in the `/docker` directory for production deployment.

1. **Navigate to docker directory**
   ```bash
   cd docker
   ```

2. **Start with Docker Compose**
   ```bash
   docker-compose -f docker-compose.yml up --build
   ```

3. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

4. **Stop the application**
   ```bash
   docker-compose -f docker-compose.yml down
   ```

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
│   └── .env.example         # Backend environment variables template
├── frontend/
│   ├── src/
│   │   ├── views/
│   │   │   └── HomeView.vue  # Main application page
│   │   ├── components/
│   │   │   ├── JsonEditor.vue       # Monaco editor component
│   │   │   ├── SwaggerPreview.vue   # Swagger UI preview
│   │   │   ├── VisualEditor.vue     # Visual form editor
│   │   │   ├── FieldEditor.vue      # Field editing component
│   │   │   ├── FieldConstraints.vue # Field constraints editor
│   │   │   ├── DiffViewer.vue       # Version comparison modal
│   │   │   └── SchemaChanges.vue    # Schema change display
│   │   ├── lib/
│   │   │   ├── api.ts               # API client
│   │   │   └── templates.ts         # OpenAPI templates
│   │   ├── router/
│   │   │   └── index.ts             # Vue Router configuration
│   │   ├── App.vue                  # Root component
│   │   └── main.ts                  # Application entry point
│   ├── package.json         # Node dependencies
│   ├── vite.config.ts       # Vite configuration
│   └── .env.example         # Frontend environment variables template
├── docker/
│   ├── docker-compose.yml   # Docker Compose orchestration
│   ├── docker-compose.dev.yml # Development Docker setup
│   ├── backend.Dockerfile   # Backend Docker configuration
│   └── frontend.Dockerfile  # Frontend Docker configuration
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
- **Vue.js 3**: Progressive JavaScript framework
- **Vite**: Next-generation frontend build tool
- **TypeScript**: Type-safe JavaScript
- **PrimeVue**: Rich component library for Vue
- **PrimeIcons**: Icon library for PrimeVue
- **PrimeFlex**: CSS utility library
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

#### Local Build

Backend:
```bash
cd backend
pip install -r requirements.txt
python main.py
```

Frontend:
```bash
cd frontend
npm install
npm run build
npm run preview
```

#### Docker Build

```bash
cd docker
docker-compose up --build -d
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

