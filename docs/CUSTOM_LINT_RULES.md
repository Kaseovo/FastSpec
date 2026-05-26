# Custom Lint Rules

FastSpec lets you extend the default `spectral:oas` ruleset with your own rules. Rules are configured per-user via the **Custom Lint Ruleset** dialog (settings icon in the LintPanel score bar).

There are two authoring modes:

| Mode | When to use |
|---|---|
| **Structured Rules** | Simple rules built with the form UI — no YAML knowledge needed |
| **Raw YAML Override** | Full control; paste a complete Spectral ruleset. Takes precedence over Structured Rules when both are present. |

---

## How a rule works

Every rule has four mandatory parts:

| Part | What it does |
|---|---|
| `given` | A **JSONPath** expression that selects the node(s) to check |
| `then.function` | The built-in Spectral function to apply |
| `severity` | How serious a violation is (`error`, `warn`, `info`, `hint`, `off`) |
| `name` | A unique identifier shown in lint results |

And two optional parts:

| Part | What it does |
|---|---|
| `then.functionOptions` | Parameters passed to the function (e.g. the regex for `pattern`) |
| `message` | Custom message shown in lint results. Use `{{value}}` or `{{path}}` as placeholders. |

---

## JSONPath cheat sheet (Spectral 6.x)

| Expression | Selects |
|---|---|
| `$` | The root of the document |
| `$.info` | The `info` object |
| `$.paths[*][*]` | Every operation (GET, POST, …) under every path |
| `$.paths[*][*].summary` | The `summary` field of every operation |
| `$.paths~` | The **keys** of `paths` (i.e. the path strings like `/users/{id}`) |
| `$.components.schemas[*]` | Every schema in `components` |
| `$.paths[*][*].responses[*]` | Every response object |

> **Spectral 6.x key selector:** Use `$.paths~` (tilde appended directly) to select path key strings.  
> `$.paths[*]~` and `field: "~"` do **not** work on Spectral 6.x.

---

## Built-in functions

### `truthy`
Passes if the selected field exists and is truthy (non-empty string, non-zero number, non-empty array, non-null object).

```yaml
then:
  function: truthy
  field: summary        # optional: check a sub-field instead of the selected node
```

### `falsy`
Passes if the selected field is absent, null, empty string, 0, or false.

```yaml
then:
  function: falsy
  field: deprecated
```

### `pattern`
Passes if the selected value matches (or does not match) a regex.

```yaml
then:
  function: pattern
  functionOptions:
    match: "^[a-z]"       # value must match this regex
    # notMatch: "[A-Z]"   # alternatively, value must NOT match
```

### `enumeration`
Passes if the selected value is one of the allowed values.

```yaml
then:
  function: enumeration
  functionOptions:
    values:
      - application/json
      - application/xml
```

### `length`
Passes if the string length or array length is within bounds.

```yaml
then:
  function: length
  functionOptions:
    min: 1
    max: 255
```

### `schema`
Passes if the selected value validates against an inline JSON Schema.

```yaml
then:
  function: schema
  functionOptions:
    schema:
      type: string
      minLength: 1
```

---

## Overriding default `spectral:oas` rules

To change the severity of a rule that ships with `spectral:oas`, list it under `rules:` with a new severity. Use `off` to silence it entirely.

```yaml
extends: spectral:oas
rules:
  info-contact: off          # silence the info-contact warning
  operation-tags: warn       # downgrade from warn to warn (or change to error/info/hint)
```

> **YAML note:** `off` without quotes is parsed as boolean `false` by YAML 1.1. Spectral accepts both `false` and the string `"off"` as "disabled". To be explicit you can write `severity: "off"` in a structured rule block.

---

## Verified working examples

These have been tested against Spectral 6.16.0 (the version running in FastSpec's Docker container).

### Silence a noisy default rule

```yaml
extends: spectral:oas
rules:
  info-contact: off
```

**Effect:** The `info-contact` warning no longer appears in lint results and no longer penalises the score.

---

### Require a summary on every operation

```yaml
extends: spectral:oas
rules:
  operation-summary-required:
    given: "$.paths[*][*]"
    severity: warn
    then:
      function: truthy
      field: summary
    message: "Operation must have a summary."
```

**Effect:** Any operation missing a `summary` field is flagged as a warning.

---

### Enforce kebab-case paths

```yaml
extends: spectral:oas
rules:
  path-kebab-case:
    given: "$.paths~"
    severity: error
    then:
      function: pattern
      functionOptions:
        match: "^(/[a-z0-9-]+)+$"
    message: "Path must use kebab-case segments."
```

**Effect:** Paths like `/Users` or `/getUser` are flagged as errors. Only lowercase letters, digits, and hyphens are allowed in each segment.

> **Important:** Use `$.paths~` (not `$.paths[*]~`). The `~` tilde directly after `paths` is the Spectral 6.x syntax for selecting path key strings.

---

### Require `operationId` on every operation

```yaml
extends: spectral:oas
rules:
  require-operation-id:
    given: "$.paths[*][*]"
    severity: error
    then:
      function: truthy
      field: operationId
    message: "Every operation must have an operationId."
```

---

### Enforce response description is non-empty

```yaml
extends: spectral:oas
rules:
  response-description-required:
    given: "$.paths[*][*].responses[*]"
    severity: warn
    then:
      function: truthy
      field: description
    message: "Every response must have a description."
```

---

### Combined ruleset (good starting point)

```yaml
extends: spectral:oas
rules:
  info-contact: off
  operation-summary-required:
    given: "$.paths[*][*]"
    severity: warn
    then:
      function: truthy
      field: summary
    message: "Operation must have a summary."
  path-kebab-case:
    given: "$.paths~"
    severity: error
    then:
      function: pattern
      functionOptions:
        match: "^(/[a-z0-9-]+)+$"
    message: "Path must use kebab-case segments."
  require-operation-id:
    given: "$.paths[*][*]"
    severity: error
    then:
      function: truthy
      field: operationId
    message: "Every operation must have an operationId."
```

---

## Score impact

| Severity | Score penalty per violation |
|---|---|
| `error` | −10 |
| `warn` | −3 |
| `info` | −1 |
| `hint` | 0 |
| `off` | 0 (rule disabled) |

Score floors at 0. Silencing a noisy default rule with `off` removes its penalty contribution and may increase your score.

---

## Further reading

- [Spectral ruleset reference](https://docs.stoplight.io/docs/spectral/e5b9616d6d50c-rulesets)
- [Spectral built-in functions](https://docs.stoplight.io/docs/spectral/ZG9jOjExNDE0OA-built-in-functions)
- [JSONPath specification](https://jsonpath.com/)
