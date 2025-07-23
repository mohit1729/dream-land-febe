const { GoogleGenerativeAI } = require('@google/generative-ai');
const { AppError } = require('../middleware/errorHandler');

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Process raw OCR text using Google Gemini AI
 * @param {string} rawText - Raw text from Google Cloud Vision API
 * @returns {Object} - Extracted property information
 */
async function processWithGemini(rawText) {
    const startTime = Date.now();
    
    try {
        console.log('🤖 Processing with Google Gemini AI...');
        console.log(`📝 Raw text length: ${rawText.length} characters`);
        
        if (!process.env.GEMINI_API_KEY) {
            throw new AppError(
                'Gemini API key not configured. Please set GEMINI_API_KEY in your .env file',
                500,
                'GEMINI_API_KEY_MISSING'
            );
        }

        // Get the Gemini model
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        // Create the prompt for property notice extraction
        const prompt = createExtractionPrompt(rawText);

        // Generate content using Gemini
        console.log('🔄 Calling Gemini API...');
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        console.log('✅ Gemini API response received');
        console.log('📋 Response preview:', text.substring(0, 200) + '...');

        // Parse the JSON response from Gemini
        const extractedData = parseGeminiResponse(text);
        
        const processingTime = Date.now() - startTime;
        console.log(`⏱️ Gemini processing time: ${processingTime}ms`);

        return {
            raw_text: rawText,
            extracted_data: extractedData.data,
            confidence_score: extractedData.confidence,
            processing_time_ms: processingTime,
            processing_status: 'completed_gemini',
            ai_service: 'google-gemini-1.5-flash',
            gemini_response: text
        };

    } catch (error) {
        const processingTime = Date.now() - startTime;
        console.error('❌ Gemini processing failed:', error);
        
        // Handle specific Gemini API errors
        if (error.message?.includes('API_KEY_INVALID')) {
            throw new AppError(
                'Invalid Gemini API key. Please check your GEMINI_API_KEY',
                403,
                'GEMINI_API_KEY_INVALID'
            );
        }
        
        if (error.message?.includes('QUOTA_EXCEEDED')) {
            throw new AppError(
                'Gemini API quota exceeded. Please check your billing',
                429,
                'GEMINI_QUOTA_EXCEEDED'
            );
        }

        if (error.message?.includes('SAFETY')) {
            throw new AppError(
                'Content blocked by Gemini safety filters',
                400,
                'GEMINI_SAFETY_BLOCK'
            );
        }

        // Re-throw AppError instances
        if (error instanceof AppError) {
            throw error;
        }

        // Generic error handling
        throw new AppError(
            `Gemini AI processing failed: ${error.message}`,
            500,
            'GEMINI_PROCESSING_ERROR'
        );
    }
}

/**
 * Create extraction prompt for Gemini
 * @param {string} rawText - Raw OCR text
 * @returns {string} - Formatted prompt
 */
