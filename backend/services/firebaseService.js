const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');

// Initialize Firebase Admin SDK
let db;

function initializeFirebase() {
    try {
        // Check if Firebase is already initialized
        if (admin.apps.length === 0) {
            // Initialize with service account
            if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
                // Use service account key from environment variable
                const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount),
                    projectId: serviceAccount.project_id
                });
            } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
                // Use service account file path
                admin.initializeApp({
                    credential: admin.credential.applicationDefault(),
                    projectId: process.env.FIREBASE_PROJECT_ID
                });
            } else {
                throw new Error('Firebase credentials not configured. Set FIREBASE_SERVICE_ACCOUNT_KEY or GOOGLE_APPLICATION_CREDENTIALS');
            }
        }
        
        db = admin.firestore();
        console.log('Firebase initialized successfully');
        return db;
    } catch (error) {
        console.error('Firebase initialization error:', error);
        throw error;
    }
}

// Initialize Firebase when module loads
try {
    initializeFirebase();
} catch (error) {
    console.warn('Firebase initialization failed:', error.message);
}

/**
 * Test Firebase connection
 * @returns {Promise<boolean>} - True if connection successful
 */
async function testFirebaseConnection() {
    try {
        if (!db) {
            initializeFirebase();
        }
        
        // Test by reading from a collection
        const testRef = db.collection('test');
        await testRef.limit(1).get();
        
        console.log('Firebase connection test passed');
        return true;
    } catch (error) {
        console.error('Firebase connection test failed:', error);
        throw error;
    }
}

/**
 * Save extracted property notice information to Firestore
 * @param {Object} extractedData - Extracted property information
 * @returns {Object} - Saved record with ID
 */
async function savePropertyNotice(extractedData) {
    try {
        if (!db) {
            initializeFirebase();
        }

        const {
            raw_text,
            extracted_data,
            confidence_score,
            processing_time_ms,
            processing_status = 'completed',
            ai_service = 'firebase_integration',
            filename
        } = extractedData;

        // Generate UUID for the record
        const id = uuidv4();
        const timestamp = admin.firestore.Timestamp.now();

        // Convert notice_date to proper format if it exists
        let noticeDate = null;
        if (extracted_data.notice_date) {
            // Convert DD/MM/YYYY to Date object
            const dateParts = extracted_data.notice_date.split('/');
            if (dateParts.length === 3) {
                const day = parseInt(dateParts[0]);
                const month = parseInt(dateParts[1]) - 1; // Month is 0-indexed
                const year = parseInt(dateParts[2]);
                noticeDate = new Date(year, month, day);
            }
        }

        // Prepare document data
        const docData = {
            id,
            village_name: extracted_data.village_name || null,
            survey_number: extracted_data.survey_number || null,
            buyer_name: extracted_data.buyer_name || null,
            seller_name: extracted_data.seller_name || null,
            notice_date: noticeDate,
            advocate_name: extracted_data.advocate_name || null,
            advocate_address: extracted_data.advocate_address || null,
            advocate_mobile: extracted_data.advocate_mobile || null,
            raw_text,
            extracted_data,
            confidence_score: confidence_score || null,
            processing_status,
            ai_service,
            filename: filename || null,
            
            // Geocoding data
            latitude: extracted_data.latitude || null,
            longitude: extracted_data.longitude || null,
            district: extracted_data.district || null,
            taluka: extracted_data.taluka || null,
            full_address: extracted_data.full_address || null,
            geocoding_status: extracted_data.geocoding_status || 'pending',
            
            // Timestamps
            uploaded_at: timestamp,
            updated_at: timestamp,
            
            // Processing metadata
            processing_time_ms: processing_time_ms || null
        };

        // Save to Firestore
        const docRef = db.collection('property_notices').doc(id);
        await docRef.set(docData);

        // Log processing step
        await logProcessingStep(id, 'EXTRACTION_COMPLETED', 'success', null, processing_time_ms);

        console.log(`Property notice saved to Firebase with ID: ${id}`);
        
        // Return the saved record
        return {
            id,
            ...docData,
            uploaded_at: docData.uploaded_at.toDate().toISOString(),
            updated_at: docData.updated_at.toDate().toISOString(),
            notice_date: noticeDate ? noticeDate.toISOString().split('T')[0] : null
        };

    } catch (error) {
        console.error('Firebase save error:', error);
        throw new Error(`Database save failed: ${error.message}`);
    }
}

