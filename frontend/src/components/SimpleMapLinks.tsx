'use client';

import { useState, useEffect } from 'react';
import GoogleMapsComponent from './GoogleMapsComponent';

interface Notice {
  id: string;
  village_name?: string;
  survey_number?: string;
  buyer_name?: string;
  seller_name?: string;
  notice_date?: string;
  latitude?: number;
  longitude?: number;
  district?: string;
  taluka?: string;
}

interface VillageLocation {
  name: string;
  lat: number;
  lng: number;
  count: number;
  notices: Notice[];
  district?: string;
  taluka?: string;
}

interface SimpleMapLinksProps {
  notices: Notice[];
}

const SimpleMapLinks: React.FC<SimpleMapLinksProps> = ({ notices }) => {
  const [selectedDistrict, setSelectedDistrict] = useState<string>('all');
  const [villageLocations, setVillageLocations] = useState<VillageLocation[]>([]);
  const [dateRange, setDateRange] = useState<{
    startDate: string;
    endDate: string;
  }>({
    startDate: '',
    endDate: ''
  });
  
  // Helper function to parse date strings and handle various formats
  const parseNoticeDate = (dateStr: string | undefined): Date | null => {
    if (!dateStr) return null;
    
    try {
      // Handle ISO date strings
      if (dateStr.includes('T')) {
        return new Date(dateStr);
      }
      
      // Handle DD/MM/YYYY format
      if (dateStr.includes('/')) {
        const [day, month, year] = dateStr.split('/');
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }
      
      // Handle DD-MM-YYYY format
      if (dateStr.includes('-') && dateStr.split('-').length === 3) {
        const parts = dateStr.split('-');
        if (parts[0].length <= 2) { // DD-MM-YYYY
          const [day, month, year] = parts;
          return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        }
      }
      
      // Fallback to standard Date parsing
      return new Date(dateStr);
    } catch {
      return null;
    }
  };
  
  // Filter notices by date range
  const getFilteredNotices = () => {
    if (!dateRange.startDate || !dateRange.endDate) {
      return notices; // Return all if no date filter
    }
    
    const startDate = new Date(dateRange.startDate);
    const endDate = new Date(dateRange.endDate);
    endDate.setHours(23, 59, 59, 999); // Include the entire end date
    
    return notices.filter(notice => {
      const noticeDate = parseNoticeDate(notice.notice_date);
      if (!noticeDate) return false;
      
      return noticeDate >= startDate && noticeDate <= endDate;
    });
  };
  
  // Get filtered notices based on date range
  const filteredNotices = getFilteredNotices();
  
  // Process notices to group by village location
  useEffect(() => {
    const locationMap = new Map<string, VillageLocation>();
    
    filteredNotices.forEach(notice => {
      if (!notice.village_name) return;
      
      // Clean village name
      const cleanVillageName = notice.village_name
        .replace(/\s*રેવન્યુ\s*સર્વે\s*નં.*$/gi, '')
        .replace(/\s*સર્વે\s*નં.*$/gi, '')
        .trim();
      
      if (!cleanVillageName) return;
      
      // Only use real coordinates from the database
      let lat = notice.latitude;
      let lng = notice.longitude;
      
      // Convert string coordinates to numbers if needed
      if (typeof lat === 'string') lat = parseFloat(lat);
      if (typeof lng === 'string') lng = parseFloat(lng);
      
      // Skip villages without valid coordinates - no fallback/mock coordinates
      if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
        return; // Don't add to map if no valid coordinates
      }
      
      const key = `${cleanVillageName}_${lat}_${lng}`;
      
      if (locationMap.has(key)) {
        const existing = locationMap.get(key)!;
        existing.count++;
        existing.notices.push(notice);
      } else {
        locationMap.set(key, {
          name: cleanVillageName,
          lat: lat as number,
          lng: lng as number,
          count: 1,
          notices: [notice],
          district: notice.district || 'Unknown',
          taluka: notice.taluka
        });
      }
    });
    
    setVillageLocations(Array.from(locationMap.values()));
  }, [filteredNotices]);
  
  // Filter locations by district
  const filteredLocations = selectedDistrict === 'all' 
    ? villageLocations 
    : villageLocations.filter(loc => loc.district === selectedDistrict);
  
  // Get unique districts
  const districts = [...new Set(villageLocations.map(loc => loc.district))].filter(Boolean);
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">🗺️ Property Locations Map</h2>
        <p className="text-gray-600">Interactive map showing all village locations with property counts</p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{filteredNotices.length}</div>
          <div className="text-sm text-gray-600">Total Properties</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{villageLocations.length}</div>
          <div className="text-sm text-gray-600">Village Locations</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-purple-600">{districts.length}</div>
          <div className="text-sm text-gray-600">Districts</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-orange-600">
            {villageLocations.filter(loc => loc.lat && loc.lng).length}
          </div>
          <div className="text-sm text-gray-600">With Coordinates</div>
        </div>
      </div>

      {/* District Filter */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">Filter by District:</label>
          <select 
            value={selectedDistrict} 
            onChange={(e) => setSelectedDistrict(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Districts ({villageLocations.length} villages)</option>
            {districts.map(district => (
              <option key={district} value={district}>
                {district} ({villageLocations.filter(loc => loc.district === district).length} villages)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">📅 Filter by Notice Date:</span>
            <span className="text-xs text-gray-500">
              ({filteredNotices.length} of {notices.length} notices in selected range)
            </span>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 min-w-0">From:</label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange(prev => ({...prev, startDate: e.target.value}))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 min-w-0">To:</label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange(prev => ({...prev, endDate: e.target.value}))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            
            <button
              onClick={() => setDateRange({startDate: '', endDate: ''})}
              className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 text-sm transition-colors"
              title="Clear date filter"
            >
              🗑️ Clear
            </button>
            
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const today = new Date();
                  const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                  setDateRange({
                    startDate: lastWeek.toISOString().split('T')[0],
                    endDate: today.toISOString().split('T')[0]
                  });
                }}
                className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200 transition-colors"
              >
                Last 7 days
              </button>
              
              <button
                onClick={() => {
                  const today = new Date();
                  const lastMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
                  setDateRange({
                    startDate: lastMonth.toISOString().split('T')[0],
                    endDate: today.toISOString().split('T')[0]
                  });
                }}
                className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200 transition-colors"
              >
                Last 30 days
              </button>
              
              <button
                onClick={() => {
                  const today = new Date();
                  const startOfYear = new Date(today.getFullYear(), 0, 1);
                  setDateRange({
                    startDate: startOfYear.toISOString().split('T')[0],
                    endDate: today.toISOString().split('T')[0]
                  });
                }}
                className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs hover:bg-purple-200 transition-colors"
              >
                This year
              </button>
            </div>
          </div>
          
          {dateRange.startDate && dateRange.endDate && (
            <div className="text-sm text-blue-600 bg-blue-50 p-2 rounded-lg">
              📊 Showing notices from <strong>{new Date(dateRange.startDate).toLocaleDateString()}</strong> to <strong>{new Date(dateRange.endDate).toLocaleDateString()}</strong>
              {filteredNotices.length === 0 && (
                <span className="text-orange-600 ml-2">⚠️ No notices found in this date range</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Interactive Google Maps with Village Markers */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">🗺️ Interactive Village Locations Map</h3>
          <p className="text-sm text-gray-600">
            Showing {filteredLocations.length} villages with precise markers and detailed information
            {selectedDistrict !== 'all' ? ` in ${selectedDistrict} district` : ''}
            {dateRange.startDate && dateRange.endDate 
              ? ` with notices from ${new Date(dateRange.startDate).toLocaleDateString()} to ${new Date(dateRange.endDate).toLocaleDateString()}`
              : ''
            }
          </p>
          {filteredNotices.length !== notices.length && (
            <p className="text-xs text-blue-600 mt-1">
              📊 Filtered: {filteredNotices.length} of {notices.length} total notices
            </p>
          )}
        </div>
        
        <div className="p-4">
          <div className="relative">
            {filteredLocations.length > 0 ? (
              <GoogleMapsComponent 
                villages={filteredLocations} 
                height="500px" 
                zoom={10}
              />
            ) : (
              <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
                <div className="text-center">
                  <div className="text-gray-400 text-4xl mb-2">🗺️</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-1">No Location Data Available</h3>
                  <p className="text-gray-600">No villages have valid coordinate data to display on the map.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detailed Coordinates Table */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">📋 Complete Coordinates List</h3>
          <p className="text-sm text-gray-600">All village coordinates with detailed information</p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Village Name</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Latitude</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Longitude</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">District</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Properties</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Notice Dates</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredLocations.map((location, index) => {
                // Get date range for this village's notices
                const noticeDates = location.notices
                  .map(notice => parseNoticeDate(notice.notice_date))
                  .filter(date => date !== null)
                  .sort((a, b) => a!.getTime() - b!.getTime());
                
                const dateRangeText = noticeDates.length > 0 
                  ? noticeDates.length === 1 
                    ? noticeDates[0]!.toLocaleDateString()
                    : `${noticeDates[0]!.toLocaleDateString()} - ${noticeDates[noticeDates.length - 1]!.toLocaleDateString()}`
                  : 'No dates';
                
                return (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      📍 {location.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 font-mono">{location.lat.toFixed(6)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 font-mono">{location.lng.toFixed(6)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{location.district || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                        {location.count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                        {dateRangeText}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex gap-1">
                        <a 
                          href={`https://www.google.com/maps/@${location.lat},${location.lng},15z`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                          title="View on Google Maps"
                        >
                          🗺️ Map
                        </a>
                        <button 
                          onClick={() => navigator.clipboard.writeText(`${location.lat}, ${location.lng}`)}
                          className="px-2 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700"
                          title="Copy coordinates"
                        >
                          📋 Copy
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Village Locations Cards */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">📍 Village Location Cards</h3>
          <p className="text-sm text-gray-600">Detailed property information for each village</p>
        </div>
        
        <div className="p-4">
          {filteredLocations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No villages found for the selected district.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredLocations.map((location, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-gray-900">
                      📍 {location.name}
                    </h4>
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                      {location.count} {location.count === 1 ? 'property' : 'properties'}
                    </span>
                  </div>
                  
                  <div className="text-sm text-gray-600 mb-3 bg-gray-50 rounded-lg p-3">
                    <div className="font-mono text-xs text-center mb-2">
                      📍 Coordinates
                    </div>
                    <div className="font-mono text-center">
                      <div>Lat: {location.lat.toFixed(6)}</div>
                      <div>Lng: {location.lng.toFixed(6)}</div>
                    </div>
                    {location.district && <p className="mt-2">🏛️ {location.district}</p>}
                    {location.taluka && <p>🏘️ {location.taluka}</p>}
                  </div>
                  
                  <div className="flex gap-2 mb-3">
                    <a 
                      href={`https://www.google.com/maps/@${location.lat},${location.lng},15z`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors text-center"
                    >
                      🗺️ View on Map
                    </a>
                    <a 
                      href={`https://www.google.com/maps/dir//${location.lat},${location.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors text-center"
                    >
                      🧭 Directions
                    </a>
                  </div>
                  
                  {/* Property details for this village */}
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-500 mb-1">Properties in this village:</p>
                    <div className="space-y-1">
                      {location.notices.slice(0, 2).map((notice, noticeIndex) => (
                        <div key={noticeIndex} className="text-xs text-gray-600">
                          Survey #{notice.survey_number || 'N/A'} - {notice.buyer_name || 'Unknown Buyer'}
                        </div>
                      ))}
                      {location.notices.length > 2 && (
                        <div className="text-xs text-gray-500">
                          +{location.notices.length - 2} more properties
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SimpleMapLinks; 