function createExtractionPrompt(rawText) {
    return `
You are an expert at extracting information from Gujarati property notices. 

Please analyze the following OCR text from a Gujarati property notice and extract the required information. The text may contain OCR errors, so use your understanding of Gujarati language and property notice formats to infer the correct information.

**Raw OCR Text:**
${rawText}

**CRITICAL VILLAGE NAME EXTRACTION RULES:**
The most important field is village_name. You MUST follow these rules EXACTLY:

1. **EXTRACT ONLY THE VILLAGE NAME** - Do NOT include:
   - "રેવન્યુ સર્વે નં" (Revenue Survey Number)
   - "સર્વે નં" (Survey Number) 
   - "ના" (of/belonging to)
   - "ની" (of/belonging to)
   - "નું" (of/belonging to)
   - Any numbers or survey references
   - "ગામ" prefix (remove if present)
   - "મોજે ગામ" prefix (remove if present)

2. **EXAMPLES OF CORRECT EXTRACTION:**
   - From: "મોજે ગામ રીબડાના રેવન્યુ સર્વે નં.૩૬૭" → Extract: "રીબડા"
   - From: "ગામ સાંગણવાના સર્વે નં ૧૫૮" → Extract: "સાંગણવા"  
   - From: "ઢાંઢણીના રેવન્યુ સર્વે નં" → Extract: "ઢાંઢણી"
   - From: "મોજે ગામ પાટદીના" → Extract: "પાટદી"

3. **PATTERN RECOGNITION:**
   - Look for "મોજે ગામ [VILLAGE_NAME]ના" → Extract only [VILLAGE_NAME]
   - Look for "ગામ [VILLAGE_NAME]ના" → Extract only [VILLAGE_NAME]
   - Look for "[VILLAGE_NAME]ના રેવન્યુ સર્વે" → Extract only [VILLAGE_NAME]
   - Look for "[VILLAGE_NAME]ના સર્વે નં" → Extract only [VILLAGE_NAME]

**Required Fields:**
- village_name: ગામનું નામ (Village Name) - CLEAN NAME ONLY (no survey references, no "ના" suffix)
- village_name_cleaned: Same as village_name but for geocoding (should be identical to village_name)
- survey_number: રેવન્યુ સર્વે નં. (Revenue Survey Number) - extract COMPLETE survey number including sub-divisions like "૧૫૮ પૈકી-૩" or "158/3"
- buyer_name: ખરીદનાર (Buyer's Name)
- seller_name: વેચનાર (Seller's Name) 
- notice_date: તારીખ (Notice Date) - Look for patterns like "તારીખ:-૧૮-૦૭-૨૦૨૫", format as DD/MM/YYYY
- advocate_name: એડવોકેટ (Advocate's Name)
- advocate_address: એડવોકેટનું સરનામું (Advocate's Address)
- advocate_mobile: મોબાઇલ નંબર (Mobile Number) - extract only digits
- district: જિલ્લો (District) - Usually "Rajkot" or extract if mentioned
- taluka: તાલુકો (Taluka/Sub-district) - Extract if mentioned in the text

**Special Instructions for Date Extraction:**
- Look specifically for "તારીખ" or "તા." followed by date
- Convert Gujarati numerals (૦૧૨૩૪૫૬૭૮૯) to English numerals (0123456789)
- The date format is typically DD-MM-YYYY or DD/MM/YYYY
- Examples: "તારીખ:-૧૮-૦૭-૨૦૨૫" should become "18/07/2025"

**Special Instructions for Survey Number Extraction:**
- Look for "રેવન્યુ સર્વે નં." or "સર્વે નં." patterns
- Include ALL parts of survey number including sub-divisions with "પૈકી"
- Examples: "સર્વે નં. ૧૫૮ પૈકી-૩" should become "158 પૈકી-3" or "158/3"

**VILLAGE NAME VALIDATION:**
Before providing your answer, check:
- Does village_name contain "રેવન્યુ"? → WRONG, remove it
- Does village_name contain "સર્વે"? → WRONG, remove it  
- Does village_name contain "નં"? → WRONG, remove it
- Does village_name end with "ના"? → WRONG, remove it
- Does village_name contain numbers? → WRONG, remove them
- Is village_name longer than 10 characters? → Likely WRONG, extract core name only

**Response Format:**
Please respond with ONLY a valid JSON object in this exact format:

{
  "data": {
    "village_name": "extracted clean village name only",
    "village_name_cleaned": "same as village_name",
    "survey_number": "extracted survey number or null",
    "buyer_name": "extracted buyer name or null", 
    "seller_name": "extracted seller name or null",
    "notice_date": "extracted date in DD/MM/YYYY format or null",
    "advocate_name": "extracted advocate name or null",
    "advocate_address": "extracted advocate address or null",
    "advocate_mobile": "extracted mobile number or null",
    "district": "extracted district or null",
    "taluka": "extracted taluka or null"
  },
  "confidence": 0.85,
  "notes": "Village name extraction notes and any relevant observations"
}

CRITICAL: The village_name field is the most important. Make sure it contains ONLY the clean village name without any extra text.

Important: Respond with ONLY the JSON object, no additional text or formatting.
`;
}

/**
 * Clean and fix village names after Gemini extraction
 * @param {Object} extractedData - Raw extracted data from Gemini
 * @returns {Object} - Cleaned extracted data
 */