/**
 * Get property notices with pagination
 * @param {Object} options - Query options
 * @param {number} options.limit - Number of records to fetch
 * @param {string} options.startAfter - Document ID to start after (for pagination)
 * @returns {Array} - Array of property notices
 */
async function getPropertyNotices(options = {}) {
    try {
        if (!db) {
            initializeFirebase();
        }

        const { limit = 1000, startAfter = null } = options;
        
        let query = db.collection('property_notices')
            .orderBy('uploaded_at', 'desc')
            .limit(limit);

        // Handle pagination
        if (startAfter) {
            const startAfterDoc = await db.collection('property_notices').doc(startAfter).get();
            if (startAfterDoc.exists) {
                query = query.startAfter(startAfterDoc);
            }
        }

        const snapshot = await query.get();
        
        const notices = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            notices.push({
                id: doc.id,
                ...data,
                uploaded_at: data.uploaded_at?.toDate().toISOString(),
                updated_at: data.updated_at?.toDate().toISOString(),
                notice_date: data.notice_date ? data.notice_date.toDate().toISOString().split('T')[0] : null
            });
        });

        console.log(`Retrieved ${notices.length} notices from Firebase`);
        return notices;

    } catch (error) {
        console.error('Error fetching property notices from Firebase:', error);
        throw new Error(`Database fetch failed: ${error.message}`);
    }
}

/**
 * Get specific property notice by ID
 * @param {string} id - Notice ID
 * @returns {Object|null} - Property notice or null if not found
 */
async function getPropertyNoticeById(id) {
    try {
        if (!db) {
            initializeFirebase();
        }

        const docRef = db.collection('property_notices').doc(id);
        const doc = await docRef.get();

        if (!doc.exists) {
            return null;
        }

        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            uploaded_at: data.uploaded_at?.toDate().toISOString(),
            updated_at: data.updated_at?.toDate().toISOString(),
            notice_date: data.notice_date ? data.notice_date.toDate().toISOString().split('T')[0] : null
        };

    } catch (error) {
        console.error('Error fetching property notice by ID from Firebase:', error);
        throw new Error(`Database fetch failed: ${error.message}`);
    }
}

/**
 * Update property notice
 * @param {string} id - Notice ID
 * @param {Object} updateData - Data to update
 * @returns {Object} - Updated record
 */
async function updatePropertyNotice(id, updateData) {
    try {
        if (!db) {
            initializeFirebase();
        }

        const docRef = db.collection('property_notices').doc(id);
        
        // Prepare update data
        const updates = {
            ...updateData,
            updated_at: admin.firestore.Timestamp.now()
        };

        // Handle notice_date conversion if provided
        if (updateData.notice_date && typeof updateData.notice_date === 'string') {
            const dateParts = updateData.notice_date.split('/');
            if (dateParts.length === 3) {
                const day = parseInt(dateParts[0]);
                const month = parseInt(dateParts[1]) - 1;
                const year = parseInt(dateParts[2]);
                updates.notice_date = new Date(year, month, day);
            }
        }

        await docRef.update(updates);
        
        // Return updated document
        return await getPropertyNoticeById(id);

    } catch (error) {
        console.error('Error updating property notice in Firebase:', error);
        throw new Error(`Database update failed: ${error.message}`);
    }
}

/**
 * Delete property notice
 * @param {string} id - Notice ID
 * @returns {boolean} - True if deleted successfully
 */
async function deletePropertyNotice(id) {
    try {
        if (!db) {
            initializeFirebase();
        }

        const docRef = db.collection('property_notices').doc(id);
        
        // Check if document exists
        const doc = await docRef.get();
        if (!doc.exists) {
            return false;
        }

        // Delete the document
        await docRef.delete();
        
        // Also delete related processing logs
        const logsQuery = db.collection('processing_logs').where('property_notice_id', '==', id);
        const logsSnapshot = await logsQuery.get();
        
        const batch = db.batch();
        logsSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();

        console.log(`Property notice ${id} deleted from Firebase`);
        return true;

    } catch (error) {
        console.error('Error deleting property notice from Firebase:', error);
        throw new Error(`Database delete failed: ${error.message}`);
    }
}

