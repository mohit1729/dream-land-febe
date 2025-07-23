# Backend Environment Variables Summary

## REQUIRED for Deployment:

✅ Currently Set:
- PORT=4000
- NODE_ENV=development  
- FIREBASE_PROJECT_ID=valid-design-456012-g8
- GOOGLE_APPLICATION_CREDENTIALS=./credentials/firebase-service-account-new.json
- GOOGLE_CLOUD_PROJECT_ID=valid-design-456012-g8
- GOOGLE_MAPS_API_KEY=AIzaSyBlGxd4-GZ7vytxgx6B296E05eT9TrLt6U
- GEMINI_API_KEY=AIzaSyBlGxd4-GZ7vytxgx6B296E05eT9TrLt6U

⚠️  Issues for Production:
1. Firebase credentials file won't work in cloud deployment
2. Some API keys might be the same (check if intentional)
3. NODE_ENV should be 'production'

## Deployment Checklist:
- [ ] Convert Firebase credentials to environment variable
- [ ] Verify API keys are correct for production
- [ ] Set NODE_ENV=production
- [ ] Configure CORS for production frontend URL