function postProcessVillageNames(extractedData) {
    if (!extractedData.village_name) {
        return extractedData;
    }
    
    let originalName = extractedData.village_name;
    
    // Step 1: Remove all unwanted text aggressively
    let cleanedVillageName = originalName
        // Remove "રેવન્યુ સર્વે નં" and everything after it
        .replace(/\s*રેવન્યુ\s*સર્વે\s*નં.*$/gi, '')
        .replace(/\s*સર્વે\s*નં.*$/gi, '')
        // Remove "ના/ની/નું" suffixes when they appear after village name
        .replace(/ના\s*$/, '')
        .replace(/ની\s*$/, '')
        .replace(/નું\s*$/, '')
        // Remove "ગામ" and "મોજે ગામ" prefixes
        .replace(/^મોજે\s+ગામ\s+/, '')
        .replace(/^ગામ\s+/, '')
        // Remove any numbers and dots
        .replace(/[0-9\.\-\/]+/g, '')
        // Remove extra whitespace
        .replace(/\s+/g, ' ')
        .trim();
    
    // Step 2: Extract from patterns if name is still too long or contains unwanted text
    if (cleanedVillageName.length > 10 || cleanedVillageName.includes('સર્વે') || cleanedVillageName.includes('રેવન્યુ')) {
        console.log(`🔍 Village name still contains unwanted text: "${cleanedVillageName}". Applying pattern extraction...`);
        
        // Try to extract village name from common patterns
        const patterns = [
            // "મોજે ગામ [VILLAGE]ના"
            /મોજે\s+ગામ\s+([^\s,\.]+)ના/g,
            // "ગામ [VILLAGE]ના"  
            /ગામ\s+([^\s,\.]+)ના/g,
            // "[VILLAGE]ના રેવન્યુ"
            /([^\s,\.]+)ના\s+રેવન્યુ/g,
            // "[VILLAGE]ના સર્વે"
            /([^\s,\.]+)ના\s+સર્વે/g,
            // Just "[VILLAGE]ના" at end
            /([^\s,\.]+)ના$/g,
            // Extract first meaningful Gujarati word
            /([^\s,\.]{2,})/g
        ];
        
        for (const pattern of patterns) {
            const match = originalName.match(pattern);
            if (match && match[1]) {
                const candidate = match[1].trim();
                // Check if candidate looks like a valid village name
                if (candidate.length >= 2 && candidate.length <= 10 && 
                    !candidate.includes('સર્વે') && 
                    !candidate.includes('રેવન્યુ') &&
                    !candidate.includes('નં')) {
                    cleanedVillageName = candidate;
                    console.log(`✅ Extracted village name using pattern: "${cleanedVillageName}"`);
                    break;
                }
            }
        }
    }
    
    // Step 3: Final validation
    if (cleanedVillageName.length < 2) {
        console.warn(`⚠️ Village name too short after cleaning: "${cleanedVillageName}". Using original: "${originalName}"`);
        cleanedVillageName = originalName;
    }
    
    // Step 4: Ensure village_name_cleaned is the same as village_name for consistency
    const finalVillageName = cleanedVillageName || originalName;
    
    console.log(`🏘️ Village name processing: "${originalName}" → "${finalVillageName}"`);
    
    return {
        ...extractedData,
        village_name: finalVillageName,
        village_name_cleaned: finalVillageName
    };
}

/**
 * Parse Gemini response and extract structured data
 * @param {string} geminiResponse - Raw response from Gemini
 * @returns {Object} - Parsed extraction data
 */
function parseGeminiResponse(geminiResponse) {
    try {
        // Clean the response - remove markdown formatting if present
        let cleanResponse = geminiResponse.trim();
        
        // Remove markdown code blocks if present
        cleanResponse = cleanResponse.replace(/```json\s*/, '').replace(/```\s*$/, '');
        cleanResponse = cleanResponse.replace(/```\s*/, '').replace(/```\s*$/, '');
        
        // Parse JSON
        const parsed = JSON.parse(cleanResponse);
        
        // Validate structure
        if (!parsed.data || typeof parsed.data !== 'object') {
            throw new Error('Invalid response structure: missing data object');
        }

        // Post-process village names to ensure they're clean
        const cleanedData = postProcessVillageNames(parsed.data);

        // Ensure confidence score is valid
        const confidence = parsed.confidence || 0.5;
        const validConfidence = Math.min(Math.max(confidence, 0), 1);

        return {
            data: cleanedData,
            confidence: validConfidence,
            notes: parsed.notes || 'Processed with Gemini AI'
        };

    } catch (error) {
        console.error('Failed to parse Gemini response:', error);
        console.error('Raw response:', geminiResponse);
        
        // Fallback: try to extract any JSON-like content
        const jsonMatch = geminiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                const fallbackParsed = JSON.parse(jsonMatch[0]);
                if (fallbackParsed.data) {
                    return {
                        data: fallbackParsed.data,
                        confidence: fallbackParsed.confidence || 0.3,
                        notes: 'Parsed with fallback method'
                    };
                }
            } catch (fallbackError) {
                console.error('Fallback parsing also failed:', fallbackError);
            }
        }

        // Ultimate fallback: return empty structure
        return {
            data: {
                village_name: null,
                village_name_cleaned: null,
                survey_number: null,
                buyer_name: null,
                seller_name: null,
                notice_date: null,
                advocate_name: null,
                advocate_address: null,
                advocate_mobile: null,
                district: null,
                taluka: null
            },
            confidence: 0.1,
            notes: 'Failed to parse Gemini response, returned empty structure'
        };
    }
}

