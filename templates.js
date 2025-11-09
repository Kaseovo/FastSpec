// OpenAPI Templates
const templates = {
    basic: {
        openapi: "3.0.0",
        info: {
            title: "Basic API",
            version: "1.0.0",
            description: "A simple REST API"
        },
        servers: [
            {
                url: "https://api.example.com/v1",
                description: "Production server"
            }
        ],
        paths: {
            "/users": {
                get: {
                    summary: "Get all users",
                    tags: ["users"],
                    responses: {
                        "200": {
                            description: "Successful response",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "array",
                                        items: {
                                            type: "object",
                                            properties: {
                                                id: { type: "integer" },
                                                name: { type: "string" },
                                                email: { type: "string" }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                post: {
                    summary: "Create a new user",
                    tags: ["users"],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        name: { type: "string" },
                                        email: { type: "string" }
                                    },
                                    required: ["name", "email"]
                                }
                            }
                        }
                    },
                    responses: {
                        "201": {
                            description: "User created",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            id: { type: "integer" },
                                            name: { type: "string" },
                                            email: { type: "string" }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "/users/{id}": {
                get: {
                    summary: "Get user by ID",
                    tags: ["users"],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: {
                                type: "integer"
                            }
                        }
                    ],
                    responses: {
                        "200": {
                            description: "Successful response",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            id: { type: "integer" },
                                            name: { type: "string" },
                                            email: { type: "string" }
                                        }
                                    }
                                }
                            }
                        },
                        "404": {
                            description: "User not found"
                        }
                    }
                }
            }
        }
    },
    petstore: {
        openapi: "3.0.0",
        info: {
            title: "Swagger Petstore",
            version: "1.0.0",
            description: "A sample Pet Store Server based on the OpenAPI 3.0 specification"
        },
        servers: [
            {
                url: "https://petstore.swagger.io/v2"
            }
        ],
        paths: {
            "/pet": {
                post: {
                    summary: "Add a new pet to the store",
                    tags: ["pet"],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        name: { type: "string", example: "doggie" },
                                        status: { 
                                            type: "string", 
                                            enum: ["available", "pending", "sold"]
                                        }
                                    }
                                }
                            }
                        }
                    },
                    responses: {
                        "200": {
                            description: "Successful operation"
                        }
                    }
                }
            },
            "/pet/{petId}": {
                get: {
                    summary: "Find pet by ID",
                    tags: ["pet"],
                    parameters: [
                        {
                            name: "petId",
                            in: "path",
                            required: true,
                            schema: {
                                type: "integer",
                                format: "int64"
                            }
                        }
                    ],
                    responses: {
                        "200": {
                            description: "Successful operation",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            id: { type: "integer" },
                                            name: { type: "string" },
                                            status: { type: "string" }
                                        }
                                    }
                                }
                            }
                        },
                        "404": {
                            description: "Pet not found"
                        }
                    }
                }
            }
        }
    },
    ecommerce: {
        openapi: "3.0.0",
        info: {
            title: "E-Commerce API",
            version: "1.0.0",
            description: "API for managing products and orders"
        },
        servers: [
            {
                url: "https://api.shop.example.com/v1"
            }
        ],
        paths: {
            "/products": {
                get: {
                    summary: "List all products",
                    tags: ["products"],
                    responses: {
                        "200": {
                            description: "Successful response",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "array",
                                        items: {
                                            type: "object",
                                            properties: {
                                                id: { type: "integer" },
                                                name: { type: "string" },
                                                price: { type: "number" },
                                                stock: { type: "integer" }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "/orders": {
                post: {
                    summary: "Create a new order",
                    tags: ["orders"],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        productId: { type: "integer" },
                                        quantity: { type: "integer" },
                                        customerId: { type: "integer" }
                                    },
                                    required: ["productId", "quantity", "customerId"]
                                }
                            }
                        }
                    },
                    responses: {
                        "201": {
                            description: "Order created",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            id: { type: "integer" },
                                            status: { type: "string" },
                                            total: { type: "number" }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "/orders/{id}": {
                get: {
                    summary: "Get order by ID",
                    tags: ["orders"],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: {
                                type: "integer"
                            }
                        }
                    ],
                    responses: {
                        "200": {
                            description: "Successful response",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            id: { type: "integer" },
                                            status: { type: "string" },
                                            total: { type: "number" },
                                            items: { type: "array" }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
};

// Get template by name
function getTemplate(name) {
    return templates[name] || templates.basic;
}
