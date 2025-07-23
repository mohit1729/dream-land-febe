const express = require('express');
const multer = require('multer');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { processPropertyNotice, getRawOCRText } = require('./services/ocrService');
const { savePropertyNotice, getPropertyNotices, getPropertyNoticeById, deletePropertyNotice, updatePropertyNoticeLocation, getVillagesNeedingGeocoding, updatePropertyNotice } = require('./services/firebaseService');
const { validateImageFile } = require('./middleware/validation');
const { errorHandler } = require('./middleware/errorHandler');
const { processWithGemini, processImageWithGemini, testGeminiAPI } = require('./services/geminiService');

const app = express();
const PORT = process.env.PORT || 4000;

// Create uploads directory if it doesn't exist
const uploadsDir = process.env.UPLOAD_DIR || 'uploads';
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Security middleware
app.use(helmet());
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? process.env.ALLOWED_ORIGINS?.split(',') || true  // Allow all origins if ALLOWED_ORIGINS not set
        : true,
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: {
        error: 'Too many requests from this IP, please try again later.'
    }
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files removed - frontend is handled by Next.js

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `property-notice-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
        files: 1
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = process.env.ALLOWED_FILE_TYPES?.split(',') || 
            ['image/jpeg', 'image/png', 'image/jpg'];
        
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`));
        }
    }
});

// Routes

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0'
    });
});

// Upload and process property notice (AI-Powered: Vision + Gemini)
app.post('/api/process-notice', upload.single('image'), validateImageFile, async (req, res) => {
    let filePath = null;
    
    try {
        if (!req.file) {
            return res.status(400).json({
                error: 'No image file provided',
                code: 'MISSING_FILE'
            });
        }

        filePath = req.file.path;
        
        console.log(`Processing image: ${req.file.filename}`);
        
        // Process the image with OCR and extract information
        const extractedData = await processPropertyNotice(filePath);
        
        console.log(`Successfully processed notice - awaiting user confirmation to save`);
        
        res.json({
            success: true,
            message: 'Property notice processed successfully',
            data: {
                extractedData: extractedData.extracted_data,
                rawText: extractedData.raw_text,
                confidenceScore: extractedData.confidence_score,
                processingTime: extractedData.processing_time_ms,
                aiService: extractedData.ai_service,
                filename: req.file.filename,
                needsConfirmation: true
            }
        });
        
    } catch (error) {
        console.error('Error processing property notice:', error);
        console.error('Error stack:', error.stack);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            code: error.code,
            stack: error.stack
        });
        
        res.status(500).json({
            success: false,
            error: 'Failed to process property notice',
            message: error.message,
            code: error.code || 'PROCESSING_ERROR',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
        
    } finally {
        // Clean up uploaded file
        if (filePath && fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
                console.log(`Cleaned up file: ${filePath}`);
            } catch (cleanupError) {
                console.error(`Failed to clean up file ${filePath}:`, cleanupError);
            }
        }
    }
});

