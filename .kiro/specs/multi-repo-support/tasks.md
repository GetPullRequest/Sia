# Implementation Plan

- [ ] 1. Set up database schema and migrations for multi-repo support

  - Create database migration for repository configurations table
  - Add repos array column to jobs table
  - Define TypeScript types for RepoConfig and related models
  - Set up proper indexes and constraints for performance
  - _Requirements: 6.1, 6.2, 6.3, 8.4_

- [ ]\* 1.1 Write property test for database schema

  - **Property 9: Configuration persistence round-trip**
  - **Validates: Requirements 2.5**

- [ ]\* 1.2 Write property test for data migration integrity

  - **Property 27: Data migration integrity**
  - **Validates: Requirements 8.4**

- [ ] 2. Implement repository configuration service

  - Create RepoConfigService with CRUD operations
  - Implement getConfig, saveConfig, deleteConfig methods
  - Add batch operations for multiple repositories
  - Implement upsert logic for configuration updates
  - Add comprehensive error handling and logging
  - _Requirements: 6.1, 6.2, 6.3, 4.1, 4.2_

- [ ]\* 2.1 Write property test for configuration CRUD operations

  - **Property 21: API endpoint functionality completeness**
  - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**

- [ ]\* 2.2 Write property test for custom configuration precedence

  - **Property 14: Custom configuration precedence**
  - **Validates: Requirements 4.1, 4.2**

- [ ] 3. Create API endpoints for repository configuration management

  - Implement GET /repos/:repoId/config endpoint
  - Implement POST /repos/:repoId/config endpoint with upsert logic
  - Implement DELETE /repos/:repoId/config endpoint
  - Implement GET /repos/org/:orgId/configs endpoint
  - Add authentication and authorization middleware
  - Implement comprehensive error responses
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ]\* 3.1 Write property test for API error responses

  - **Property 22: API error response informativeness**
  - **Validates: Requirements 6.5**

- [ ]\* 3.2 Write property test for configuration validation

  - **Property 15: Configuration validation integrity**
  - **Validates: Requirements 4.3**

- [ ] 4. Implement language detection system core infrastructure

  - Create LanguageDetector interface and DetectedConfig types
  - Implement AutoDetectionError class with actionable messages
  - Create main language detector orchestrator with priority system
  - Add fallback logic and error handling for detection failures
  - _Requirements: 2.1, 2.6_

- [ ]\* 4.1 Write property test for auto-detection strategy consistency

  - **Property 5: Auto-detection strategy consistency**
  - **Validates: Requirements 2.1**

- [ ]\* 4.2 Write property test for auto-detection failure handling

  - **Property 10: Auto-detection failure handling**
  - **Validates: Requirements 2.6**

- [ ] 5. Implement Node.js project detector

  - Create NodejsDetector class implementing LanguageDetector interface
  - Add package.json parsing and script extraction logic
  - Implement package manager detection from lock files (npm, yarn, pnpm)
  - Generate appropriate setup, build, and test commands
  - Add validation for Node.js project structure
  - _Requirements: 2.2_

- [ ]\* 5.1 Write property test for Node.js configuration extraction

  - **Property 6: Node.js configuration extraction accuracy**
  - **Validates: Requirements 2.2**

- [ ] 6. Implement Python project detector

  - Create PythonDetector class implementing LanguageDetector interface
  - Add pyproject.toml and requirements.txt parsing logic
  - Implement preference for pyproject.toml over requirements.txt
  - Generate appropriate Python build and test commands
  - Add support for common Python testing frameworks
  - _Requirements: 2.3_

- [ ]\* 6.1 Write property test for Python configuration detection

  - **Property 7: Python configuration detection completeness**
  - **Validates: Requirements 2.3**

- [ ] 7. Implement DevContainer detector

  - Create DevContainerDetector class implementing LanguageDetector interface
  - Add devcontainer.json parsing with JSON comment support
  - Extract container image and run arguments safely
  - Implement minimal parsing approach (ignore complex features)
  - Add validation for DevContainer configuration format
  - _Requirements: 2.4_

- [ ]\* 7.1 Write property test for DevContainer configuration parsing

  - **Property 8: DevContainer configuration parsing correctness**
  - **Validates: Requirements 2.4**

- [ ] 8. Implement environment variable management system

  - Create EnvironmentManager class for secure variable handling
  - Implement loading from ~/.sia/env/<orgId>/<repoId>/ directories
  - Add preflight validation for required environment variables
  - Implement MissingEnvFileError and MissingEnvKeysError classes
  - Generate setup instructions for missing environment files
  - Set appropriate file permissions for security (600)
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ]\* 8.1 Write property test for environment variable storage security

  - **Property 11: Environment variable storage security**
  - **Validates: Requirements 3.1, 3.2**

