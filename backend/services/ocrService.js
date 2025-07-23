const vision = require('@google-cloud/vision');
const fs = require('fs');
const { processWithGemini } = require('./geminiService');
const { AppError } = require('../middleware/errorHandler');

// Initialize Google Cloud Vision client
let client;

function initializeVisionClient() {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        // Use service account key from environment variable (for cloud deployment)
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        client = new vision.ImageAnnotatorClient({
            credentials: serviceAccount,
            projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
        });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        // Use service account file path (for local development)
        client = new vision.ImageAnnotatorClient({
            keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
            projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
        });
    } else {
        throw new Error('Google Cloud credentials not configured. Set FIREBASE_SERVICE_ACCOUNT_KEY or GOOGLE_APPLICATION_CREDENTIALS');
    }
    return client;
}

// Initialize the client
try {
    initializeVisionClient();
    console.log('Google Cloud Vision client initialized successfully');
} catch (error) {
    console.error('Google Cloud Vision client initialization failed:', error.message);
}

/**
 * Process property notice image using Google Cloud Vision API + Gemini AI ONLY
 * @param {string} imagePath - Path to the uploaded image file
 * @returns {Object} - Extracted property information
 */
async function processPropertyNotice(imagePath) {
    const startTime = Date.now();
    
    try {
        console.log(`🚀 Starting OCR + Gemini processing for: ${imagePath}`);
        
        // Verify file exists
        if (!fs.existsSync(imagePath)) {
            throw new AppError('Image file not found', 404, 'FILE_NOT_FOUND');
        }

        // Read the image file
        const imageBuffer = fs.readFileSync(imagePath);
        
        // Prepare the request for Google Cloud Vision API
        const request = {
            image: {
                content: imageBuffer
            },
            features: [
                {
                    type: 'TEXT_DETECTION',
                    maxResults: 1
                },
                {
                    type: 'DOCUMENT_TEXT_DETECTION',
                    maxResults: 1
                }
            ],
            imageContext: {
                languageHints: ['gu', 'en'] // Gujarati and English
            }
        };

        // Call Google Cloud Vision API
        console.log('📷 Calling Google Cloud Vision API...');
        const [result] = await client.annotateImage(request);
        
        // Check for errors in the API response
        if (result.error) {
            console.error('Vision API error:', result.error);
            throw new AppError(
                `Vision API error: ${result.error.message}`,
                500,
                'VISION_API_ERROR'
            );
        }

        // Extract text from the response
        const textAnnotations = result.textAnnotations;
        const fullTextAnnotation = result.fullTextAnnotation;
        
        if (!textAnnotations || textAnnotations.length === 0) {
            throw new AppError(
                'No text detected in the image',
                400,
                'NO_TEXT_DETECTED'
            );
        }

        // Get the raw text
        const rawText = textAnnotations[0].description || '';
        
        if (!rawText.trim()) {
            throw new AppError(
                'Empty text detected in the image',
                400,
                'EMPTY_TEXT_DETECTED'
            );
        }

        console.log(`📝 OCR completed. Text length: ${rawText.length} characters`);
        
        // Initialize variables for extraction results
        let extractedData = {};
        let confidenceScore = 0.5;
        let aiService = 'google_vision_only';
        
        // Process with Gemini AI (REQUIRED - no fallback)
        if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your-gemini-api-key') {
            throw new AppError(
                'Gemini API key not configured. Please set GEMINI_API_KEY in your .env file to extract data from property notices.',
                500,
                'GEMINI_API_KEY_REQUIRED'
            );
        }

        console.log('🤖 Processing extracted text with Gemini AI...');
        const geminiResult = await processWithGemini(rawText);
        extractedData = geminiResult.extracted_data;
        confidenceScore = geminiResult.confidence_score;
        aiService = 'google_vision_and_gemini';
        
        // 🎯 REFINEMENT LAYER: Perfect the extracted data
        console.log('✨ Applying data refinement layer for perfect accuracy...');
        try {
            const { refineExtractedDataWithGemini, getPerfectCoordinatesWithGemini } = require('./geminiService');
            
            // Step 1: Refine the core data (village name, survey number, notice date)
            const refinedData = await refineExtractedDataWithGemini(extractedData, rawText);
            
            // Step 2: Get perfect coordinates if we have a good village name
            if (refinedData.village_name && refinedData.village_name.length >= 2) {
                console.log(`🎯 Getting perfect coordinates for refined village: ${refinedData.village_name}`);
                
                const perfectCoordinates = await getPerfectCoordinatesWithGemini(
                    refinedData.village_name,
                    refinedData.district || extractedData.district,
                    rawText
                );
                
                if (perfectCoordinates.success) {
                    refinedData.latitude = perfectCoordinates.latitude;
                    refinedData.longitude = perfectCoordinates.longitude;
                    refinedData.district = perfectCoordinates.district || refinedData.district;
                    refinedData.taluka = perfectCoordinates.taluka || refinedData.taluka;
                    refinedData.full_address = perfectCoordinates.formatted_address;
                    refinedData.coordinate_source = perfectCoordinates.coordinate_source;
                    refinedData.coordinate_confidence = perfectCoordinates.confidence_score;
                    refinedData.geocoding_status = 'success_perfect';
                    
                    console.log(`✅ Perfect coordinates obtained: ${perfectCoordinates.latitude}, ${perfectCoordinates.longitude} (${perfectCoordinates.coordinate_source})`);
                } else {
                    console.log(`⚠️ Perfect coordinates failed: ${perfectCoordinates.error}`);
                    refinedData.geocoding_status = 'failed_perfect_attempt';
                    refinedData.geocoding_error = perfectCoordinates.error;
                }
            }
            
            // Use refined data
            extractedData = refinedData;
            aiService = 'google_vision_gemini_refined';
            
            // Update confidence score based on refinement
            if (refinedData.refinement_confidence) {
                confidenceScore = Math.max(confidenceScore, refinedData.refinement_confidence);
            }
            
            console.log('🎊 Data refinement completed successfully!');
            
        } catch (refinementError) {
            console.warn('Data refinement failed, using original Gemini results:', refinementError.message);
            // Continue with original Gemini results
        }
        
        const processingTime = Date.now() - startTime;
        console.log(`⏱️ Total processing time (${aiService}): ${processingTime}ms`);

        // Calculate structured text confidence if available
        const structuredTextConfidence = fullTextAnnotation ? 
            calculateAverageConfidence(fullTextAnnotation) : null;

        return {
            success: true,
            extracted_data: extractedData,
            raw_text: rawText,
            confidence_score: confidenceScore,
            processing_time_ms: processingTime,
            processing_status: 'completed',
            ai_service: aiService,
            vision_api_response: {
                text_length: rawText.length,
                annotations_count: textAnnotations.length,
                structured_confidence: structuredTextConfidence
            }
        };

    } catch (error) {
        const processingTime = Date.now() - startTime;
        
        console.error('❌ OCR processing error:', error);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            code: error.code,
            stack: error.stack
        });

        // If it's already an AppError, just add timing info and re-throw
        if (error instanceof AppError) {
            error.processing_time_ms = processingTime;
            throw error;
        }

        // Otherwise, wrap in an AppError
        throw new AppError(
            `OCR processing failed: ${error.message}`,
            500,
            'OCR_PROCESSING_ERROR',
            { processing_time_ms: processingTime }
        );
    }
}

