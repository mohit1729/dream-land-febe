#!/usr/bin/env node

/**
 * Test Script for Data Refinement Functionality
 * Tests the new Gemini-powered data refinement layer
 */

// Load environment variables
require('dotenv').config();

const { refineExtractedDataWithGemini, getPerfectCoordinatesWithGemini } = require('../services/geminiService');

// Sample extracted data for testing
const sampleExtractedData = {
    village_name: 'રીબડા ગામ રેવન્યુ સર્વે નં 123',
    survey_number: 'સર્વે નં 45/2',
    notice_date: '15-03-2024',
    buyer_name: 'રમેશ પટેલ',
    seller_name: 'સુરેશ શાહ',
    district: 'રાજકોટ',
    latitude: null,
    longitude: null
};

const sampleRawText = `
ગુજરાત સરકાર
મહેસુલ વિભાગ
જિલ્લા : રાજકોટ
તાલુકો : રાજકોટ
ગામ : રીબડા
રેવન્યુ સર્વે નંબર : 45/2
ખરીદનાર : રમેશ પટેલ
વેચનાર : સુરેશ શાહ
તારીખ : 15/03/2024
`;

async function testRefinementLayer() {
    console.log('🧪 Testing Data Refinement Layer\n');
    console.log('📋 Original Data:');
    console.log(JSON.stringify(sampleExtractedData, null, 2));
    console.log('\n📝 Original OCR Text:');
    console.log(sampleRawText);
    console.log('\n' + '='.repeat(50));
    
    try {
        // Test 1: Data Refinement
        console.log('\n🔍 Test 1: Refining extracted data...');
        const refinedData = await refineExtractedDataWithGemini(sampleExtractedData, sampleRawText);
        
        console.log('\n✨ Refined Data:');
        console.log(JSON.stringify(refinedData, null, 2));
        
        console.log('\n📊 Refinement Summary:');
        console.log(`- Village Name: "${sampleExtractedData.village_name}" → "${refinedData.village_name}"`);
        console.log(`- Survey Number: "${sampleExtractedData.survey_number}" → "${refinedData.survey_number}"`);
        console.log(`- Notice Date: "${sampleExtractedData.notice_date}" → "${refinedData.notice_date}"`);
        console.log(`- Refinement Applied: ${refinedData.refinement_applied ? 'YES' : 'NO'}`);
        console.log(`- Refinement Confidence: ${refinedData.refinement_confidence || 'N/A'}`);
        
        // Test 2: Perfect Coordinates
        if (refinedData.village_name && refinedData.village_name.length >= 2) {
            console.log('\n🎯 Test 2: Getting perfect coordinates...');
            const perfectCoordinates = await getPerfectCoordinatesWithGemini(
                refinedData.village_name,
                refinedData.district || sampleExtractedData.district,
                sampleRawText
            );
            
            console.log('\n📍 Coordinate Results:');
            if (perfectCoordinates.success) {
                console.log(`✅ Success! Coordinates: ${perfectCoordinates.latitude}, ${perfectCoordinates.longitude}`);
                console.log(`📍 Source: ${perfectCoordinates.coordinate_source}`);
                console.log(`🎯 Confidence: ${perfectCoordinates.confidence_score}`);
                console.log(`📍 Address: ${perfectCoordinates.formatted_address}`);
                
                if (perfectCoordinates.coordinate_distance_km) {
                    console.log(`📏 Distance between sources: ${perfectCoordinates.coordinate_distance_km}km`);
                }
            } else {
                console.log(`❌ Failed: ${perfectCoordinates.error}`);
            }
        }
        
        console.log('\n' + '='.repeat(50));
        console.log('🎊 Test completed successfully!');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Test with different village names
async function testMultipleVillages() {
    console.log('\n🧪 Testing Multiple Village Refinements\n');
    
    const testCases = [
        {
            name: 'Gujarati with survey suffix',
            data: { village_name: 'ઢાંઢણી ગામ સર્વે નં 23', survey_number: '23/1', notice_date: '10/02/2024' }
        },
        {
            name: 'Mixed language',
            data: { village_name: 'Ribada Village Survey No 45', survey_number: 'Survey 45/2', notice_date: '15-03-2024' }
        },
        {
            name: 'With prefixes',
            data: { village_name: 'મોજે ગામ જાળીયા ના', survey_number: 'રેવન્યુ સર્વે 67', notice_date: '20/01/2024' }
        }
    ];
    
    for (const testCase of testCases) {
        console.log(`\n📋 Testing: ${testCase.name}`);
        console.log(`Original: ${testCase.data.village_name}`);
        
        try {
            const refined = await refineExtractedDataWithGemini(testCase.data, `ગામ: ${testCase.data.village_name}`);
            console.log(`Refined: ${refined.village_name}`);
            console.log(`Survey: ${refined.survey_number}`);
            console.log(`Date: ${refined.notice_date}`);
            
            if (refined.refinement_applied) {
                console.log(`✅ Improvements made (${refined.refinement_confidence})`);
            } else {
                console.log(`⚠️ No refinement applied`);
            }
            
        } catch (error) {
            console.error(`❌ Error: ${error.message}`);
        }
    }
}

// Main execution
async function main() {
    console.log('🚀 Starting Data Refinement Tests...\n');
    
    await testRefinementLayer();
    await testMultipleVillages();
    
    console.log('\n✅ All tests completed!');
    process.exit(0);
}

// Run tests if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('\n💥 Test script failed:', error);
        process.exit(1);
    });
}

module.exports = {
    testRefinementLayer,
    testMultipleVillages
}; 