// Save extracted data after user confirmation
app.post('/api/save-notice', async (req, res) => {
    try {
        const { extractedData, rawText, confidenceScore, processingTime, aiService, filename } = req.body;
        
        if (!extractedData) {
            return res.status(400).json({
                error: 'Extracted data is required',
                code: 'MISSING_EXTRACTED_DATA'
            });
        }

        console.log(`Saving confirmed notice data for: ${filename}`);
        
        // Prepare data for saving
        const dataToSave = {
            raw_text: rawText,
            extracted_data: extractedData,
            confidence_score: confidenceScore,
            processing_time_ms: processingTime,
            processing_status: 'completed',
            ai_service: aiService || 'google_vision_and_gemini',
            filename: filename
        };
        
        // Save to database
        const savedRecord = await savePropertyNotice(dataToSave);
        
        console.log(`Successfully saved notice with ID: ${savedRecord.id}`);
        
        // Automatically geocode the village if it exists
        if (extractedData.village_name) {
            try {
                console.log(`🌍 Auto-geocoding village: ${extractedData.village_name}`);
                
                const { geocodeVillage } = require('./services/geocodingService');
                
                // Clean village name for geocoding (same logic as in fix script)
                let villageName = extractedData.village_name
                    .replace(/\s*રેવન્યુ\s*સર્વે\s*નં.*$/gi, '')
                    .replace(/\s*સર્વે\s*નં.*$/gi, '')
                    .replace(/ના\s*$/, '')
                    .replace(/ની\s*$/, '')
                    .replace(/નું\s*$/, '')
                    .replace(/^ગામ\s+/, '')
                    .replace(/^મોજે\s+ગામ\s+/, '')
                    .trim();
                
                if (villageName.length >= 2) {
                    const locationData = await geocodeVillage(villageName, extractedData.district || 'Rajkot');
                    
                    if (locationData.success) {
                        await updatePropertyNoticeLocation(savedRecord.id, {
                            latitude: locationData.latitude,
                            longitude: locationData.longitude,
                            district: locationData.district || extractedData.district,
                            taluka: locationData.taluka || extractedData.taluka,
                            formatted_address: locationData.formatted_address,
                            status: 'success'
                        });
                        
                        console.log(`✅ Auto-geocoded: ${villageName} -> ${locationData.latitude}, ${locationData.longitude}`);
                    } else {
                        console.log(`❌ Auto-geocoding failed for: ${villageName} - ${locationData.error}`);
                    }
                } else {
                    console.log(`⚠️ Village name too short for geocoding: "${villageName}"`);
                }
                
            } catch (geocodingError) {
                console.warn('⚠️ Auto-geocoding failed, continuing without location data:', geocodingError.message);
            }
        }
        
        res.json({
            success: true,
            message: 'Property notice saved to database successfully',
            data: {
                id: savedRecord.id,
                extractedData: savedRecord.extracted_data || extractedData,
                uploadedAt: savedRecord.uploaded_at || new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('Error saving property notice:', error);
        
        res.status(500).json({
            error: 'Failed to save property notice',
            message: error.message,
            code: error.code || 'SAVE_ERROR'
        });
    }
});

// Get raw OCR text from image (for external AI processing)
app.post('/api/extract-raw-text', upload.single('image'), validateImageFile, async (req, res) => {
    let filePath = null;
    
    try {
        if (!req.file) {
            return res.status(400).json({
                error: 'No image file provided',
                code: 'MISSING_FILE'
            });
        }

        filePath = req.file.path;
        
        console.log(`Extracting raw text from: ${req.file.filename}`);
        
        // Get raw OCR text without parsing
        const rawOcrData = await getRawOCRText(filePath);
        
        console.log(`Raw text extraction completed for: ${req.file.filename}`);
        
        res.json({
            success: true,
            message: 'Raw text extracted successfully',
            data: rawOcrData
        });
        
    } catch (error) {
        console.error('Error extracting raw text:', error);
        
        res.status(500).json({
            error: 'Failed to extract raw text',
            message: error.message,
            code: error.code || 'RAW_TEXT_EXTRACTION_ERROR'
        });
        
    } finally {
        // Clean up uploaded file
        if (filePath && fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
                console.log(`Cleaned up file: ${filePath}`);
            } catch (cleanupError) {
                console.error(`Failed to clean up file ${filePath}:`, cleanupError);
            }
        }
    }
});

// Process extracted text with external AI and save results
app.post('/api/process-extracted-text', async (req, res) => {
    try {
        const { raw_text, extracted_data, confidence_score } = req.body;
        
        if (!raw_text) {
            return res.status(400).json({
                error: 'Raw text is required',
                code: 'MISSING_RAW_TEXT'
            });
        }
        
        if (!extracted_data) {
            return res.status(400).json({
                error: 'Extracted data is required',
                code: 'MISSING_EXTRACTED_DATA'
            });
        }
        
        console.log('Processing text with external AI results...');
        
        // Prepare data for saving
        const processedData = {
            raw_text: raw_text,
            extracted_data: extracted_data,
            confidence_score: confidence_score || null,
            processing_time_ms: 0, // External processing time not tracked
            processing_status: 'completed_external_ai'
        };
        
        // Save to database
        const savedRecord = await savePropertyNotice(processedData);
        
        console.log(`Successfully saved external AI processed notice with ID: ${savedRecord.id}`);
        
        res.json({
            success: true,
            message: 'External AI processed data saved successfully',
            data: {
                id: savedRecord.id,
                extractedData: savedRecord.extracted_data || extracted_data,
                rawText: savedRecord.raw_text || raw_text,
                confidenceScore: savedRecord.confidence_score || confidence_score,
                uploadedAt: savedRecord.uploaded_at || new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('Error processing external AI data:', error);
        
        res.status(500).json({
            error: 'Failed to process external AI data',
            message: error.message,
            code: error.code || 'EXTERNAL_AI_PROCESSING_ERROR'
        });
    }
});

// Get all property notices with pagination
app.get('/api/notices', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 1000; // Default to large number for dashboard
        const offset = (page - 1) * limit;
        
        const notices = await getPropertyNotices({ limit, offset });
        
        res.json({
            success: true,
            notices: notices, // Changed to match dashboard expectations
            data: notices,
            pagination: {
                page,
                limit,
                hasMore: notices.length === limit
            }
        });
        
    } catch (error) {
        console.error('Error fetching property notices:', error);
        res.status(500).json({
            error: 'Failed to fetch property notices',
            message: error.message
        });
    }
});

// Get specific property notice by ID
app.get('/api/notices/:id', async (req, res) => {
    try {
        const notice = await getPropertyNoticeById(req.params.id);
        
        if (!notice) {
            return res.status(404).json({
                error: 'Property notice not found',
                code: 'NOT_FOUND'
            });
        }
        
        res.json({
            success: true,
            data: notice
        });
        
    } catch (error) {
        console.error('Error fetching property notice:', error);
        res.status(500).json({
            error: 'Failed to fetch property notice',
            message: error.message
        });
    }
});

// Delete property notice
app.delete('/api/notices/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!id) {
            return res.status(400).json({
                error: 'Notice ID is required',
                code: 'MISSING_ID'
            });
        }

        const deleted = await deletePropertyNotice(id);
        
        if (!deleted) {
            return res.status(404).json({
                error: 'Property notice not found',
                code: 'NOTICE_NOT_FOUND'
            });
        }
        
        res.json({
            success: true,
            message: 'Property notice deleted successfully',
            data: { id }
        });
        
    } catch (error) {
        console.error('Error deleting property notice:', error);
        
        res.status(500).json({
            error: 'Failed to delete property notice',
            message: error.message,
            code: error.code || 'DELETE_ERROR'
        });
    }
});