/**
 * Get raw OCR text from image without parsing
 * @param {string} imagePath - Path to the uploaded image file
 * @returns {Object} - Raw Vision API response with text
 */
async function getRawOCRText(imagePath) {
    const startTime = Date.now();
    
    try {
        console.log(`📷 Getting raw OCR text for: ${imagePath}`);
        
        // Verify file exists
        if (!fs.existsSync(imagePath)) {
            throw new AppError('Image file not found', 404, 'FILE_NOT_FOUND');
        }

        // Read the image file
        const imageBuffer = fs.readFileSync(imagePath);
        
        // Prepare the request for Google Cloud Vision API
        const request = {
            image: {
                content: imageBuffer
            },
            features: [
                {
                    type: 'TEXT_DETECTION',
                    maxResults: 1
                },
                {
                    type: 'DOCUMENT_TEXT_DETECTION',
                    maxResults: 1
                }
            ],
            imageContext: {
                languageHints: ['gu', 'en'] // Gujarati and English
            }
        };

        // Call Google Cloud Vision API
        console.log('📷 Calling Google Cloud Vision API for raw text...');
        const [result] = await client.annotateImage(request);
        
        // Check for errors in the API response
        if (result.error) {
            console.error('Vision API error:', result.error);
            throw new AppError(
                `Vision API error: ${result.error.message}`,
                500,
                'VISION_API_ERROR'
            );
        }

        // Extract text from the response
        const textAnnotations = result.textAnnotations;
        const fullTextAnnotation = result.fullTextAnnotation;
        
        if (!textAnnotations || textAnnotations.length === 0) {
            throw new AppError(
                'No text detected in the image',
                400,
                'NO_TEXT_DETECTED'
            );
        }

        // Get the full text content
        const rawText = textAnnotations[0].description || '';
        
        // Get structured text with confidence scores
        const structuredText = fullTextAnnotation ? {
            text: fullTextAnnotation.text || '',
            pages: fullTextAnnotation.pages || [],
            confidence: calculateAverageConfidence(fullTextAnnotation)
        } : null;

        const processingTime = Date.now() - startTime;
        
        console.log(`✅ Raw OCR completed. Text length: ${rawText.length} characters`);
        console.log('📝 Raw text preview:', rawText.substring(0, 300) + '...');

        return {
            success: true,
            raw_text: rawText,
            structured_text: structuredText,
            confidence_score: structuredText ? structuredText.confidence : null,
            processing_time_ms: processingTime,
            text_length: rawText.length,
            vision_api_response: {
                textAnnotations: textAnnotations.slice(0, 5), // First 5 annotations for debugging
                fullTextAnnotation: fullTextAnnotation ? {
                    text: fullTextAnnotation.text,
                    confidence: structuredText.confidence
                } : null
            }
        };

    } catch (error) {
        const processingTime = Date.now() - startTime;
        
        console.error('❌ Raw OCR error:', error);
        
        if (error instanceof AppError) {
            error.processing_time_ms = processingTime;
            throw error;
        }
        
        throw new AppError(
            `Raw OCR extraction failed: ${error.message}`,
            500,
            'RAW_OCR_ERROR',
            { processing_time_ms: processingTime }
        );
    }
}

