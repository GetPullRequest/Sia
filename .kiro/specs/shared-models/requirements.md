# Requirements Document: Shared Models Library

## Introduction

This document specifies the requirements for the Shared Models Library (`libs/models`). This library contains shared TypeScript types, protobuf definitions, and generated API clients used across all SIA applications.

## Glossary

- **Protobuf**: Protocol Buffers - language-neutral data serialization format
- **OpenAPI**: Specification for describing REST APIs
- **ts-proto**: TypeScript code generator for protobuf
- **@hey-api/openapi-ts**: OpenAPI client generator for TypeScript

## Requirements

### Requirement 1: Protobuf Definitions

**User Story:** As a developer, I want shared protobuf definitions, so that gRPC communication is type-safe.

#### Acceptance Criteria

1. WHEN defining gRPC services THEN the library SHALL contain proto files
2. WHEN proto files change THEN the library SHALL regenerate TypeScript types
3. WHEN importing types THEN applications SHALL use generated types from this library

### Requirement 2: OpenAPI Client

**User Story:** As a developer, I want a generated API client, so that REST API calls are type-safe.

#### Acceptance Criteria

1. WHEN the backend OpenAPI spec changes THEN the library SHALL regenerate the client
2. WHEN making API calls THEN applications SHALL use the generated client
3. WHEN types change THEN TypeScript SHALL catch incompatibilities at compile time

### Requirement 3: Shared Types

**User Story:** As a developer, I want shared TypeScript types, so that data structures are consistent.

#### Acceptance Criteria

1. WHEN defining data models THEN the library SHALL export TypeScript interfaces
2. WHEN applications need types THEN they SHALL import from this library
3. WHEN types change THEN all applications SHALL be updated consistently