/**
 * Log processing step
 * @param {string} propertyNoticeId - Property notice ID
 * @param {string} step - Processing step
 * @param {string} status - Status (success/error)
 * @param {string} errorMessage - Error message if any
 * @param {number} processingTimeMs - Processing time in milliseconds
 */
async function logProcessingStep(propertyNoticeId, step, status, errorMessage = null, processingTimeMs = null) {
    try {
        if (!db) {
            initializeFirebase();
        }

        const logData = {
            id: uuidv4(),
            property_notice_id: propertyNoticeId,
            processing_step: step,
            status,
            error_message: errorMessage,
            processing_time_ms: processingTimeMs,
            created_at: admin.firestore.Timestamp.now()
        };

        await db.collection('processing_logs').add(logData);

    } catch (error) {
        console.error('Error logging processing step to Firebase:', error);
        // Don't throw error for logging failures
    }
}

/**
 * Update property notice location data
 * @param {string} id - Notice ID
 * @param {Object} locationData - Location data
 */
async function updatePropertyNoticeLocation(id, locationData) {
    try {
        if (!db) {
            initializeFirebase();
        }

        const updates = {
            latitude: locationData.latitude || null,
            longitude: locationData.longitude || null,
            district: locationData.district || null,
            taluka: locationData.taluka || null,
            full_address: locationData.formatted_address || null,
            geocoding_status: locationData.status || 'completed',
            updated_at: admin.firestore.Timestamp.now()
        };

        const docRef = db.collection('property_notices').doc(id);
        await docRef.update(updates);

        console.log(`Location data updated for notice ${id}`);

    } catch (error) {
        console.error('Error updating location data in Firebase:', error);
        throw new Error(`Location update failed: ${error.message}`);
    }
}

/**
 * Get villages needing geocoding
 * @returns {Array} - Array of villages that need geocoding
 */
async function getVillagesNeedingGeocoding() {
    try {
        if (!db) {
            initializeFirebase();
        }

        const query = db.collection('property_notices')
            .where('village_name', '!=', null)
            .where('geocoding_status', 'in', ['pending', 'failed']);

        const snapshot = await query.get();
        
        const villages = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.village_name && (!data.latitude || !data.longitude)) {
                villages.push({
                    id: doc.id,
                    village_name: data.village_name,
                    district: data.district
                });
            }
        });

        return villages;

    } catch (error) {
        console.error('Error fetching villages needing geocoding from Firebase:', error);
        throw new Error(`Database query failed: ${error.message}`);
    }
}

/**
 * Get database statistics
 * @returns {Object} - Database statistics
 */
async function getDatabaseStats() {
    try {
        if (!db) {
            initializeFirebase();
        }

        // Get total count of notices
        const noticesSnapshot = await db.collection('property_notices').get();
        const totalNotices = noticesSnapshot.size;

        // Get unique villages count
        const villages = new Set();
        noticesSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.village_name) {
                villages.add(data.village_name);
            }
        });

        // Get notices from last 7 days
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        
        const recentQuery = db.collection('property_notices')
            .where('uploaded_at', '>=', admin.firestore.Timestamp.fromDate(oneWeekAgo));
        const recentSnapshot = await recentQuery.get();

        return {
            total_notices: totalNotices,
            unique_villages: villages.size,
            recent_notices_7_days: recentSnapshot.size,
            database_type: 'Firebase Firestore'
        };

    } catch (error) {
        console.error('Error getting database stats from Firebase:', error);
        throw new Error(`Stats query failed: ${error.message}`);
    }
}

module.exports = {
    savePropertyNotice,
    getPropertyNotices,
    getPropertyNoticeById,
    updatePropertyNotice,
    deletePropertyNotice,
    testFirebaseConnection,
    logProcessingStep,
    updatePropertyNoticeLocation,
    getVillagesNeedingGeocoding,
    getDatabaseStats,
    initializeFirebase
}; 