/**
 * Calculate average confidence score from Vision API response
 * @param {Object} fullTextAnnotation - Full text annotation from Vision API
 * @returns {number} - Average confidence score (0-1)
 */
function calculateAverageConfidence(fullTextAnnotation) {
    if (!fullTextAnnotation || !fullTextAnnotation.pages) {
        return null;
    }

    let totalConfidence = 0;
    let confidenceCount = 0;

    // Extract confidence scores from all text elements
    fullTextAnnotation.pages.forEach(page => {
        if (page.blocks) {
            page.blocks.forEach(block => {
                if (block.confidence !== undefined) {
                    totalConfidence += block.confidence;
                    confidenceCount++;
                }
            });
        }
    });

    return confidenceCount > 0 ? totalConfidence / confidenceCount : null;
}

/**
 * Test Google Cloud Vision API connectivity
 * @returns {Promise<boolean>} - True if API is accessible
 */
async function testVisionAPI() {
    try {
        // Create a simple test image (1x1 pixel PNG)
        const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAGA60e6kgAAAABJRU5ErkJggg==';
        const testImageBuffer = Buffer.from(testImageBase64, 'base64');
        
        const request = {
            image: {
                content: testImageBuffer
            },
            features: [
                {
                    type: 'TEXT_DETECTION',
                    maxResults: 1
                }
            ]
        };

        await client.annotateImage(request);
        console.log('Google Cloud Vision API connectivity test passed');
        return true;
    } catch (error) {
        console.error('Google Cloud Vision API connectivity test failed:', error);
        return false;
    }
}

/**
 * Get supported languages from Vision API
 * @returns {Promise<Array>} - List of supported languages
 */
async function getSupportedLanguages() {
    try {
        // This is a placeholder - Vision API doesn't have a direct endpoint for supported languages
        // But we know it supports Gujarati and English
        return [
            { code: 'gu', name: 'Gujarati' },
            { code: 'en', name: 'English' },
            { code: 'hi', name: 'Hindi' }
        ];
    } catch (error) {
        console.error('Failed to get supported languages:', error);
        return [];
    }
}

module.exports = {
    processPropertyNotice,
    getRawOCRText,
    calculateAverageConfidence,
    testVisionAPI,
    getSupportedLanguages
}; 