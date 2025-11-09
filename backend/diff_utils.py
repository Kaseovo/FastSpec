"""
Utility functions for comparing OpenAPI specifications
"""
from typing import Dict, Any, List, Tuple
import json


def compare_specs(current_spec: Dict[str, Any], previous_spec: Dict[str, Any]) -> Dict[str, Any]:
    """
    Compare two OpenAPI specifications and generate a diff report.
    
    Returns a dictionary with:
    - added_endpoints: List of endpoints added
    - removed_endpoints: List of endpoints removed
    - modified_endpoints: List of endpoints modified
    - info_changes: Changes in API info section
    """
    diff = {
        "added_endpoints": [],
        "removed_endpoints": [],
        "modified_endpoints": [],
        "info_changes": {},
        "has_changes": False
    }
    
    # Compare info section
    current_info = current_spec.get("info", {})
    previous_info = previous_spec.get("info", {})
    
    for field in ["title", "version", "description"]:
        if current_info.get(field) != previous_info.get(field):
            diff["info_changes"][field] = {
                "old": previous_info.get(field),
                "new": current_info.get(field)
            }
            diff["has_changes"] = True
    
    # Compare paths
    current_paths = current_spec.get("paths", {})
    previous_paths = previous_spec.get("paths", {})
    
    current_endpoints = set()
    previous_endpoints = set()
    
    # Build endpoint lists
    for path, methods in current_paths.items():
        for method in methods.keys():
            current_endpoints.add((path, method))
    
    for path, methods in previous_paths.items():
        for method in methods.keys():
            previous_endpoints.add((path, method))
    
    # Find added endpoints
    added = current_endpoints - previous_endpoints
    for path, method in added:
        diff["added_endpoints"].append({
            "path": path,
            "method": method,
            "summary": current_paths[path][method].get("summary", "")
        })
        diff["has_changes"] = True
    
    # Find removed endpoints
    removed = previous_endpoints - current_endpoints
    for path, method in removed:
        diff["removed_endpoints"].append({
            "path": path,
            "method": method,
            "summary": previous_paths[path][method].get("summary", "")
        })
        diff["has_changes"] = True
    
    # Find modified endpoints
    common = current_endpoints & previous_endpoints
    for path, method in common:
        current_endpoint = current_paths[path][method]
        previous_endpoint = previous_paths[path][method]
        
        changes = compare_endpoint(current_endpoint, previous_endpoint, path, method)
        if changes["has_changes"]:
            diff["modified_endpoints"].append(changes)
            diff["has_changes"] = True
    
    return diff


def compare_endpoint(current: Dict[str, Any], previous: Dict[str, Any], 
                     path: str, method: str) -> Dict[str, Any]:
    """
    Compare two endpoint definitions and return the differences.
    """
    changes = {
        "path": path,
        "method": method,
        "summary_changed": False,
        "request_body_changes": {},
        "response_changes": {},
        "has_changes": False
    }
    
    # Check summary
    if current.get("summary") != previous.get("summary"):
        changes["summary_changed"] = True
        changes["summary_old"] = previous.get("summary")
        changes["summary_new"] = current.get("summary")
        changes["has_changes"] = True
    
    # Compare request body
    current_request = current.get("requestBody", {})
    previous_request = previous.get("requestBody", {})
    
    if current_request or previous_request:
        request_changes = compare_schema(
            get_request_schema(current_request),
            get_request_schema(previous_request)
        )
        if request_changes["has_changes"]:
            changes["request_body_changes"] = request_changes
            changes["has_changes"] = True
    
    # Compare responses
    current_responses = current.get("responses", {})
    previous_responses = previous.get("responses", {})
    
    all_status_codes = set(current_responses.keys()) | set(previous_responses.keys())
    
    for status_code in all_status_codes:
        current_response = current_responses.get(status_code, {})
        previous_response = previous_responses.get(status_code, {})
        
        response_changes = compare_schema(
            get_response_schema(current_response),
            get_response_schema(previous_response)
        )
        
        if response_changes["has_changes"]:
            changes["response_changes"][status_code] = response_changes
            changes["has_changes"] = True
    
    return changes


def get_request_schema(request_body: Dict[str, Any]) -> Dict[str, Any]:
    """Extract schema from request body"""
    content = request_body.get("content", {})
    json_content = content.get("application/json", {})
    return json_content.get("schema", {})


def get_response_schema(response: Dict[str, Any]) -> Dict[str, Any]:
    """Extract schema from response"""
    content = response.get("content", {})
    json_content = content.get("application/json", {})
    return json_content.get("schema", {})