// Frontend is handled by Next.js - no HTML routes needed

// API Routes
app.get('/api/status', (req, res) => {
    res.json({ 
        status: 'running', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        upload_dir: uploadsDir
    });
});

// Test Gemini API connectivity
app.get('/api/test-gemini', async (req, res) => {
    try {
        const isWorking = await testGeminiAPI();
        res.json({ 
            gemini_api_working: isWorking,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ 
            error: 'Failed to test Gemini API',
            details: error.message,
            gemini_api_working: false
        });
    }
});

// Process image with Gemini AI (Vision + Gemini)
app.post('/api/process-with-gemini', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }

        console.log(`📸 Processing image with enhanced Gemini (includes geocoding): ${req.file.filename}`);
        
        // Process with Vision + Gemini + Auto-geocoding
        const results = await processImageWithGemini(req.file.path);
        
        // Save to database if available
        try {
            const savedRecord = await savePropertyNotice({
                filename: req.file.filename,
                extracted_data: results.extracted_data,
                raw_text: results.raw_text,
                confidence_score: results.confidence_score,
                processing_time_ms: results.total_processing_time,
                processing_status: results.processing_status,
                ai_service: results.ai_service || 'google_vision_gemini_geocoding'
            });
            results.database_id = savedRecord.id;
            results.saved_to_database = true;
        } catch (dbError) {
            console.warn('Database save failed:', dbError.message);
            results.saved_to_database = false;
            results.database_error = dbError.message;
        }

        // Clean up uploaded file
        fs.unlink(req.file.path, (err) => {
            if (err) console.error('Failed to delete uploaded file:', err);
        });

        res.json({
            success: true,
            message: 'Image processed successfully with enhanced Gemini AI (includes village location)',
            data: results
        });

    } catch (error) {
        console.error('Gemini processing error:', error);
        
        // Clean up uploaded file on error
        if (req.file && req.file.path) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Failed to delete uploaded file:', err);
            });
        }

        res.status(500).json({
            success: false,
            error: error.message,
            code: error.code || 'GEMINI_PROCESSING_ERROR'
        });
    }
});

