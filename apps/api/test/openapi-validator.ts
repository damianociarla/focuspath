import { readFile } from "node:fs/promises";
import Ajv2020, { type ValidateFunction } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { parse } from "yaml";

const document = parse(await readFile(new URL("../../../docs/openapi.yml", import.meta.url), "utf8")) as OpenApiDocument;
const responseValidators = createResponseValidators(document);

export function assertOpenApiResponse(path: string, method: string, status: number, body: unknown): void {
  const description = `${method.toUpperCase()} ${path} ${status}`;
  const validate = responseValidators.get(`${method.toLowerCase()} ${path} ${status}`);
  if (!validate) throw new Error(`OpenAPI does not document ${description}.`);
  if (!validate(body)) throw new Error(`${description} violates OpenAPI:\n${JSON.stringify(validate.errors, null, 2)}`);
}

function createResponseValidators(openApi: OpenApiDocument): Map<string, ValidateFunction> {
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictTypes: false, strictRequired: false });
  addFormats(ajv);
  const validators = new Map<string, ValidateFunction>();
  for (const [path, pathItem] of Object.entries(openApi.paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      for (const [status, unresolvedResponse] of Object.entries(operation.responses)) {
        const response = resolveResponse(openApi, unresolvedResponse);
        const schema = response.content?.["application/json"]?.schema;
        if (!schema) continue;
        validators.set(`${method.toLowerCase()} ${path} ${status}`, ajv.compile({
          $schema: "https://json-schema.org/draft/2020-12/schema",
          ...normalizeObject(schema),
          $defs: normalizeObject(openApi.components.schemas),
        }));
      }
    }
  }
  return validators;
}

function resolveResponse(openApi: OpenApiDocument, response: OpenApiResponse): OpenApiResponse {
  if (!response.$ref) return response;
  const name = response.$ref.match(/^#\/components\/responses\/([^/]+)$/)?.[1];
  if (!name || !openApi.components.responses[name]) throw new Error(`Unsupported OpenAPI response reference: ${response.$ref}`);
  return openApi.components.responses[name];
}

function normalizeObject(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeValue(item)]));
}

function normalizeValue(value: unknown): unknown {
  if (typeof value === "string" && value.startsWith("#/components/schemas/")) return value.replace("#/components/schemas/", "#/$defs/");
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeValue(item)]));
  return value;
}

type OpenApiResponse = {
  $ref?: string;
  content?: Record<string, { schema?: Record<string, unknown> }>;
};

type OpenApiDocument = {
  paths: Record<string, Record<string, { responses: Record<string, OpenApiResponse> }>>;
  components: {
    schemas: Record<string, unknown>;
    responses: Record<string, OpenApiResponse>;
  };
};
