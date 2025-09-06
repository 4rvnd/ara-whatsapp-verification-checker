# WhatsApp Message Verification Service

A Node.js service for verifying WhatsApp message delivery by comparing database records with actual WhatsApp API messages.

## Features

- **Message Verification**: Compare database messages with WhatsApp API messages
- **Fuzzy String Matching**: 90-100% similarity threshold for message matching
- **First Message Tracking**: Special analysis for first messages sent to customers
- **Batch Processing**: Efficient processing of large message volumes
- **Detailed Reporting**: Comprehensive reports with match rates and confidence scores
- **Phone Number Range Support**: Verify sequential phone number ranges
- **Caching**: 5-minute cache for API responses to reduce load

## Installation

```bash
npm install
```

## Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/your_database_name

# WhatsApp API Configuration
WHATSAPP_API_BASE_URL=https://api.ara-pay.com
WHATSAPP_API_TOKEN=YOUR_BEARER_TOKEN_HERE

# Server Configuration
PORT=3000
NODE_ENV=development

# Logging
LOG_LEVEL=info
```

### Important Configuration Updates Required

1. **MongoDB URI**: Update `MONGODB_URI` in `.env` with your actual MongoDB connection string

2. **Bearer Token**: The bearer token has been updated in `src/config/constants.js`. Update if needed.

## Running the Service

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

## API Endpoints

### 1. Verify Messages

**POST** `/api/verify`

Verify messages for specific phone numbers, a range, or all conversations for a business/organization.

#### Request Body Options

**Option 1: Specific Phone Numbers**

```json
{
  "dateFrom": "2024-01-01T00:00:00Z",
  "dateTo": "2024-01-31T23:59:59Z",
  "userIds": ["68a4395055c05a444bf6e456", "68a4395055c05a444bf6e457"],
  "phoneNumbers": ["60165926432", "60142806993"],
  "matchingThreshold": 0.9,
  "messageRole": "both",
  "includeDetails": true
}
```

**Option 2: Phone Number Range**

```json
{
  "dateFrom": "2024-01-01T00:00:00Z",
  "dateTo": "2024-01-31T23:59:59Z",
  "userIds": ["68a4395055c05a444bf6e456"],
  "phoneNumberRange": {
    "start": "60100000000",
    "end": "60100000100"
  },
  "matchingThreshold": 0.9,
  "messageRole": "both",
  "includeDetails": true
}
```

**Option 3: All Conversations for a Business (Auto-fetch phone numbers)**

```json
{
  "dateFrom": "2024-01-01T00:00:00Z",
  "dateTo": "2024-01-31T23:59:59Z",
  "userIds": ["68a4395055c05a444bf6e456"],
  "businessId": "507f1f77bcf86cd799439011",
  "matchingThreshold": 0.9,
  "messageRole": "both",
  "includeDetails": true
}
```

#### Response

```json
{
  "success": true,
  "report": {
    "summary": {
      "verificationPeriod": {...},
      "matchedMessages": 45,
      "unmatchedMessages": 5,
      "matchRate": "90.00%",
      "averageConfidence": "95.50%",
      "firstMessageStats": {
        "total": 10,
        "matched": 8,
        "unmatched": 2,
        "unmatchedRate": "20.00%"
      }
    },
    "details": {
      "matchedMessages": [...],
      "unmatchedMessages": [...]
    },
    "analysis": {
      "unmatchedByType": {...},
      "unmatchedByPhoneNumber": {...},
      "unmatchedByDate": {...}
    }
  }
}
```

### 2. Verify Single Phone Number

**POST** `/api/verify/single`

#### Request Body

```json
{
  "phoneNumber": "60165926432",
  "userIds": ["68a4395055c05a444bf6e456"],
  "dateFrom": "2024-01-01T00:00:00Z",
  "dateTo": "2024-01-31T23:59:59Z",
  "includeDetails": true
}
```

### 3. Verify First Messages

**POST** `/api/verify/first-messages`

Special endpoint for verifying first messages sent to customers.

#### Request Body

```json
{
  "dateFrom": "2024-01-01T00:00:00Z",
  "dateTo": "2024-01-31T23:59:59Z",
  "userIds": ["68a4395055c05a444bf6e456", "68a4395055c05a444bf6e457"],
  "businessId": "optional_business_id",
  "organizationId": "optional_org_id"
}
```

### 4. Health Check

**GET** `/api/health`

## Architecture

### Core Components

1. **WhatsApp API Service** (`src/services/whatsappApi.js`)
   - Handles API communication with WhatsApp
   - Implements caching mechanism
   - Transforms API responses

2. **Message Matcher** (`src/services/messageMatcher.js`)
   - Fuzzy string matching using Levenshtein distance
   - 90-100% similarity threshold
   - Batch processing capabilities

3. **Verification Service** (`src/services/verificationService.js`)
   - Orchestrates the verification process
   - Generates comprehensive reports
   - Handles data aggregation

### Database Models

- **Conversation**: Stores conversation metadata and phone numbers
- **Messages**: Stores individual messages with timestamps and content

## Message Matching Logic

1. **Normalization**: Messages are normalized (lowercase, remove special characters)
2. **Similarity Calculation**: Using string-similarity library (Levenshtein distance)
3. **Threshold**: Minimum 90% similarity required for a match
4. **Temporal Validation**: DB message must exist before API message timestamp
5. **One-to-One Matching**: Each API message can only match one DB message

## Performance Considerations

- **Batch Size**: Default 100 messages per batch
- **Cache TTL**: 5 minutes for API responses
- **Max Volume**: Optimized for ~500-1000 messages per request

## Troubleshooting

### Common Issues

1. **MongoDB Connection Failed**
   - Check MongoDB URI in `.env`
   - Ensure MongoDB service is running

2. **WhatsApp API Authentication Error**
   - Verify bearer token in constants.js
   - Check API endpoint URL

3. **Low Match Rates**
   - Review similarity threshold (default 90%)
   - Check for message format differences
   - Verify timestamp alignment

## Dependencies

- Express.js - Web framework
- Mongoose - MongoDB ODM
- Axios - HTTP client
- string-similarity - Fuzzy string matching
- Winston - Logging
- Helmet - Security headers
- Cors - CORS support

## License

ISC