// Process raw text with Gemini (for external OCR results)
app.post('/api/process-text-with-gemini', async (req, res) => {
    try {
        const { text } = req.body;
        
        if (!text || typeof text !== 'string') {
            return res.status(400).json({ 
                error: 'No text provided. Please send text in request body as {"text": "your text here"}' 
            });
        }

        console.log(`📝 Processing raw text with Gemini: ${text.length} characters`);
        
        const results = await processWithGemini(text);
        
        // Save to database if available
        try {
            const savedRecord = await savePropertyNotice({
                filename: 'raw_text_input',
                extracted_data: results.extracted_data,
                raw_text: results.raw_text,
                confidence_score: results.confidence_score,
                processing_time_ms: results.processing_time_ms,
                processing_status: results.processing_status,
                ai_service: results.ai_service
            });
            results.database_id = savedRecord.id;
            results.saved_to_database = true;
        } catch (dbError) {
            console.warn('Database save failed:', dbError.message);
            results.saved_to_database = false;
            results.database_error = dbError.message;
        }

        res.json({
            success: true,
            message: 'Text processed successfully with Gemini AI',
            data: results
        });

    } catch (error) {
        console.error('Gemini text processing error:', error);
        
        res.status(500).json({
            success: false,
            error: error.message,
            code: error.code || 'GEMINI_TEXT_PROCESSING_ERROR'
        });
    }
});

// Test endpoint for date extraction
app.post('/api/test-extraction', async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) {
            return res.status(400).json({ error: 'Text is required' });
        }

        // Use Gemini for extraction testing
        const { processWithGemini } = require('./services/geminiService');
        const extractedData = await processWithGemini(text);
        
        res.json({
            success: true,
            extracted_data: extractedData.extracted_data,
            confidence_score: extractedData.confidence_score,
            raw_text: text,
            processing_notes: 'Tested with Gemini AI'
        });
    } catch (error) {
        console.error('Test extraction error:', error);
        res.status(500).json({ 
            error: 'Extraction test failed',
            details: error.message 
        });
    }
});

// Geocoding endpoints
app.post('/api/geocode/village', async (req, res) => {
    try {
        const { villageName, district } = req.body;
        if (!villageName) {
            return res.status(400).json({ error: 'Village name is required' });
        }

        const { geocodeVillage } = require('./services/geocodingService');
        const result = await geocodeVillage(villageName, district);
        
        res.json(result);
    } catch (error) {
        console.error('Geocoding error:', error);
        res.status(500).json({ 
            error: 'Geocoding failed',
            details: error.message 
        });
    }
});

app.post('/api/geocode/batch', async (req, res) => {
    try {
        const { villages } = req.body;
        if (!villages || !Array.isArray(villages)) {
            return res.status(400).json({ error: 'Villages array is required' });
        }

        const { geocodeVillagesBatch } = require('./services/geocodingService');
        const results = await geocodeVillagesBatch(villages);
        
        res.json({
            success: true,
            results: results
        });
    } catch (error) {
        console.error('Batch geocoding error:', error);
        res.status(500).json({ 
            error: 'Batch geocoding failed',
            details: error.message 
        });
    }
});

