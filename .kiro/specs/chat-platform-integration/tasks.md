# Implementation Plan: Chat Platform Integration

## Core Messaging Infrastructure

- [x] 1. Platform Adapter Pattern
  - [x] 1.1 Define MessagingAdapter interface
    - Create `apps/api/src/services/messaging/messaging-adapter.ts`
    - Define UnifiedMessage, SendOptions, Attachment types
    - _Requirements: 1.1, 1.2_
  - [x] 1.2 Define shared messaging types
    - Create `apps/api/src/services/messaging/messaging-types.ts`
    - Define ConversationState, RelevanceResult, ChannelSettings
    - _Requirements: 1.3_
  - [ ]* 1.3 Write property test for platform independence
    - **Property 3: Platform Independence**
    - **Validates: Requirements 1.1, 1.3**

- [x] 2. Conversation Manager
  - [x] 2.1 Implement conversation state tracking
    - Create `apps/api/src/services/messaging/conversation-manager.ts`
    - Track active conversations per thread
    - _Requirements: 3.1, 3.2, 3.4_
  - [x] 2.2 Implement message handling coordination
    - Route messages to appropriate handlers
    - Determine priority based on mention status
    - _Requirements: 2.1, 2.4, 4.1_
  - [ ]* 2.3 Write property test for explicit mention handling
    - **Property 1: Explicit Mention Always Responds**
    - **Validates: Requirements 2.1, 2.4**
  - [ ]* 2.4 Write property test for DM handling
    - **Property 2: DM Always Responds**
    - **Validates: Requirements 4.1, 4.2**

- [x] 3. Conversational Handler
  - [x] 3.1 Implement message processing
    - Create `apps/api/src/services/messaging/conversational-handler.ts`
    - Process messages and generate AI responses
    - _Requirements: 3.2, 3.3_
  - [x] 3.2 Implement relevance detection
    - Detect question patterns
    - Match SIA-related keywords
    - Calculate confidence score
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  - [ ]* 3.3 Write property test for relevance filtering
    - **Property 4: Relevance Filtering**
    - **Validates: Requirements 5.5**

- [x] 4. Message Queue Manager
  - [x] 4.1 Implement message queuing
    - Create `apps/api/src/services/messaging/message-queue-manager.ts`
    - Queue normal-priority messages
    - Process high-priority messages immediately
    - _Requirements: 6.1, 6.2, 6.3_
  - [x] 4.2 Implement batch processing
    - Process queued messages in batches
    - Respect rate limits
    - _Requirements: 6.1, 6.4_
  - [ ]* 4.3 Write property test for message priority
    - **Property 5: Message Priority**
    - **Validates: Requirements 6.2**

- [x] 5. Channel Settings Manager
  - [x] 5.1 Implement settings storage
    - Create `apps/api/src/services/messaging/channel-settings-manager.ts`
    - Store per-channel configuration
    - _Requirements: 7.1, 7.2_
  - [x] 5.2 Implement mode enforcement
    - mention_only mode
    - active_threads mode
    - always_listen mode
    - _Requirements: 7.3, 7.4_

## Slack Integration (Primary Platform)

- [x] 6. Slack Adapter
  - [x] 6.1 Implement SlackAdapter class
    - Create `apps/api/src/services/messaging/adapters/slack-adapter.ts`
    - Implement MessagingAdapter interface
    - _Requirements: 1.2, 1.4_
  - [x] 6.2 Implement message parsing
    - Parse Slack events to UnifiedMessage
    - Handle different event types (message, app_mention)
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 6.3 Implement message sending
    - Send messages via Slack API
    - Support thread replies
    - _Requirements: 2.2, 3.1_
  - [x] 6.4 Implement attachment handling
    - Download attachments from Slack
    - Store temporarily for processing
    - _Requirements: 9.1, 9.2, 9.3_

- [x] 7. Slack Event Handling
  - [x] 7.1 Implement event webhook endpoint
    - Create `/integrations/slack/events` route
    - Handle URL verification
    - Verify request signatures
    - _Requirements: 2.1_
  - [x] 7.2 Implement app_mention handling
    - Process @mention events
    - Enter conversation mode
    - _Requirements: 2.1, 2.4_
  - [x] 7.3 Implement message event handling
    - Process channel and DM messages
    - Check relevance for non-mentions
    - _Requirements: 3.1, 4.1, 5.5_
  - [x] 7.4 Implement bot channel join handling
    - Detect when bot joins channel
    - Send introduction message
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 8. Slack Link Unfurling
  - [x] 8.1 Implement link_shared event handling
    - Detect SIA job links
    - _Requirements: 10.1_
  - [x] 8.2 Implement job unfurl content
    - Fetch job details
    - Build rich preview blocks
    - _Requirements: 10.2_
  - [x] 8.3 Send unfurl response
    - Call Slack chat.unfurl API
    - _Requirements: 10.2, 10.3_

- [ ] 9. Slack OAuth Integration
  - [x] 9.1 Implement OAuth connect flow
    - `/integrations/slack/connect` endpoint
    - Handle OAuth redirect
    - _Requirements: 1.2_
  - [x] 9.2 Implement OAuth callback
    - Exchange code for tokens
    - Store integration in database
    - _Requirements: 1.2_
  - [x] 9.3 Implement token refresh
    - Auto-refresh expired tokens
    - _Requirements: 1.2_
  - [x] 9.4 Implement provider management
    - List, get, delete integrations
    - _Requirements: 1.2_

## Future Platform Integrations

- [ ] 10. Discord Integration
  - [ ] 10.1 Implement DiscordAdapter class
    - Implement MessagingAdapter interface
    - _Requirements: 1.2_
  - [ ] 10.2 Implement Discord bot gateway
    - Connect to Discord Gateway
    - Handle events
    - _Requirements: 2.1_
  - [ ] 10.3 Implement Discord OAuth
    - Bot authorization flow
    - _Requirements: 1.2_

- [ ] 11. Microsoft Teams Integration
  - [ ] 11.1 Implement TeamsAdapter class
    - Implement MessagingAdapter interface
    - _Requirements: 1.2_
  - [ ] 11.2 Implement Bot Framework integration
    - Handle Teams bot events
    - _Requirements: 2.1_
  - [ ] 11.3 Implement Teams OAuth
    - Azure AD authentication
    - _Requirements: 1.2_

## Testing

- [ ] 12. Testing
  - [ ] 12.1 Unit tests for relevance detection
  - [ ] 12.2 Unit tests for conversation manager
  - [ ] 12.3 Integration tests with mock adapters
  - [ ]* 12.4 Property-based tests for core algorithms
  - [ ] 12.5 E2E tests with test Slack workspace

## Checkpoint

- [ ] 13. Final Checkpoint
  - Ensure all tests pass, ask the user if questions arise.
