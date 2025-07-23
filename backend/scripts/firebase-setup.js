const { initializeFirebase, testFirebaseConnection } = require('../services/firebaseService');
require('dotenv').config();

async function setupFirebase() {
    try {
        console.log('🔥 Setting up Firebase for Property Notice Extractor...');
        console.log('================================================');
        
        // Check environment variables
        if (!process.env.FIREBASE_PROJECT_ID && !process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
            console.error('❌ Firebase configuration missing!');
            console.log('Please set one of the following:');
            console.log('1. FIREBASE_PROJECT_ID + FIREBASE_SERVICE_ACCOUNT_KEY (JSON string)');
            console.log('2. FIREBASE_PROJECT_ID + GOOGLE_APPLICATION_CREDENTIALS (file path)');
            process.exit(1);
        }
        
        // Initialize Firebase
        console.log('🔧 Initializing Firebase...');
        await initializeFirebase();
        
        // Test connection
        console.log('🧪 Testing Firebase connection...');
        await testFirebaseConnection();
        
        console.log('✅ Firebase setup completed successfully!');
        console.log('');
        console.log('📋 Firebase Collections Used:');
        console.log('   • property_notices - Main data collection');
        console.log('   • processing_logs - Processing step logs');
        console.log('');
        console.log('🎯 Firebase Features:');
        console.log('   • NoSQL document database');
        console.log('   • Automatic scaling');
        console.log('   • Real-time updates');
        console.log('   • Built-in security rules');
        console.log('   • No schema migrations needed');
        console.log('');
        console.log('🚀 Your backend is ready to use Firebase!');
        
    } catch (error) {
        console.error('❌ Firebase setup failed:', error.message);
        console.log('');
        console.log('🔧 Troubleshooting:');
        console.log('1. Verify your Firebase project ID is correct');
        console.log('2. Check your service account credentials');
        console.log('3. Ensure Firebase Admin SDK is enabled');
        console.log('4. Verify Firestore is enabled in your Firebase project');
        process.exit(1);
    }
}

// Run setup if this file is executed directly
if (require.main === module) {
    setupFirebase()
        .then(() => {
            console.log('Firebase setup script completed.');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Firebase setup script failed:', error);
            process.exit(1);
        });
}

module.exports = { setupFirebase }; 