app.post('/api/geocode/existing', async (req, res) => {
    try {
        const { getVillagesNeedingGeocoding } = require('./services/firebaseService');
        const { geocodeVillage } = require('./services/geocodingService');
        
        const villages = await getVillagesNeedingGeocoding();
        console.log(`Found ${villages.length} villages needing geocoding`);
        
        const results = [];
        for (const village of villages) {
            try {
                const geocodingResult = await geocodeVillage(village.village_name, village.district);
                
                // Update the database with the result
                await updatePropertyNoticeLocation(village.id, geocodingResult);
                
                results.push({
                    id: village.id,
                    village_name: village.village_name,
                    success: geocodingResult.success,
                    coordinates: geocodingResult.success ? {
                        lat: geocodingResult.latitude,
                        lng: geocodingResult.longitude
                    } : null
                });
                
                // Add delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 200));
                
            } catch (error) {
                console.error(`Failed to geocode ${village.village_name}:`, error.message);
                results.push({
                    id: village.id,
                    village_name: village.village_name,
                    success: false,
                    error: error.message
                });
            }
        }
        
        res.json({
            success: true,
            message: `Processed ${villages.length} villages`,
            results: results
        });
    } catch (error) {
        console.error('Existing geocoding error:', error);
        res.status(500).json({ 
            error: 'Existing geocoding failed',
            details: error.message 
        });
    }
});

// Refine existing property notice data using Gemini AI
app.post('/api/refine-notice/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        console.log(`🔍 Refining property notice: ${id}`);
        
        // Get the existing notice
        const existingNotice = await getPropertyNoticeById(id);
        
        if (!existingNotice) {
            return res.status(404).json({
                error: 'Property notice not found',
                code: 'NOT_FOUND'
            });
        }
        
        console.log(`📋 Original data - Village: ${existingNotice.village_name}, Survey: ${existingNotice.survey_number}`);
        
        // Prepare original extracted data
        const originalData = {
            village_name: existingNotice.village_name,
            survey_number: existingNotice.survey_number,
            notice_date: existingNotice.notice_date,
            buyer_name: existingNotice.buyer_name,
            seller_name: existingNotice.seller_name,
            district: existingNotice.district,
            taluka: existingNotice.taluka,
            latitude: existingNotice.latitude,
            longitude: existingNotice.longitude
        };
        
        // Apply Gemini refinement
        const { refineExtractedDataWithGemini, getPerfectCoordinatesWithGemini } = require('./services/geminiService');
        
        // Step 1: Refine core data
        const refinedData = await refineExtractedDataWithGemini(originalData, existingNotice.raw_text);
        
        // Step 2: Get perfect coordinates if village name is refined
        if (refinedData.village_name && refinedData.village_name.length >= 2) {
            console.log(`🎯 Getting perfect coordinates for: ${refinedData.village_name}`);
            
            const perfectCoordinates = await getPerfectCoordinatesWithGemini(
                refinedData.village_name,
                refinedData.district || originalData.district,
                existingNotice.raw_text
            );
            
            if (perfectCoordinates.success) {
                refinedData.latitude = perfectCoordinates.latitude;
                refinedData.longitude = perfectCoordinates.longitude;
                refinedData.district = perfectCoordinates.district || refinedData.district;
                refinedData.taluka = perfectCoordinates.taluka || refinedData.taluka;
                refinedData.full_address = perfectCoordinates.formatted_address;
                refinedData.coordinate_source = perfectCoordinates.coordinate_source;
                refinedData.coordinate_confidence = perfectCoordinates.confidence_score;
                refinedData.geocoding_status = 'success_refined';
            }
        }
        
        // Update the database with refined data
        const updatedRecord = await updatePropertyNotice(id, {
            village_name: refinedData.village_name,
            survey_number: refinedData.survey_number,
            notice_date: refinedData.notice_date,
            extracted_data: refinedData,
            confidence_score: Math.max(existingNotice.confidence_score || 0, refinedData.refinement_confidence || 0)
        });
        
        // Also update location data if coordinates were refined
        if (refinedData.latitude && refinedData.longitude) {
            await updatePropertyNoticeLocation(id, {
                latitude: refinedData.latitude,
                longitude: refinedData.longitude,
                district: refinedData.district,
                taluka: refinedData.taluka,
                formatted_address: refinedData.full_address,
                status: 'success'
            });
        }
        
        console.log(`✅ Refinement completed for notice: ${id}`);
        
        res.json({
            success: true,
            message: 'Property notice refined successfully',
            data: {
                id: id,
                original_data: originalData,
                refined_data: refinedData,
                improvements: {
                    village_name_changed: originalData.village_name !== refinedData.village_name,
                    survey_number_changed: originalData.survey_number !== refinedData.survey_number,
                    notice_date_changed: originalData.notice_date !== refinedData.notice_date,
                    coordinates_added: !originalData.latitude && !!refinedData.latitude,
                    coordinates_improved: !!(originalData.latitude && refinedData.latitude && refinedData.coordinate_source)
                },
                refinement_notes: refinedData.refinement_notes
            }
        });
        
    } catch (error) {
        console.error('Refinement error:', error);
        
        res.status(500).json({
            success: false,
            error: 'Failed to refine property notice',
            message: error.message,
            code: error.code || 'REFINEMENT_ERROR'
        });
    }
});