def compare_schema(current: Dict[str, Any], previous: Dict[str, Any]) -> Dict[str, Any]:
    """
    Compare two schemas and return the differences.
    """
    changes = {
        "added_fields": [],
        "removed_fields": [],
        "modified_fields": [],
        "has_changes": False
    }
    
    current_props = current.get("properties", {})
    previous_props = previous.get("properties", {})
    
    current_required = set(current.get("required", []))
    previous_required = set(previous.get("required", []))
    
    # Find added fields
    for field_name in set(current_props.keys()) - set(previous_props.keys()):
        changes["added_fields"].append({
            "name": field_name,
            "type": current_props[field_name].get("type"),
            "required": field_name in current_required
        })
        changes["has_changes"] = True
    
    # Find removed fields
    for field_name in set(previous_props.keys()) - set(current_props.keys()):
        changes["removed_fields"].append({
            "name": field_name,
            "type": previous_props[field_name].get("type"),
            "required": field_name in previous_required
        })
        changes["has_changes"] = True
    
    # Find modified fields
    for field_name in set(current_props.keys()) & set(previous_props.keys()):
        current_field = current_props[field_name]
        previous_field = previous_props[field_name]
        
        field_changes = {}
        
        # Check type change
        if current_field.get("type") != previous_field.get("type"):
            field_changes["type"] = {
                "old": previous_field.get("type"),
                "new": current_field.get("type")
            }
        
        # Check required change
        current_req = field_name in current_required
        previous_req = field_name in previous_required
        if current_req != previous_req:
            field_changes["required"] = {
                "old": previous_req,
                "new": current_req
            }
        
        # Check constraint changes
        constraints = ["maxLength", "minLength", "pattern", "maximum", "minimum", 
                      "maxItems", "minItems"]
        for constraint in constraints:
            if current_field.get(constraint) != previous_field.get(constraint):
                field_changes[constraint] = {
                    "old": previous_field.get(constraint),
                    "new": current_field.get(constraint)
                }
        
        if field_changes:
            changes["modified_fields"].append({
                "name": field_name,
                "changes": field_changes
            })
            changes["has_changes"] = True
    
    return changes


def generate_markdown_report(diff: Dict[str, Any]) -> str:
    """
    Generate a markdown report from the diff.
    """
    if not diff["has_changes"]:
        return "## No changes detected\n\nThe specifications are identical."
    
    report = "# OpenAPI Specification Changes\n\n"
    
    # Info changes
    if diff["info_changes"]:
        report += "## API Information Changes\n\n"
        for field, change in diff["info_changes"].items():
            report += f"- **{field}**: `{change['old']}` → `{change['new']}`\n"
        report += "\n"
    
    # Added endpoints
    if diff["added_endpoints"]:
        report += "## ✅ Added Endpoints\n\n"
        for endpoint in diff["added_endpoints"]:
            report += f"- **{endpoint['method'].upper()} {endpoint['path']}**"
            if endpoint.get("summary"):
                report += f" - {endpoint['summary']}"
            report += "\n"
        report += "\n"
    
    # Removed endpoints
    if diff["removed_endpoints"]:
        report += "## ❌ Removed Endpoints\n\n"
        for endpoint in diff["removed_endpoints"]:
            report += f"- **{endpoint['method'].upper()} {endpoint['path']}**"
            if endpoint.get("summary"):
                report += f" - {endpoint['summary']}"
            report += "\n"
        report += "\n"
    
    # Modified endpoints
    if diff["modified_endpoints"]:
        report += "## 🔄 Modified Endpoints\n\n"
        for endpoint in diff["modified_endpoints"]:
            report += f"### {endpoint['method'].upper()} {endpoint['path']}\n\n"
            
            if endpoint.get("summary_changed"):
                report += f"**Summary**: `{endpoint.get('summary_old')}` → `{endpoint.get('summary_new')}`\n\n"
            
            # Request body changes
            if endpoint.get("request_body_changes", {}).get("has_changes"):
                report += "**Request Body Changes:**\n\n"
                report += format_schema_changes(endpoint["request_body_changes"])
            
            # Response changes
            if endpoint.get("response_changes"):
                for status, changes in endpoint["response_changes"].items():
                    if changes.get("has_changes"):
                        report += f"**Response {status} Changes:**\n\n"
                        report += format_schema_changes(changes)
            
            report += "\n"
    
    return report


def format_schema_changes(changes: Dict[str, Any]) -> str:
    """Format schema changes for markdown report"""
    output = ""
    
    if changes.get("added_fields"):
        output += "Added fields:\n"
        for field in changes["added_fields"]:
            required = " (required)" if field["required"] else ""
            output += f"- `{field['name']}` ({field['type']}){required}\n"
        output += "\n"
    
    if changes.get("removed_fields"):
        output += "Removed fields:\n"
        for field in changes["removed_fields"]:
            required = " (required)" if field["required"] else ""
            output += f"- `{field['name']}` ({field['type']}){required}\n"
        output += "\n"
    
    if changes.get("modified_fields"):
        output += "Modified fields:\n"
        for field in changes["modified_fields"]:
            output += f"- `{field['name']}`:\n"
            for change_type, change in field["changes"].items():
                output += f"  - {change_type}: `{change['old']}` → `{change['new']}`\n"
        output += "\n"
    
    return output
