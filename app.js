// Main Application Logic
let currentSpec = null;
let currentMode = 'editor'; // 'editor' or 'visual'
let editingEndpointIndex = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    loadDefaultSpec();
    setupEventListeners();
    updatePreview();
});

function setupEventListeners() {
    // Toolbar buttons
    document.getElementById('newBtn').addEventListener('click', createNew);
    document.getElementById('loadTemplateBtn').addEventListener('click', showTemplateModal);
    document.getElementById('importBtn').addEventListener('click', importJSON);
    document.getElementById('exportBtn').addEventListener('click', exportJSON);
    document.getElementById('validateBtn').addEventListener('click', validateSpec);
    document.getElementById('toggleModeBtn').addEventListener('click', toggleMode);

    // Editor updates
    document.getElementById('jsonEditor').addEventListener('input', debounce(handleEditorChange, 500));

    // Visual editor - API info
    document.getElementById('apiTitle').addEventListener('input', syncFromVisualEditor);
    document.getElementById('apiVersion').addEventListener('input', syncFromVisualEditor);
    document.getElementById('apiDescription').addEventListener('input', syncFromVisualEditor);
    document.getElementById('apiServer').addEventListener('input', syncFromVisualEditor);

    // Endpoints
    document.getElementById('addEndpointBtn').addEventListener('click', showEndpointModal);
    document.getElementById('saveEndpointBtn').addEventListener('click', saveEndpoint);

    // Modals
    setupModalHandlers();
}

function setupModalHandlers() {
    const templateModal = document.getElementById('templateModal');
    const endpointModal = document.getElementById('endpointModal');

    // Close buttons
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', function() {
            this.closest('.modal').style.display = 'none';
        });
    });

    // Click outside to close
    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    });

    // Template selection
    document.querySelectorAll('.template-card').forEach(card => {
        card.addEventListener('click', function() {
            const templateName = this.getAttribute('data-template');
            loadTemplate(templateName);
            templateModal.style.display = 'none';
        });
    });
}

function loadDefaultSpec() {
    currentSpec = getTemplate('basic');
    updateEditor();
    updateVisualEditor();
}

function createNew() {
    if (confirm('Create a new OpenAPI specification? Current changes will be lost.')) {
        currentSpec = {
            openapi: "3.0.0",
            info: {
                title: "New API",
                version: "1.0.0",
                description: ""
            },
            servers: [],
            paths: {}
        };
        updateEditor();
        updateVisualEditor();
        updatePreview();
    }
}

function showTemplateModal() {
    document.getElementById('templateModal').style.display = 'block';
}

function loadTemplate(name) {
    currentSpec = getTemplate(name);
    updateEditor();
    updateVisualEditor();
    updatePreview();
    showValidationStatus('Template loaded successfully!', 'success');
}

function importJSON() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = function(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    currentSpec = JSON.parse(e.target.result);
                    updateEditor();
                    updateVisualEditor();
                    updatePreview();
                    showValidationStatus('JSON imported successfully!', 'success');
                } catch (error) {
                    showValidationStatus('Invalid JSON file: ' + error.message, 'error');
                }
            };
            reader.readAsText(file);
        }
    };
    input.click();
}

function exportJSON() {
    const dataStr = JSON.stringify(currentSpec, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = (currentSpec.info?.title || 'openapi').toLowerCase().replace(/\s+/g, '-') + '.json';
    link.click();
    URL.revokeObjectURL(url);
    showValidationStatus('JSON exported successfully!', 'success');
}

function validateSpec() {
    const validator = new OpenAPIValidator();
    const isValid = validator.validate(currentSpec);
    
    const report = validator.getReport();
    
    if (isValid) {
        if (validator.getWarnings().length > 0) {
            showValidationStatus(report, 'warning');
        } else {
            showValidationStatus(report, 'success');
        }
    } else {
        showValidationStatus(report, 'error');
    }
}

function showValidationStatus(message, type) {
    const statusEl = document.getElementById('validationStatus');
    statusEl.textContent = message;
    statusEl.className = 'validation-status ' + type;
    statusEl.style.whiteSpace = 'pre-wrap';
    
    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
        setTimeout(() => {
            statusEl.style.display = 'none';
        }, 5000);
    }
}

function toggleMode() {
    const editorContainer = document.getElementById('editorContainer');
    const visualContainer = document.getElementById('visualContainer');
    const toggleBtn = document.getElementById('toggleModeBtn');

    if (currentMode === 'editor') {
        currentMode = 'visual';
        editorContainer.classList.add('hidden');
        visualContainer.classList.remove('hidden');
        toggleBtn.textContent = 'JSON Editor';
        updateVisualEditor();
    } else {
        currentMode = 'editor';
        editorContainer.classList.remove('hidden');
        visualContainer.classList.add('hidden');
        toggleBtn.textContent = 'Visual Editor';
        updateEditor();
    }
}

