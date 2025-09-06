# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

```bash
# Install dependencies
npm install

# Run in development mode with auto-reload
npm run dev

# Run in production mode
npm start

# Note: No test, lint, or type-check commands are currently configured
```

## Architecture Overview

This is a Node.js/Express service for verifying WhatsApp message delivery by comparing MongoDB database records with actual WhatsApp API messages.

### Core Services

- **WhatsApp API Service** (`src/services/whatsappApi.js`) - Handles external API communication with WhatsApp, implements 5-minute response caching, and transforms API responses
- **Message Matcher** (`src/services/messageMatcher.js`) - Performs fuzzy string matching using Levenshtein distance with 90-100% similarity threshold for message verification
- **Verification Service** (`src/services/verificationService.js`) - Orchestrates the verification process, generates comprehensive reports, and handles data aggregation

### Database Models (MongoDB/Mongoose)

- **Conversation** - Stores conversation metadata and phone numbers
- **Messages** - Stores individual messages with timestamps and content

### Key Configuration

Environment variables are managed through `.env`:

- `MONGODB_URI` - MongoDB connection string
- `WHATSAPP_API_BASE_URL` - WhatsApp API endpoint
- `WHATSAPP_API_TOKEN` - Bearer token for authentication
- `PORT` - Server port (default 3000)

Bearer token is also configured in `src/config/constants.js`.

### API Endpoints

- `POST /api/verify` - Main verification endpoint supporting specific phone numbers, ranges, or business-wide verification
- `POST /api/verify/single` - Verify single phone number
- `POST /api/verify/first-messages` - Special endpoint for first message verification
- `GET /api/health` - Health check

### Message Matching Logic

1. Messages are normalized (lowercase, special characters removed)
2. Similarity calculated using string-similarity library (Levenshtein distance)
3. Minimum 90% similarity required for match
4. DB message must exist before API message timestamp
5. One-to-one matching enforced

### Development Notes

- No ESLint, Prettier, or testing framework is currently configured
- Uses nodemon for development auto-reload
- Batch processing optimized for ~500-1000 messages per request
- 5-minute cache TTL for API responses