- [ ]\* 8.2 Write property test for environment variable validation

  - **Property 12: Environment variable validation completeness**
  - **Validates: Requirements 3.3, 3.4**

- [ ]\* 8.3 Write property test for environment file security permissions

  - **Property 13: Environment file security permissions**
  - **Validates: Requirements 3.5**

- [ ] 9. Enhance workspace manager for Git worktree support

  - Extend WorkspaceManager to support Git worktree operations
  - Implement createWorktree and cleanupWorktree methods
  - Add support for shared bare repositories
  - Implement workspace isolation for concurrent jobs
  - Add proper error handling for Git operations
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ]\* 9.1 Write property test for Git worktree isolation

  - **Property 18: Git worktree isolation**
  - **Validates: Requirements 5.1, 5.4**

- [ ]\* 9.2 Write property test for bare repository sharing

  - **Property 19: Bare repository sharing efficiency**
  - **Validates: Requirements 5.2, 5.5**

- [ ]\* 9.3 Write property test for workspace cleanup

  - **Property 20: Workspace cleanup completeness**
  - **Validates: Requirements 5.3**

- [ ] 10. Checkpoint - Ensure all backend and agent tests pass

  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Implement multi-repository job execution logic

  - Extend job executor to handle multiple repositories
  - Implement sequential processing of repository list
  - Add auto-detection integration for first-time repositories
  - Implement configuration saving for detected configurations
  - Add error isolation so failures don't stop other repositories
  - Generate separate pull requests for each modified repository
  - _Requirements: 1.2, 1.3, 1.4, 2.5_

- [ ]\* 11.1 Write property test for multi-repository selection completeness

  - **Property 1: Multi-repository selection completeness**
  - **Validates: Requirements 1.1, 1.2**

- [ ]\* 11.2 Write property test for pull request generation consistency

  - **Property 2: Pull request generation consistency**
  - **Validates: Requirements 1.3**

- [ ]\* 11.3 Write property test for error isolation

  - **Property 3: Error isolation in multi-repository jobs**
  - **Validates: Requirements 1.4**

- [ ] 12. Update job execution service for backward compatibility

  - Modify job processing to handle both repo string and repos array
  - Implement backward compatibility for existing single-repo jobs
  - Update database queries to support both job formats
  - Ensure legacy job display continues to work correctly
  - _Requirements: 8.1, 8.2, 8.3, 8.5_

- [ ]\* 12.1 Write property test for backward compatibility preservation

  - **Property 26: Backward compatibility preservation**
  - **Validates: Requirements 8.1, 8.2, 8.3, 8.5**

- [ ] 13. Implement multi-repository job creation UI

  - Replace single-select dropdown with multi-select checkbox interface
  - Add search functionality for filtering repositories by name
  - Implement repository selection state management
  - Add clear all functionality with selection count display
  - Create scrollable interface with appropriate height limits
  - Update API calls to send repos array instead of single repo
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ]\* 13.1 Write property test for repository search filtering

  - **Property 23: Repository search filtering accuracy**
  - **Validates: Requirements 7.2**

- [ ]\* 13.2 Write property test for repository selection state consistency

  - **Property 24: Repository selection state consistency**
  - **Validates: Requirements 7.3**

- [ ] 14. Implement job results display for multi-repository jobs

  - Update job results UI to show status for each repository
  - Display pull request links separately for each repository
  - Implement consistent display for both single and multi-repo jobs
  - Add success messages with repository count information
  - _Requirements: 1.5, 7.5_

- [ ]\* 14.1 Write property test for repository result completeness

  - **Property 4: Repository result completeness**
  - **Validates: Requirements 1.5**

- [ ]\* 14.2 Write property test for success message accuracy

  - **Property 25: Success message accuracy**
  - **Validates: Requirements 7.5**

- [ ] 15. Implement command injection prevention

  - Update repository configuration to store commands as arrays
  - Add validation to reject string-based command configurations
  - Implement safe command execution using array format
  - Update all detectors to generate command arrays
  - _Requirements: 4.5_

- [ ]\* 15.1 Write property test for command injection prevention

  - **Property 17: Command injection prevention**
  - **Validates: Requirements 4.5**

- [ ] 16. Implement execution strategy enumeration support

  - Add support for all four execution strategies in configuration UI
  - Implement strategy validation in repository configuration
  - Add strategy-specific configuration options
  - Update configuration service to handle all strategy types
  - _Requirements: 4.4_

- [ ]\* 16.1 Write property test for execution strategy completeness

  - **Property 16: Execution strategy enumeration completeness**
  - **Validates: Requirements 4.4**

- [ ] 17. Final checkpoint - Ensure all tests pass and system integration works
  - Ensure all tests pass, ask the user if questions arise.
  - Verify end-to-end multi-repository job creation and execution
  - Test backward compatibility with existing single-repository jobs
  - Validate security measures for environment variable handling
  - Confirm proper error handling and user feedback
