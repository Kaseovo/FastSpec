// OpenAPI Validator
class OpenAPIValidator {
    constructor() {
        this.errors = [];
        this.warnings = [];
    }

    validate(spec) {
        this.errors = [];
        this.warnings = [];

        if (!spec) {
            this.errors.push("Empty specification");
            return false;
        }

        // Check OpenAPI version
        if (!spec.openapi) {
            this.errors.push("Missing 'openapi' field (required)");
        } else if (!spec.openapi.startsWith("3.0") && !spec.openapi.startsWith("3.1")) {
            this.warnings.push(`OpenAPI version ${spec.openapi} - this validator is optimized for 3.0.x and 3.1.x`);
        }

        // Check info object
        if (!spec.info) {
            this.errors.push("Missing 'info' object (required)");
        } else {
            if (!spec.info.title) {
                this.errors.push("Missing 'info.title' (required)");
            }
            if (!spec.info.version) {
                this.errors.push("Missing 'info.version' (required)");
            }
        }

        // Check paths
        if (!spec.paths) {
            this.errors.push("Missing 'paths' object (required)");
        } else {
            this.validatePaths(spec.paths);
        }

        // Check servers (optional but recommended)
        if (!spec.servers || spec.servers.length === 0) {
            this.warnings.push("No 'servers' defined - consider adding at least one server URL");
        } else {
            this.validateServers(spec.servers);
        }

        // Check components (optional)
        if (spec.components) {
            this.validateComponents(spec.components);
        }

        return this.errors.length === 0;
    }

    validatePaths(paths) {
        if (typeof paths !== 'object') {
            this.errors.push("'paths' must be an object");
            return;
        }

        const validMethods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace'];

        for (const [path, pathItem] of Object.entries(paths)) {
            if (!path.startsWith('/')) {
                this.errors.push(`Path '${path}' must start with '/'`);
            }

            if (typeof pathItem !== 'object') {
                this.errors.push(`Path item '${path}' must be an object`);
                continue;
            }

            // Check for valid HTTP methods
            for (const [key, operation] of Object.entries(pathItem)) {
                if (validMethods.includes(key)) {
                    this.validateOperation(operation, `${path}.${key}`);
                } else if (key !== 'parameters' && key !== 'summary' && key !== 'description' && key !== 'servers') {
                    this.warnings.push(`Unknown key '${key}' in path '${path}'`);
                }
            }
        }
    }

    validateOperation(operation, location) {
        if (typeof operation !== 'object') {
            this.errors.push(`Operation at '${location}' must be an object`);
            return;
        }

        // Responses are required
        if (!operation.responses) {
            this.errors.push(`Missing 'responses' in operation '${location}' (required)`);
        } else {
            this.validateResponses(operation.responses, location);
        }

        // Check parameters if present
        if (operation.parameters) {
            if (!Array.isArray(operation.parameters)) {
                this.errors.push(`'parameters' in '${location}' must be an array`);
            } else {
                operation.parameters.forEach((param, idx) => {
                    this.validateParameter(param, `${location}.parameters[${idx}]`);
                });
            }
        }

        // Check requestBody if present
        if (operation.requestBody) {
            this.validateRequestBody(operation.requestBody, location);
        }

        // Check tags (optional but recommended)
        if (!operation.tags || operation.tags.length === 0) {
            this.warnings.push(`No tags defined for operation '${location}' - consider adding tags for better organization`);
        }
    }

    validateResponses(responses, location) {
        if (typeof responses !== 'object') {
            this.errors.push(`'responses' at '${location}' must be an object`);
            return;
        }

        if (Object.keys(responses).length === 0) {
            this.errors.push(`'responses' at '${location}' must have at least one response`);
        }

        for (const [statusCode, response] of Object.entries(responses)) {
            if (statusCode !== 'default' && !/^\d{3}$/.test(statusCode)) {
                this.errors.push(`Invalid status code '${statusCode}' at '${location}.responses'`);
            }

            if (typeof response !== 'object') {
                this.errors.push(`Response at '${location}.responses.${statusCode}' must be an object`);
                continue;
            }

            if (!response.description) {
                this.errors.push(`Missing 'description' in response '${location}.responses.${statusCode}' (required)`);
            }

            if (response.content) {
                this.validateContent(response.content, `${location}.responses.${statusCode}`);
            }
        }
    }

    validateParameter(parameter, location) {
        if (!parameter.name) {
            this.errors.push(`Missing 'name' in parameter at '${location}' (required)`);
        }

        if (!parameter.in) {
            this.errors.push(`Missing 'in' in parameter at '${location}' (required)`);
        } else if (!['query', 'header', 'path', 'cookie'].includes(parameter.in)) {
            this.errors.push(`Invalid 'in' value '${parameter.in}' at '${location}' - must be one of: query, header, path, cookie`);
        }

        if (parameter.in === 'path' && !parameter.required) {
            this.errors.push(`Path parameter at '${location}' must have 'required: true'`);
        }

        if (!parameter.schema && !parameter.content) {
            this.errors.push(`Parameter at '${location}' must have either 'schema' or 'content'`);
        }
    }

    validateRequestBody(requestBody, location) {
        if (!requestBody.content) {
            this.errors.push(`Missing 'content' in requestBody at '${location}' (required)`);
        } else {
            this.validateContent(requestBody.content, `${location}.requestBody`);
        }
    }

    validateContent(content, location) {
        if (typeof content !== 'object') {
            this.errors.push(`'content' at '${location}' must be an object`);
            return;
        }

        for (const [mediaType, mediaTypeObject] of Object.entries(content)) {
            if (!mediaTypeObject.schema) {
                this.warnings.push(`Media type '${mediaType}' at '${location}.content' has no schema`);
            }
        }
    }

    validateServers(servers) {
        if (!Array.isArray(servers)) {
            this.errors.push("'servers' must be an array");
            return;
        }

        servers.forEach((server, idx) => {
            if (!server.url) {
                this.errors.push(`Missing 'url' in server[${idx}] (required)`);
            }
        });
    }

    validateComponents(components) {
        // Basic validation for components
        if (typeof components !== 'object') {
            this.errors.push("'components' must be an object");
        }
    }

    getErrors() {
        return this.errors;
    }

    getWarnings() {
        return this.warnings;
    }

    isValid() {
        return this.errors.length === 0;
    }

    getReport() {
        let report = '';
        
        if (this.errors.length > 0) {
            report += '❌ Errors:\n';
            this.errors.forEach((error, idx) => {
                report += `  ${idx + 1}. ${error}\n`;
            });
        }

        if (this.warnings.length > 0) {
            if (report) report += '\n';
            report += '⚠️ Warnings:\n';
            this.warnings.forEach((warning, idx) => {
                report += `  ${idx + 1}. ${warning}\n`;
            });
        }

        if (this.errors.length === 0 && this.warnings.length === 0) {
            report = '✅ Valid OpenAPI specification!';
        }

        return report;
    }
}
