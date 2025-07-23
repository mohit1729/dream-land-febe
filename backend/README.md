# Property Notice Extractor - Backend API

Backend API server for the Property Notice Extractor application, built with Node.js and Express.

## 🚀 Features

- **OCR Processing**: Google Cloud Vision API integration for text extraction
- **AI Analysis**: Gemini AI for intelligent data extraction and refinement
- **Database Management**: Firebase Firestore NoSQL database
- **Geocoding**: Automatic village location resolution
- **File Upload**: Secure image upload with validation
- **Rate Limiting**: API protection and abuse prevention
- **Error Handling**: Comprehensive error management

## 📋 API Endpoints

### Core Processing
- `POST /api/process-notice` - Process uploaded property notice image
- `POST /api/save-notice` - Save extracted data after user confirmation
- `POST /api/process-with-gemini` - Enhanced processing with Gemini AI

### Data Management
- `GET /api/notices` - Get all property notices with pagination
- `GET /api/notices/:id` - Get specific property notice by ID
- `DELETE /api/notices/:id` - Delete property notice

### Text Processing
- `POST /api/extract-raw-text` - Extract raw OCR text only
- `POST /api/process-text-with-gemini` - Process raw text with Gemini
- `POST /api/process-extracted-text` - Save external AI results

### Geocoding
- `POST /api/geocode/village` - Geocode single village
- `POST /api/geocode/batch` - Batch geocode multiple villages
- `POST /api/geocode/existing` - Geocode existing notices

### AI Refinement
- `POST /api/refine-notice/:id` - Refine single notice with AI
- `POST /api/refine-batch` - Batch refine multiple notices

### Utility
- `GET /api/health` - Health check endpoint
- `GET /api/status` - Server status
- `GET /api/test-gemini` - Test Gemini AI connectivity

## 🛠 Setup

### Prerequisites
- Node.js (v18.0.0 or higher)
- Firebase project with Firestore enabled
- Google Cloud Platform account with Vision API enabled
- Google AI Studio API key for Gemini

### Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment:
```bash
cp env.example .env
# Edit .env with your configuration
```

3. Set up Firebase:
```bash
npm run firebase:setup
```

4. Start the server:
```bash
# Development
npm run dev

# Production
npm start
```

## 🔧 Environment Variables

```env
# Server Configuration
PORT=4000
NODE_ENV=development

# Firebase Configuration
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
# OR use file path (alternative to JSON key above)
# GOOGLE_APPLICATION_CREDENTIALS=path/to/firebase-service-account.json

# Google Cloud Vision API
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account-key.json
GOOGLE_CLOUD_PROJECT_ID=your-project-id

# Google AI Studio (Gemini)
GEMINI_API_KEY=your-gemini-api-key

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_DIR=uploads
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/jpg

# Security
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
ALLOWED_ORIGINS=http://localhost:3000
```

## 📁 Project Structure

```
backend/
├── server.js              # Main server file
├── services/
│   ├── ocrService.js      # Google Vision OCR
│   ├── geminiService.js   # Gemini AI integration
│   ├── databaseService.js # Database operations
│   ├── geocodingService.js # Location services
│   └── textParser.js      # Text processing
├── middleware/
│   ├── errorHandler.js    # Error handling
│   └── validation.js      # Input validation
├── database/
│   └── migrations/        # Database schemas
├── scripts/
│   ├── migrate.js         # Database migration
│   ├── geocode-existing.js # Batch geocoding
│   └── test-*.js          # Testing utilities
└── uploads/               # Temporary file storage
```

## 🚀 Deployment

### Railway
```bash
railway up
```

### Render
Use the provided `render.yaml` configuration.

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 4000
CMD ["npm", "start"]
```

## 🔒 Security Features

- Helmet.js for security headers
- CORS configuration
- Rate limiting
- File type validation
- SQL injection protection
- Error sanitization

## 📊 Monitoring

- Health check endpoint at `/api/health`
- Server status at `/api/status`
- Request logging in development mode
- Error tracking and reporting

## 🧪 Testing

```bash
# Run tests
npm test

# Test specific endpoints
curl http://localhost:4000/api/health
curl http://localhost:4000/api/test-gemini
``` 