// Batch refine multiple notices
app.post('/api/refine-batch', async (req, res) => {
    try {
        const { ids, refine_all } = req.body;
        
        let noticeIds = ids;
        
        if (refine_all) {
            // Get all notices that need refinement
            const allNoticesResult = await getPropertyNotices();
            
            // Handle the response structure correctly
            const allNotices = allNoticesResult.notices || allNoticesResult || [];
            noticeIds = allNotices
                .filter(notice => !notice.extracted_data?.refinement_applied)
                .map(notice => notice.id);
            
            console.log(`🔄 Batch refining ${noticeIds.length} notices`);
        }
        
        if (!noticeIds || !Array.isArray(noticeIds) || noticeIds.length === 0) {
            return res.status(400).json({
                error: 'No notice IDs provided for refinement',
                code: 'MISSING_IDS'
            });
        }
        
        const results = [];
        
        for (const id of noticeIds) {
            try {
                console.log(`🔍 Refining notice ${results.length + 1}/${noticeIds.length}: ${id}`);
                
                // Call the refine endpoint logic
                const refineResponse = await fetch(`http://localhost:${process.env.PORT || 4000}/api/refine-notice/${id}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                
                if (refineResponse.ok) {
                    const refineData = await refineResponse.json();
                    results.push({
                        id: id,
                        success: true,
                        improvements: refineData.data.improvements
                    });
                } else {
                    results.push({
                        id: id,
                        success: false,
                        error: 'Refinement failed'
                    });
                }
                
                // Add delay to avoid overwhelming the AI
                await new Promise(resolve => setTimeout(resolve, 500));
                
            } catch (error) {
                console.error(`Failed to refine notice ${id}:`, error.message);
                results.push({
                    id: id,
                    success: false,
                    error: error.message
                });
            }
        }
        
        const successCount = results.filter(r => r.success).length;
        
        res.json({
            success: true,
            message: `Batch refinement completed: ${successCount}/${noticeIds.length} successful`,
            data: {
                total_processed: noticeIds.length,
                successful: successCount,
                failed: noticeIds.length - successCount,
                results: results
            }
        });
        
    } catch (error) {
        console.error('Batch refinement error:', error);
        
        res.status(500).json({
            success: false,
            error: 'Batch refinement failed',
            message: error.message,
            code: error.code || 'BATCH_REFINEMENT_ERROR'
        });
    }
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        code: 'NOT_FOUND'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Property Notice Extractor server running on port ${PORT}`);
    console.log(`📁 Upload directory: ${uploadsDir}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    process.exit(0);
});

module.exports = app; 