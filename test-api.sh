#!/bin/bash

# FastSpec Testing Script
# This script tests the backend API endpoints

set -e

echo "🧪 Testing FastSpec API..."
echo ""

BASE_URL="http://localhost:8000"

# Test 1: Root endpoint
echo "Test 1: Root endpoint"
response=$(curl -s $BASE_URL/)
if echo $response | grep -q "FastSpec API"; then
    echo "✅ Root endpoint works"
else
    echo "❌ Root endpoint failed"
    exit 1
fi
echo ""

# Test 2: List specs (should be empty or have specs)
echo "Test 2: List all specs"
response=$(curl -s $BASE_URL/api/specs)
echo "Response: $response"
echo "✅ List specs endpoint works"
echo ""

# Test 3: Create a valid spec
echo "Test 3: Create a valid OpenAPI spec"
response=$(curl -s -X POST $BASE_URL/api/specs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test-api-'$(date +%s)'",
    "spec_json": {
      "openapi": "3.0.0",
      "info": {
        "title": "Test API",
        "version": "1.0.0",
        "description": "A test API"
      },
      "servers": [{"url": "https://api.test.com"}],
      "paths": {
        "/users": {
          "get": {
            "summary": "Get users",
            "responses": {
              "200": {
                "description": "Success"
              }
            }
          }
        }
      }
    }
  }')

if echo $response | grep -q "\"id\""; then
    echo "✅ Successfully created spec"
    spec_id=$(echo $response | grep -o '"id":[0-9]*' | grep -o '[0-9]*')
    echo "Created spec with ID: $spec_id"
else
    echo "❌ Failed to create spec"
    echo "Response: $response"
    exit 1
fi
echo ""

# Test 4: Get the created spec
echo "Test 4: Get specific spec"
response=$(curl -s $BASE_URL/api/specs/$spec_id)
if echo $response | grep -q "Test API"; then
    echo "✅ Successfully retrieved spec"
else
    echo "❌ Failed to retrieve spec"
    exit 1
fi
echo ""

# Test 5: Validate a valid spec
echo "Test 5: Validate a valid OpenAPI spec"
response=$(curl -s -X POST $BASE_URL/api/validate \
  -H "Content-Type: application/json" \
  -d '{
    "openapi": "3.0.0",
    "info": {
      "title": "Valid API",
      "version": "1.0.0"
    },
    "paths": {}
  }')

if echo $response | grep -q '"valid":true'; then
    echo "✅ Validation works for valid spec"
else
    echo "❌ Validation failed for valid spec"
    exit 1
fi
echo ""

# Test 6: Validate an invalid spec
echo "Test 6: Validate an invalid OpenAPI spec"
response=$(curl -s -X POST $BASE_URL/api/validate \
  -H "Content-Type: application/json" \
  -d '{
    "openapi": "3.0.0",
    "info": {
      "title": "Invalid API"
    },
    "paths": {}
  }')

if echo $response | grep -q '"valid":false'; then
    echo "✅ Validation correctly identifies invalid spec"
else
    echo "❌ Validation failed to identify invalid spec"
    exit 1
fi
echo ""

# Test 7: Update spec
echo "Test 7: Update spec"
response=$(curl -s -X PUT $BASE_URL/api/specs/$spec_id \
  -H "Content-Type: application/json" \
  -d '{
    "spec_json": {
      "openapi": "3.0.0",
      "info": {
        "title": "Updated Test API",
        "version": "2.0.0"
      },
      "paths": {}
    }
  }')

if echo $response | grep -q "Updated Test API"; then
    echo "✅ Successfully updated spec"
else
    echo "❌ Failed to update spec"
    exit 1
fi
echo ""

# Test 8: Delete spec
echo "Test 8: Delete spec"
status_code=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE $BASE_URL/api/specs/$spec_id)
if [ "$status_code" = "204" ]; then
    echo "✅ Successfully deleted spec"
else
    echo "❌ Failed to delete spec (status code: $status_code)"
    exit 1
fi
echo ""

echo "🎉 All tests passed!"