/**
 * Test Gemini API connectivity
 * @returns {Promise<boolean>} - True if API is accessible
 */
async function testGeminiAPI() {
    try {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY not configured');
        }

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent("Hello, please respond with 'API Working'");
        const response = await result.response;
        const text = response.text();
        
        console.log('✅ Gemini API test successful:', text);
        return true;
        
    } catch (error) {
        console.error('❌ Gemini API test failed:', error.message);
        return false;
    }
}

/**
 * Process image with combined Vision + Gemini workflow and automatic geocoding
 * @param {string} imagePath - Path to the uploaded image file
 * @returns {Object} - Complete processing results with location data
 */
async function processImageWithGemini(imagePath) {
    const { getRawOCRText } = require('./ocrService');
    
    try {
        console.log('🚀 Starting Vision + Gemini + Geocoding processing...');
        
        // Step 1: Extract raw text using Google Cloud Vision
        console.log('📷 Step 1: Extracting text with Google Cloud Vision...');
        const ocrData = await getRawOCRText(imagePath);
        
        // Step 2: Process with Gemini AI
        console.log('🤖 Step 2: Processing with Gemini AI...');
        const geminiResults = await processWithGemini(ocrData.raw_text);
        
        // Step 3: Auto-geocode the extracted village if available
        let locationData = null;
        let geocodingTime = 0;
        
        if (geminiResults.extracted_data?.village_name_cleaned || geminiResults.extracted_data?.village_name) {
            try {
                console.log('🌍 Step 3: Auto-geocoding village location...');
                const geocodingStart = Date.now();
                
                const { geocodeVillage } = require('./geocodingService');
                const villageName = geminiResults.extracted_data.village_name_cleaned || geminiResults.extracted_data.village_name;
                const district = geminiResults.extracted_data.district || 'Rajkot';
                
                locationData = await geocodeVillage(villageName, district);
                geocodingTime = Date.now() - geocodingStart;
                
                if (locationData.success) {
                    console.log(`✅ Village geocoded: ${villageName} -> ${locationData.latitude}, ${locationData.longitude}`);
                    
                    // Add location data to extracted_data
                    geminiResults.extracted_data = {
                        ...geminiResults.extracted_data,
                        latitude: locationData.latitude,
                        longitude: locationData.longitude,
                        district: locationData.district || geminiResults.extracted_data.district,
                        taluka: locationData.taluka || geminiResults.extracted_data.taluka,
                        full_address: locationData.formatted_address,
                        geocoding_status: 'success'
                    };
                } else {
                    console.log(`❌ Geocoding failed for: ${villageName}`);
                    geminiResults.extracted_data.geocoding_status = 'failed';
                    geminiResults.extracted_data.geocoding_error = locationData.error;
                }
                
            } catch (geocodingError) {
                console.warn('⚠️ Geocoding failed, continuing without location data:', geocodingError.message);
                geminiResults.extracted_data.geocoding_status = 'error';
                geminiResults.extracted_data.geocoding_error = geocodingError.message;
            }
        } else {
            console.log('ℹ️ No village name found, skipping geocoding');
            geminiResults.extracted_data.geocoding_status = 'no_village_name';
        }
        
        console.log('✅ Enhanced processing completed successfully');
        
        return {
            ...geminiResults,
            vision_processing_time: ocrData.processing_time_ms,
            geocoding_time_ms: geocodingTime,
            total_processing_time: ocrData.processing_time_ms + geminiResults.processing_time_ms + geocodingTime,
            processing_method: 'vision_plus_gemini_plus_geocoding',
            location_data: locationData
        };
        
    } catch (error) {
        console.error('❌ Enhanced processing failed:', error);
        throw error;
    }
}

