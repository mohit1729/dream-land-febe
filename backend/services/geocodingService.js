/**
 * Geocoding Service for Property Notices
 * Converts village names to latitude/longitude coordinates using Google Maps API
 */

const { AppError } = require('../middleware/errorHandler');

/**
 * Geocode a village name to get coordinates and address details
 * @param {string} villageName - Name of the village
 * @param {string} district - District name (optional)
 * @param {string} state - State name (default: Gujarat)
 * @returns {Object} - Geocoding result with coordinates and address components
 */
async function geocodeVillage(villageName, district = null, state = 'Gujarat, India') {
    try {
        console.log(`🌍 Geocoding village: ${villageName}, District: ${district || 'Unknown'}`);
        
        if (!process.env.GOOGLE_MAPS_API_KEY) {
            throw new AppError(
                'Google Maps API key not configured. Please set GOOGLE_MAPS_API_KEY in your .env file',
                500,
                'GOOGLE_MAPS_API_KEY_MISSING'
            );
        }

        // Clean and format the village name
        const cleanVillageName = cleanVillageNameForGeocoding(villageName);
        
        // Build search query
        let searchQuery = cleanVillageName;
        if (district) {
            searchQuery += `, ${district}`;
        }
        searchQuery += `, ${state}`;

        console.log(`📍 Search query: ${searchQuery}`);

        // Call Google Maps Geocoding API
        const response = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(searchQuery)}&key=${process.env.GOOGLE_MAPS_API_KEY}&region=in&language=en`
        );

        if (!response.ok) {
            throw new AppError(
                `Google Maps API request failed: ${response.status} ${response.statusText}`,
                response.status,
                'GOOGLE_MAPS_API_ERROR'
            );
        }

        const data = await response.json();

        if (data.status === 'ZERO_RESULTS') {
            console.log(`❌ No results found for: ${searchQuery}`);
            return {
                success: false,
                error: 'No location found for this village',
                status: 'not_found',
                search_query: searchQuery
            };
        }

        if (data.status !== 'OK') {
            throw new AppError(
                `Google Maps API error: ${data.status} - ${data.error_message || 'Unknown error'}`,
                400,
                'GOOGLE_MAPS_API_ERROR'
            );
        }

        // Extract the best result
        const result = data.results[0];
        const location = result.geometry.location;
        const addressComponents = result.address_components;

        // Parse address components
        const parsedAddress = parseAddressComponents(addressComponents);

        console.log(`✅ Geocoded successfully: ${location.lat}, ${location.lng}`);

        return {
            success: true,
            latitude: location.lat,
            longitude: location.lng,
            formatted_address: result.formatted_address,
            district: parsedAddress.district,
            taluka: parsedAddress.taluka,
            state: parsedAddress.state,
            country: parsedAddress.country,
            place_id: result.place_id,
            location_type: result.geometry.location_type,
            search_query: searchQuery,
            status: 'success'
        };

    } catch (error) {
        console.error('❌ Geocoding error:', error);
        
        if (error instanceof AppError) {
            throw error;
        }
        
        throw new AppError(
            `Geocoding failed: ${error.message}`,
            500,
            'GEOCODING_ERROR'
        );
    }
}

/**
 * Clean village name for better geocoding results
 * @param {string} villageName - Raw village name from OCR
 * @returns {string} - Cleaned village name
 */
function cleanVillageNameForGeocoding(villageName) {
    if (!villageName) return '';
    
    // Remove common OCR artifacts and unwanted text
    let cleaned = villageName
        // Remove "રેવન્યુ સર્વે નં" and similar text
        .replace(/રેવન્યુ\s*સર્વે\s*નં.*$/gi, '')
        .replace(/સર્વે\s*નં.*$/gi, '')
        // Remove "ગામ" prefix if present
        .replace(/^ગામ\s*/gi, '')
        // Remove numbers and special characters that might confuse geocoding
        .replace(/[0-9\.\-\/]+/g, '')
        // Remove extra whitespace
        .replace(/\s+/g, ' ')
        .trim();
    
    // If cleaned name is too short, return original
    if (cleaned.length < 3) {
        return villageName;
    }
    
    return cleaned;
}

/**
 * Parse Google Maps address components into structured data
 * @param {Array} addressComponents - Address components from Google Maps API
 * @returns {Object} - Parsed address components
 */
function parseAddressComponents(addressComponents) {
    const parsed = {
        district: null,
        taluka: null,
        state: null,
        country: null
    };
    
    addressComponents.forEach(component => {
        const types = component.types;
        
        if (types.includes('administrative_area_level_2')) {
            // District level
            parsed.district = component.long_name;
        } else if (types.includes('administrative_area_level_3')) {
            // Taluka level
            parsed.taluka = component.long_name;
        } else if (types.includes('administrative_area_level_1')) {
            // State level
            parsed.state = component.long_name;
        } else if (types.includes('country')) {
            // Country level
            parsed.country = component.long_name;
        }
    });
    
    return parsed;
}

/**
 * Geocode multiple villages in batch
 * @param {Array} villages - Array of village objects with name and optional district
 * @returns {Array} - Array of geocoding results
 */
async function geocodeVillagesBatch(villages) {
    const results = [];
    
    for (const village of villages) {
        try {
            // Add delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const result = await geocodeVillage(village.name, village.district);
            results.push({
                ...village,
                geocoding: result
            });
        } catch (error) {
            console.error(`Failed to geocode ${village.name}:`, error.message);
            results.push({
                ...village,
                geocoding: {
                    success: false,
                    error: error.message,
                    status: 'error'
                }
            });
        }
    }
    
    return results;
}

/**
 * Test geocoding API connectivity
 * @returns {Promise<boolean>} - True if API is accessible
 */
async function testGeocodingAPI() {
    try {
        const result = await geocodeVillage('Rajkot', 'Rajkot', 'Gujarat, India');
        console.log('✅ Geocoding API test successful:', result.success);
        return result.success;
    } catch (error) {
        console.error('❌ Geocoding API test failed:', error.message);
        return false;
    }
}

module.exports = {
    geocodeVillage,
    geocodeVillagesBatch,
    testGeocodingAPI,
    cleanVillageNameForGeocoding,
    parseAddressComponents
}; 