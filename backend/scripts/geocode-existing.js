/**
 * Script to retroactively geocode existing property notices
 * Usage: node scripts/geocode-existing.js
 */

require('dotenv').config();
const { getPropertyNotices, updatePropertyNoticeLocation } = require('../services/firebaseService');
const { geocodeVillage } = require('../services/geocodingService');

async function geocodeExistingNotices() {
    try {
        console.log('🌍 Starting retroactive geocoding of existing notices...');
        
        // Get all notices
        const notices = await getPropertyNotices();
        console.log(`Found ${notices.length} total notices`);
        
        // Filter notices that need geocoding (no latitude/longitude)
        const needsGeocoding = notices.filter(notice => 
            !notice.latitude && !notice.longitude && notice.village_name
        );
        
        console.log(`Found ${needsGeocoding.length} notices needing geocoding`);
        
        if (needsGeocoding.length === 0) {
            console.log('✅ All notices already have location data!');
            return;
        }
        
        let successCount = 0;
        let failureCount = 0;
        
        // Process each notice
        for (const notice of needsGeocoding) {
            try {
                console.log(`\n🌍 Processing: ${notice.village_name}`);
                
                // Clean village name for geocoding
                let villageName = notice.village_name
                    .replace(/\s*રેવન્યુ\s*સર્વે\s*નં.*$/gi, '')
                    .replace(/\s*સર્વે\s*નં.*$/gi, '')
                    .replace(/^ગામ\s*/gi, '')
                    .replace(/ના$/, '')
                    .trim();
                
                if (villageName.length < 2) {
                    console.log(`❌ Skipping - village name too short after cleaning: "${villageName}"`);
                    failureCount++;
                    continue;
                }
                
                console.log(`📍 Geocoding cleaned name: "${villageName}"`);
                
                const locationData = await geocodeVillage(villageName, notice.district || 'Rajkot');
                
                if (locationData.success) {
                    // Update the notice with location data
                    await updatePropertyNoticeLocation(notice.id, {
                        latitude: locationData.latitude,
                        longitude: locationData.longitude,
                        district: locationData.district || notice.district,
                        taluka: locationData.taluka || notice.taluka,
                        formatted_address: locationData.formatted_address,
                        status: 'success'
                    });
                    
                    successCount++;
                    console.log(`✅ Success: ${villageName} -> ${locationData.latitude}, ${locationData.longitude}`);
                } else {
                    failureCount++;
                    console.log(`❌ Failed: ${villageName} - ${locationData.error}`);
                    
                    // Update with failure status
                    await updatePropertyNoticeLocation(notice.id, {
                        status: 'failed',
                        error: locationData.error
                    });
                }
                
                // Add delay to respect rate limits
                await new Promise(resolve => setTimeout(resolve, 300));
                
            } catch (error) {
                console.error(`❌ Error processing ${notice.village_name}:`, error.message);
                failureCount++;
            }
        }
        
        console.log(`\n🎉 Retroactive geocoding completed!`);
        console.log(`📊 Results: ${successCount} success, ${failureCount} failures`);
        console.log(`📍 ${successCount} notices now have location data`);
        
    } catch (error) {
        console.error('❌ Script failed:', error);
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    geocodeExistingNotices()
        .then(() => {
            console.log('✅ Script completed successfully');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Script failed:', error);
            process.exit(1);
        });
}

module.exports = { geocodeExistingNotices }; 