function handleEditorChange() {
    const editor = document.getElementById('jsonEditor');
    try {
        currentSpec = JSON.parse(editor.value);
        updatePreview();
        // Clear any previous error
        editor.style.borderColor = '#dcdde1';
    } catch (error) {
        // Invalid JSON - show visual feedback
        editor.style.borderColor = '#e74c3c';
    }
}

function updateEditor() {
    const editor = document.getElementById('jsonEditor');
    editor.value = JSON.stringify(currentSpec, null, 2);
    editor.style.borderColor = '#dcdde1';
}

function updatePreview() {
    const preview = document.getElementById('previewContainer');
    
    if (!currentSpec) {
        preview.innerHTML = '<p>No specification loaded</p>';
        return;
    }

    let html = '';

    // API Info
    if (currentSpec.info) {
        html += '<div class="api-info">';
        html += `<h3>${escapeHtml(currentSpec.info.title || 'Untitled API')}</h3>`;
        html += `<p><strong>Version:</strong> ${escapeHtml(currentSpec.info.version || 'N/A')}</p>`;
        if (currentSpec.info.description) {
            html += `<p><strong>Description:</strong> ${escapeHtml(currentSpec.info.description)}</p>`;
        }
        if (currentSpec.servers && currentSpec.servers.length > 0) {
            html += `<p><strong>Base URL:</strong> ${escapeHtml(currentSpec.servers[0].url)}</p>`;
        }
        html += '</div>';
    }

    // Endpoints
    if (currentSpec.paths) {
        html += '<h3>Endpoints</h3>';
        for (const [path, pathItem] of Object.entries(currentSpec.paths)) {
            for (const [method, operation] of Object.entries(pathItem)) {
                if (['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].includes(method)) {
                    html += renderEndpoint(method, path, operation);
                }
            }
        }
    }

    preview.innerHTML = html || '<p>No endpoints defined</p>';
}

function renderEndpoint(method, path, operation) {
    let html = '<div class="endpoint">';
    html += '<div class="endpoint-header">';
    html += `<span class="method-badge method-${method}">${method.toUpperCase()}</span>`;
    html += `<span class="endpoint-path">${escapeHtml(path)}</span>`;
    html += '</div>';
    html += '<div class="endpoint-body">';
    
    if (operation.summary) {
        html += `<p><strong>Summary:</strong> ${escapeHtml(operation.summary)}</p>`;
    }
    
    if (operation.description) {
        html += `<p><strong>Description:</strong> ${escapeHtml(operation.description)}</p>`;
    }
    
    if (operation.tags && operation.tags.length > 0) {
        html += `<p><strong>Tags:</strong> ${operation.tags.map(t => escapeHtml(t)).join(', ')}</p>`;
    }

    if (operation.parameters && operation.parameters.length > 0) {
        html += '<p><strong>Parameters:</strong></p><ul>';
        operation.parameters.forEach(param => {
            html += `<li>${escapeHtml(param.name)} (${param.in}) - ${param.required ? 'required' : 'optional'}</li>`;
        });
        html += '</ul>';
    }

    if (operation.responses) {
        html += '<p><strong>Responses:</strong></p><ul>';
        for (const [status, response] of Object.entries(operation.responses)) {
            html += `<li><strong>${status}</strong>: ${escapeHtml(response.description || 'No description')}</li>`;
        }
        html += '</ul>';
    }
    
    html += '</div></div>';
    return html;
}

function updateVisualEditor() {
    if (!currentSpec) return;

    document.getElementById('apiTitle').value = currentSpec.info?.title || '';
    document.getElementById('apiVersion').value = currentSpec.info?.version || '';
    document.getElementById('apiDescription').value = currentSpec.info?.description || '';
    
    if (currentSpec.servers && currentSpec.servers.length > 0) {
        document.getElementById('apiServer').value = currentSpec.servers[0].url || '';
    } else {
        document.getElementById('apiServer').value = '';
    }

    updateEndpointsList();
}

function syncFromVisualEditor() {
    if (!currentSpec) {
        currentSpec = { openapi: "3.0.0", info: {}, servers: [], paths: {} };
    }

    if (!currentSpec.info) currentSpec.info = {};
    
    currentSpec.info.title = document.getElementById('apiTitle').value || 'Untitled API';
    currentSpec.info.version = document.getElementById('apiVersion').value || '1.0.0';
    currentSpec.info.description = document.getElementById('apiDescription').value || '';

    const serverUrl = document.getElementById('apiServer').value;
    if (serverUrl) {
        currentSpec.servers = [{ url: serverUrl }];
    } else {
        currentSpec.servers = [];
    }

    updateEditor();
    updatePreview();
}

function updateEndpointsList() {
    const container = document.getElementById('endpointsList');
    container.innerHTML = '';

    if (!currentSpec.paths || Object.keys(currentSpec.paths).length === 0) {
        container.innerHTML = '<p style="color: #7f8c8d; margin-top: 10px;">No endpoints yet. Click "Add Endpoint" to create one.</p>';
        return;
    }

    for (const [path, pathItem] of Object.entries(currentSpec.paths)) {
        for (const [method, operation] of Object.entries(pathItem)) {
            if (['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].includes(method)) {
                const endpointDiv = document.createElement('div');
                endpointDiv.className = 'endpoint-item';
                endpointDiv.innerHTML = `
                    <span class="method-badge method-${method}">${method.toUpperCase()}</span>
                    <div class="endpoint-item-info">
                        <strong>${escapeHtml(path)}</strong>
                        ${operation.summary ? `<br><small>${escapeHtml(operation.summary)}</small>` : ''}
                    </div>
                    <div class="endpoint-item-actions">
                        <button class="btn btn-small btn-secondary" onclick="editEndpoint('${escapeHtml(path)}', '${method}')">Edit</button>
                        <button class="btn btn-small btn-danger" onclick="deleteEndpoint('${escapeHtml(path)}', '${method}')">Delete</button>
                    </div>
                `;
                container.appendChild(endpointDiv);
            }
        }
    }
}

function showEndpointModal(path = null, method = null) {
    const modal = document.getElementById('endpointModal');
    
    // Reset form
    document.getElementById('endpointPath').value = path || '';
    document.getElementById('endpointMethod').value = method || 'get';
    document.getElementById('endpointSummary').value = '';
    document.getElementById('endpointDescription').value = '';
    document.getElementById('endpointTags').value = '';
    document.getElementById('endpointResponse').value = '';

    // If editing, populate with existing data
    if (path && method && currentSpec.paths[path] && currentSpec.paths[path][method]) {
        const operation = currentSpec.paths[path][method];
        document.getElementById('endpointSummary').value = operation.summary || '';
        document.getElementById('endpointDescription').value = operation.description || '';
        document.getElementById('endpointTags').value = operation.tags ? operation.tags.join(', ') : '';
        
        if (operation.responses && operation.responses['200'] && operation.responses['200'].content) {
            const schema = operation.responses['200'].content['application/json']?.schema;
            if (schema) {
                document.getElementById('endpointResponse').value = JSON.stringify(schema, null, 2);
            }
        }
    }

    modal.style.display = 'block';
}

function editEndpoint(path, method) {
    showEndpointModal(path, method);
}

function deleteEndpoint(path, method) {
    if (confirm(`Delete ${method.toUpperCase()} ${path}?`)) {
        if (currentSpec.paths[path]) {
            delete currentSpec.paths[path][method];
            
            // If no methods left, delete the path
            if (Object.keys(currentSpec.paths[path]).length === 0) {
                delete currentSpec.paths[path];
            }
        }
        
        updateEditor();
        updateVisualEditor();
        updatePreview();
        showValidationStatus('Endpoint deleted', 'success');
    }
}

function saveEndpoint() {
    const path = document.getElementById('endpointPath').value.trim();
    const method = document.getElementById('endpointMethod').value;
    const summary = document.getElementById('endpointSummary').value.trim();
    const description = document.getElementById('endpointDescription').value.trim();
    const tagsInput = document.getElementById('endpointTags').value.trim();
    const responseInput = document.getElementById('endpointResponse').value.trim();

    if (!path) {
        alert('Path is required');
        return;
    }

    if (!path.startsWith('/')) {
        alert('Path must start with /');
        return;
    }

    // Initialize paths if needed
    if (!currentSpec.paths) currentSpec.paths = {};
    if (!currentSpec.paths[path]) currentSpec.paths[path] = {};

    // Create operation
    const operation = {
        summary: summary || `${method.toUpperCase()} ${path}`,
        responses: {
            "200": {
                description: "Successful response"
            }
        }
    };

    if (description) {
        operation.description = description;
    }

    if (tagsInput) {
        operation.tags = tagsInput.split(',').map(t => t.trim()).filter(t => t);
    }

    // Parse response schema
    if (responseInput) {
        try {
            const schema = JSON.parse(responseInput);
            operation.responses["200"].content = {
                "application/json": {
                    schema: schema
                }
            };
        } catch (error) {
            alert('Invalid JSON in response schema: ' + error.message);
            return;
        }
    }

    currentSpec.paths[path][method] = operation;

    // Close modal and update
    document.getElementById('endpointModal').style.display = 'none';
    updateEditor();
    updateVisualEditor();
    updatePreview();
    showValidationStatus('Endpoint saved successfully!', 'success');
}

// Utility functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