/**
 * Process image with combined Vision + Gemini workflow (original function for backward compatibility)
 * @param {string} imagePath - Path to the uploaded image file
 * @returns {Object} - Complete processing results
 */
async function processImageWithGeminiOnly(imagePath) {
    const { getRawOCRText } = require('./ocrService');
    
    try {
        console.log('🚀 Starting Vision + Gemini processing...');
        
        // Step 1: Extract raw text using Google Cloud Vision
        console.log('📷 Step 1: Extracting text with Google Cloud Vision...');
        const ocrData = await getRawOCRText(imagePath);
        
        // Step 2: Process with Gemini AI
        console.log('🤖 Step 2: Processing with Gemini AI...');
        const geminiResults = await processWithGemini(ocrData.raw_text);
        
        console.log('✅ Combined processing completed successfully');
        
        return {
            ...geminiResults,
            vision_processing_time: ocrData.processing_time_ms,
            total_processing_time: ocrData.processing_time_ms + geminiResults.processing_time_ms,
            processing_method: 'vision_plus_gemini'
        };
        
    } catch (error) {
        console.error('❌ Combined processing failed:', error);
        throw error;
    }
}

/**
 * Refine and perfect extracted data using Gemini AI
 * Focuses on getting perfect village names, survey numbers, notice dates, and coordinates
 * @param {Object} extractedData - Previously extracted data
 * @param {string} rawText - Original OCR text  
 * @returns {Object} - Refined and perfected data
 */
async function refineExtractedDataWithGemini(extractedData, rawText) {
    const startTime = Date.now();
    
    try {
        console.log('🔍 Refining extracted data with Gemini AI for perfect accuracy...');
        
        if (!process.env.GEMINI_API_KEY) {
            console.warn('Gemini API key not available, skipping refinement');
            return extractedData;
        }

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        // Create specialized refinement prompt
        const refinementPrompt = `
You are an expert in Gujarati property notices and geographic data. Your task is to PERFECT the following 4 critical fields from this property notice:

ORIGINAL EXTRACTED DATA:
- Village Name: "${extractedData.village_name || 'Not found'}"
- Survey Number: "${extractedData.survey_number || 'Not found'}"  
- Notice Date: "${extractedData.notice_date || 'Not found'}"
- Current Coordinates: lat=${extractedData.latitude || 'None'}, lng=${extractedData.longitude || 'None'}

ORIGINAL OCR TEXT:
${rawText}

Please analyze the OCR text very carefully and provide PERFECT, ACCURATE information for these 4 fields:

1. **PERFECT VILLAGE NAME**: 
   - Clean Gujarati village name (remove any OCR artifacts like "રેવન્યુ સર્વે નં", "સર્વે નં", etc.)
   - Remove prefixes like "ગામ", "મોજે ગામ"
   - Remove suffixes like "ના", "ની", "નું"
   - Provide the cleanest, most accurate village name

2. **PERFECT SURVEY NUMBER**:
   - Extract the exact survey/sub-survey number
   - Look for patterns like "સર્વે નં", "રેવન્યુ સર્વે નં", "Sub"
   - Include all relevant survey identifiers

3. **PERFECT NOTICE DATE**:
   - Find the actual notice date (not filing date or other dates)
   - Convert to DD/MM/YYYY format
   - Look for Gujarati date patterns

4. **PERFECT COORDINATES** (if village name is clear):
   - Based on the PERFECT village name you identified
   - Provide accurate Gujarat coordinates for this village
   - Only provide if you're confident about the village name

RESPOND WITH VALID JSON ONLY:
{
  "village_name": "cleaned perfect village name",
  "survey_number": "exact survey number",
  "notice_date": "DD/MM/YYYY",
  "latitude": latitude_number_or_null,
  "longitude": longitude_number_or_null,
  "confidence_score": confidence_0_to_1,
  "refinement_notes": "brief explanation of changes made"
}
`;

        console.log('🔄 Calling Gemini for data refinement...');
        const result = await model.generateContent(refinementPrompt);
        const response = await result.response;
        const text = response.text();

        console.log('✅ Gemini refinement response received');
        console.log('📋 Refinement response preview:', text.substring(0, 300) + '...');

        // Parse the refinement response directly (not using parseGeminiResponse as it expects different format)
        let refinedData;
        try {
            // Clean the response
            let cleanResponse = text.trim();
            cleanResponse = cleanResponse.replace(/```json\s*/, '').replace(/```\s*$/, '');
            cleanResponse = cleanResponse.replace(/```\s*/, '').replace(/```\s*$/, '');
            
            // Parse JSON directly
            refinedData = JSON.parse(cleanResponse);
            
            console.log('✅ Refinement data parsed successfully');
            
        } catch (parseError) {
            console.error('Failed to parse refinement response:', parseError);
            console.error('Raw response:', text);
            throw new Error(`Refinement response parsing failed: ${parseError.message}`);
        }
        
        const processingTime = Date.now() - startTime;
        console.log(`⏱️ Gemini refinement time: ${processingTime}ms`);

        // Merge refined data with original data
        const mergedData = {
            ...extractedData,
            ...refinedData,
            // Keep original data as backup
            original_village_name: extractedData.village_name,
            original_survey_number: extractedData.survey_number,
            original_notice_date: extractedData.notice_date,
            original_latitude: extractedData.latitude,
            original_longitude: extractedData.longitude,
            refinement_applied: true,
            refinement_confidence: refinedData.confidence_score,
            refinement_notes: refinedData.refinement_notes,
            refinement_time_ms: processingTime
        };

        console.log('✨ Data refinement completed:', {
            original_village: extractedData.village_name,
            refined_village: refinedData.village_name,
            original_survey: extractedData.survey_number,
            refined_survey: refinedData.survey_number,
            original_date: extractedData.notice_date,
            refined_date: refinedData.notice_date,
            coordinates_added: !!(refinedData.latitude && refinedData.longitude)
        });

        return mergedData;

    } catch (error) {
        console.error('Gemini refinement error:', error);
        console.warn('Continuing with original data due to refinement error');
        
        // Return original data with error info
        return {
            ...extractedData,
            refinement_applied: false,
            refinement_error: error.message,
            refinement_time_ms: Date.now() - startTime
        };
    }
}

