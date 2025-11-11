export const basicTemplate = {
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
      }
    }
  }
};

export const emptyTemplate = {
  openapi: "3.0.0",
  info: {
    title: "New API",
    version: "1.0.0",
    description: ""
  },
  servers: [],
  paths: {}
};
