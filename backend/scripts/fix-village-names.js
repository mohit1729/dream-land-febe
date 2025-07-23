#!/usr/bin/env node

/**
 * Script to fix village names in Firebase database
 * Removes extra text like "ના રેવન્યુ સર્વે નં" from village names
 */

require('dotenv').config();
const { getPropertyNotices, updatePropertyNotice } = require('../services/firebaseService');

/**
 * Clean village name by removing unwanted suffixes and prefixes
 * @param {string} villageName - Original village name
 * @returns {string} - Cleaned village name
 */
function cleanVillageName(villageName) {
    if (!villageName || typeof villageName !== 'string') {
        return villageName;
    }
    
    return villageName
        // Remove revenue survey references
        .replace(/\s*રેવન્યુ\s*સર્વે\s*નં.*$/gi, '')
        .replace(/\s*સર્વે\s*નં.*$/gi, '')
        
        // Remove common prefixes
        .replace(/^ગામ\s*/gi, '')
        .replace(/^મોજે\s*ગામ\s*/gi, '')
        
        // Remove common suffixes
        .replace(/ના$/gi, '')
        .replace(/ની$/gi, '')
        .replace(/નું$/gi, '')
        
        // Clean up whitespace
        .trim()
        
        // Remove extra spaces
        .replace(/\s+/g, ' ');
}

async function fixVillageNames() {
    try {
        console.log('🔧 Starting to fix village names in Firebase database...');
        
        // Get all notices with village names
        const notices = await getPropertyNotices({ limit: 10000 });
        const noticesWithVillages = notices.filter(notice => notice.village_name);
        
        console.log(`Found ${noticesWithVillages.length} notices with village names`);
        
        let fixedCount = 0;
        let skippedCount = 0;
        
        for (const notice of noticesWithVillages) {
            const originalName = notice.village_name;
            const cleanedName = cleanVillageName(originalName);
            
            if (originalName !== cleanedName && cleanedName.length > 0) {
                console.log(`\n🔧 Fixing: "${originalName}" → "${cleanedName}"`);
                
                // Update the village name in Firebase
                await updatePropertyNotice(notice.id, {
                    village_name: cleanedName
                });
                
                fixedCount++;
            } else {
                console.log(`✅ Already clean: "${originalName}"`);
                skippedCount++;
            }
        }
        
        console.log(`\n🎉 Village name fixing completed!`);
        console.log(`📊 Results: ${fixedCount} fixed, ${skippedCount} already clean`);
        
    } catch (error) {
        console.error('❌ Error fixing village names:', error);
        throw error;
    }
}

// Run the script if called directly
if (require.main === module) {
    fixVillageNames()
        .then(() => {
            console.log('✅ Script completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Script failed:', error);
            process.exit(1);
        });
}

module.exports = { fixVillageNames, cleanVillageName }; 