/**
 * Get perfect coordinates for a village using Gemini AI + Google Maps Geocoding
 * @param {string} villageName - Perfect village name
 * @param {string} district - District name
 * @param {string} rawText - Original OCR text for context
 * @returns {Object} - Coordinate data with high accuracy
 */
async function getPerfectCoordinatesWithGemini(villageName, district = null, rawText = '') {
    const startTime = Date.now();
    
    try {
        console.log(`🎯 Getting perfect coordinates for: ${villageName}, District: ${district || 'Unknown'}`);
        
        if (!process.env.GEMINI_API_KEY) {
            console.warn('Gemini API key not available, skipping coordinate refinement');
            return { success: false, error: 'Gemini API not available' };
        }

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        // Create specialized coordinate prompt
        const coordinatePrompt = `
You are a geographic expert specializing in Gujarat, India. I need the most accurate coordinates for this village.

VILLAGE INFORMATION:
- Village Name: "${villageName}"
- District: "${district || 'Unknown'}"
- Context from OCR: "${rawText.substring(0, 500)}"

Please provide:
1. **MOST ACCURATE COORDINATES** for this village in Gujarat
2. **COMPLETE GEOGRAPHIC INFO** including district, taluka, state
3. **CONFIDENCE LEVEL** in your coordinate accuracy

Consider:
- Common village name variations and spellings
- Geographic context from surrounding areas mentioned in the OCR
- Administrative boundaries (district, taluka)
- Known landmarks or neighboring villages

RESPOND WITH VALID JSON ONLY:
{
  "village_name": "standardized village name",
  "latitude": precise_latitude_number,
  "longitude": precise_longitude_number,
  "district": "verified district name",
  "taluka": "taluka/tehsil name",
  "state": "Gujarat",
  "country": "India",
  "confidence_score": confidence_0_to_1,
  "coordinate_source": "gemini_geographic_knowledge",
  "notes": "geographic context or reasoning"
}
`;

        console.log('🔄 Calling Gemini for coordinate analysis...');
        const result = await model.generateContent(coordinatePrompt);
        const response = await result.response;
        const text = response.text();

        console.log('✅ Gemini coordinate response received');
        
        // Parse the coordinate response directly
        let coordinateData;
        try {
            // Clean the response
            let cleanResponse = text.trim();
            cleanResponse = cleanResponse.replace(/```json\s*/, '').replace(/```\s*$/, '');
            cleanResponse = cleanResponse.replace(/```\s*/, '').replace(/```\s*$/, '');
            
            // Parse JSON directly
            coordinateData = JSON.parse(cleanResponse);
            
            console.log('✅ Coordinate data parsed successfully');
            
        } catch (parseError) {
            console.error('Failed to parse coordinate response:', parseError);
            console.error('Raw response:', text);
            return {
                success: false,
                error: `Coordinate response parsing failed: ${parseError.message}`,
                processing_time_ms: Date.now() - startTime
            };
        }
        
        const processingTime = Date.now() - startTime;

        if (coordinateData && coordinateData.latitude && coordinateData.longitude) {
            // If we have good coordinates from Gemini, also try Google Maps for verification
            try {
                const { geocodeVillage } = require('./geocodingService');
                const googleMapsResult = await geocodeVillage(villageName, district);
                
                if (googleMapsResult.success) {
                    // Compare the two results and use the most reliable one
                    const geminiCoords = coordinateData;
                    const googleCoords = googleMapsResult;
                    
                    // Calculate distance between the two coordinate sets
                    const distance = calculateDistance(
                        geminiCoords.latitude, geminiCoords.longitude,
                        googleCoords.latitude, googleCoords.longitude
                    );
                    
                    console.log(`📊 Coordinate comparison - Distance: ${distance.toFixed(2)}km`);
                    
                    // If coordinates are close (within 10km), use Google Maps (more reliable)
                    // If far apart, use higher confidence source
                    if (distance <= 10) {
                        return {
                            success: true,
                            latitude: googleCoords.latitude,
                            longitude: googleCoords.longitude,
                            district: googleCoords.district || district,
                            taluka: googleCoords.taluka,
                            formatted_address: googleCoords.formatted_address,
                            coordinate_source: 'google_maps_verified',
                            gemini_coordinates: geminiCoords,
                            coordinate_distance_km: distance,
                            confidence_score: Math.max(googleCoords.confidence_score || 0.8, geminiCoords.confidence_score || 0.7),
                            processing_time_ms: processingTime
                        };
                    } else {
                        // Use the source with higher confidence
                        const useGoogleMaps = (googleCoords.confidence_score || 0.8) > (geminiCoords.confidence_score || 0.7);
                        const chosenSource = useGoogleMaps ? googleCoords : geminiCoords;
                        
                        return {
                            success: true,
                            latitude: chosenSource.latitude,
                            longitude: chosenSource.longitude,
                            district: chosenSource.district || district,
                            taluka: chosenSource.taluka,
                            formatted_address: chosenSource.formatted_address || `${villageName}, ${district}, Gujarat`,
                            coordinate_source: useGoogleMaps ? 'google_maps_high_confidence' : 'gemini_high_confidence',
                            alternative_coordinates: useGoogleMaps ? geminiCoords : googleCoords,
                            coordinate_distance_km: distance,
                            confidence_score: chosenSource.confidence_score || 0.7,
                            processing_time_ms: processingTime
                        };
                    }
                }
            } catch (geocodingError) {
                console.warn('Google Maps verification failed, using Gemini coordinates:', geocodingError.message);
            }
            
            // Use Gemini coordinates if Google Maps failed
            return {
                success: true,
                latitude: coordinateData.latitude,
                longitude: coordinateData.longitude,
                district: coordinateData.district || district,
                taluka: coordinateData.taluka,
                formatted_address: `${coordinateData.village_name}, ${coordinateData.district}, Gujarat`,
                coordinate_source: 'gemini_only',
                confidence_score: coordinateData.confidence_score || 0.6,
                processing_time_ms: processingTime
            };
        }
        
        return {
            success: false,
            error: 'Gemini could not provide reliable coordinates',
            processing_time_ms: processingTime
        };

    } catch (error) {
        console.error('Perfect coordinate extraction error:', error);
        
        return {
            success: false,
            error: error.message,
            processing_time_ms: Date.now() - startTime
        };
    }
}

/**
 * Calculate distance between two coordinate points (Haversine formula)
 * @param {number} lat1 - Latitude 1
 * @param {number} lon1 - Longitude 1  
 * @param {number} lat2 - Latitude 2
 * @param {number} lon2 - Longitude 2
 * @returns {number} - Distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of Earth in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

module.exports = {
    processWithGemini,
    processImageWithGemini,
    processImageWithGeminiOnly,
    testGeminiAPI,
    createExtractionPrompt,
    parseGeminiResponse,
    refineExtractedDataWithGemini,
    getPerfectCoordinatesWithGemini
}; 