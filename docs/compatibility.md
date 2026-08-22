# Compatibility policy

FocusPath separates the npm library contract, portable report schema and hosted HTTP API contract.

## Hosted API

`/v1` responses are evolutionary. Clients must ignore unknown response properties. A minor FocusPath release may add optional fields or enum values, but it will not remove a documented field, change its meaning or make an optional response field required within `/v1`.

Request bodies remain closed and reject unknown properties. This catches caller mistakes without preventing response evolution.

Breaking response changes require a new API path such as `/v2`. Security fixes may tighten request validation or operational limits without changing the response path.

## Report schema

`reportVersion` identifies the portable report shape independently of the package version. Consumers should branch on that value and ignore unknown properties. `generateHtmlReport` continues to accept the saved schema versions documented by its TypeScript types.

## npm package

FocusPath follows semantic versioning while it is in beta:

- patch releases fix defects without intentionally changing documented defaults;
- minor releases may add API surface and may change safety limits or beta behavior with release notes;
- major releases may remove deprecated library surface.

The canonical machine-readable hosted API contract is [`openapi.yml`](openapi.yml).
