'use client';

import { useState, useMemo } from 'react';
import { Search, Filter, Eye, Edit, Trash2, ChevronLeft, ChevronRight, MoreVertical, Download } from 'lucide-react';

interface Notice {
  id: string;
  village_name?: string;
  survey_number?: string;
  buyer_name?: string;
  seller_name?: string;
  notice_date?: string;
  district?: string;
  uploaded_at: string;
}

interface DashboardSectionProps {
  notices: Notice[];
  onNoticesChange: () => void;
}

export default function DashboardSection({ notices, onNoticesChange }: DashboardSectionProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof Notice>('notice_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    village: '',
    survey: '',
    buyer: '',
    seller: '',
    dateFrom: '',
    dateTo: ''
  });

  // Filter and sort notices
  const filteredNotices = useMemo(() => {
    const filtered = notices.filter(notice => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        notice.village_name?.toLowerCase().includes(searchLower) ||
        notice.survey_number?.toLowerCase().includes(searchLower) ||
        notice.buyer_name?.toLowerCase().includes(searchLower) ||
        notice.seller_name?.toLowerCase().includes(searchLower);

      const matchesFilters = 
        (!filters.village || notice.village_name?.toLowerCase().includes(filters.village.toLowerCase())) &&
        (!filters.survey || notice.survey_number?.toLowerCase().includes(filters.survey.toLowerCase())) &&
        (!filters.buyer || notice.buyer_name?.toLowerCase().includes(filters.buyer.toLowerCase())) &&
        (!filters.seller || notice.seller_name?.toLowerCase().includes(filters.seller.toLowerCase()));

      return matchesSearch && matchesFilters;
    });

    // Sort
    filtered.sort((a, b) => {
      const aVal = a[sortField] || '';
      const bVal = b[sortField] || '';
      
      if (sortField === 'uploaded_at' || sortField === 'notice_date') {
        const aDate = new Date(aVal as string);
        const bDate = new Date(bVal as string);
        return sortDirection === 'asc' ? aDate.getTime() - bDate.getTime() : bDate.getTime() - aDate.getTime();
      }
      
      const aStr = aVal.toString().toLowerCase();
      const bStr = bVal.toString().toLowerCase();
      return sortDirection === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });

    return filtered;
  }, [notices, searchTerm, sortField, sortDirection, filters]);

  // Pagination
  const totalPages = Math.ceil(filteredNotices.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedNotices = filteredNotices.slice(startIndex, startIndex + pageSize);

  const handleSort = (field: keyof Notice) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const deleteNotice = async (id: string) => {
    if (!confirm('Are you sure you want to delete this property notice?')) return;
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/api/notices/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete notice');
      }

      onNoticesChange();
    } catch (error) {
      console.error('Error deleting notice:', error);
      alert('Failed to delete notice');
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN');
  };

  const exportData = () => {
    const csvContent = [
      ['Village', 'Survey No.', 'Buyer', 'Seller', 'Property Listing Date', 'District', 'Scanned Date'],
      ...filteredNotices.map(notice => [
        notice.village_name || '',
        notice.survey_number || '',
        notice.buyer_name || '',
        notice.seller_name || '',
        notice.notice_date || '',
        notice.district || '',
        formatDate(notice.uploaded_at)
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `property_notices_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (notices.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <div className="text-gray-400 mb-4">
            <Search className="h-16 w-16 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Property Notices Found</h3>
          <p className="text-gray-500 mb-4">Upload your first property notice to get started.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search villages, survey numbers, buyers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Controls */}
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">Filters</span>
            </button>
            <button
              onClick={exportData}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export</span>
            </button>
          </div>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4">
              <input
                type="text"
                placeholder="Village name"
                value={filters.village}
                onChange={(e) => setFilters(prev => ({ ...prev, village: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="text"
                placeholder="Survey number"
                value={filters.survey}
                onChange={(e) => setFilters(prev => ({ ...prev, survey: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="text"
                placeholder="Buyer name"
                value={filters.buyer}
                onChange={(e) => setFilters(prev => ({ ...prev, buyer: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="text"
                placeholder="Seller name"
                value={filters.seller}
                onChange={(e) => setFilters(prev => ({ ...prev, seller: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="date"
                placeholder="From date"
                value={filters.dateFrom}
                onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="date"
                placeholder="To date"
                value={filters.dateTo}
                onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Results Summary */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600">
          Showing {startIndex + 1} to {Math.min(startIndex + pageSize, filteredNotices.length)} of {filteredNotices.length} notices
        </p>
        <select
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setCurrentPage(1);
          }}
          className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value={10}>10 per page</option>
          <option value={25}>25 per page</option>
          <option value={50}>50 per page</option>
          <option value={100}>100 per page</option>
        </select>
      </div>

      {/* Desktop Table */}
      <div className="hidden lg:block bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {[
                  { key: 'village_name', label: 'Village Name', width: 'w-32' },
                  { key: 'survey_number', label: 'Survey No.', width: 'w-24' },
                  { key: 'buyer_name', label: 'Buyer Name', width: 'w-40' },
                  { key: 'seller_name', label: 'Seller Name', width: 'w-40' },
                  { key: 'notice_date', label: 'Listing Date', width: 'w-28' },
                  { key: 'district', label: 'District', width: 'w-24' },
                  { key: 'uploaded_at', label: 'Scanned', width: 'w-24' },
                ].map((column) => (
                  <th
                    key={column.key}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort(column.key as keyof Notice)}
                  >
                    <div className="flex items-center space-x-1">
                      <span>{column.label}</span>
                      {sortField === column.key && (
                        <span className="text-blue-600">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedNotices.map((notice) => (
                <tr key={notice.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm font-medium text-blue-600">
                      {notice.village_name || '-'}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {notice.survey_number ? (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded font-mono">
                        {notice.survey_number}
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900 max-w-32 truncate" title={notice.buyer_name}>
                      {notice.buyer_name || '-'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900 max-w-32 truncate" title={notice.seller_name}>
                      {notice.seller_name || '-'}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                    {notice.notice_date ? (
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded font-medium">
                        📅 {formatDate(notice.notice_date)}
                      </span>
                    ) : (
                      <span className="text-gray-400 italic">No date</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {notice.district || '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-400">
                    {formatDate(notice.uploaded_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setSelectedNotice(notice)}
                        className="text-blue-600 hover:text-blue-800 transition-colors"
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteNotice(notice.id)}
                        className="text-red-600 hover:text-red-800 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden space-y-4">
        {paginatedNotices.map((notice) => (
          <div key={notice.id} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-medium text-blue-600 text-lg">{notice.village_name || 'Unknown Village'}</h3>
                <div className="flex flex-wrap gap-2 mt-2">
                  {notice.survey_number && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded font-mono">
                      Survey: {notice.survey_number}
                    </span>
                  )}
                  {notice.notice_date && (
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded font-medium">
                      📅 {formatDate(notice.notice_date)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setSelectedNotice(notice)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Eye className="h-4 w-4" />
                </button>
                <button
                  onClick={() => deleteNotice(notice.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500 font-medium">Buyer:</span>
                <div className="font-medium truncate text-gray-900" title={notice.buyer_name}>
                  {notice.buyer_name || '-'}
                </div>
              </div>
              <div>
                <span className="text-gray-500 font-medium">Seller:</span>
                <div className="font-medium truncate text-gray-900" title={notice.seller_name}>
                  {notice.seller_name || '-'}
                </div>
              </div>
              <div>
                <span className="text-gray-500 font-medium">Scanned:</span>
                <div className="text-gray-600 text-sm">{formatDate(notice.uploaded_at)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center space-x-2">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          
          <div className="flex space-x-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const page = i + 1;
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-2 rounded-lg transition-colors ${
                    currentPage === page
                      ? 'bg-blue-600 text-white'
                      : 'border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Detail Modal */}
      {selectedNotice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Property Notice Details</h2>
                <button
                  onClick={() => setSelectedNotice(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  ×
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  { key: 'village_name', label: 'Village Name (ગામનું નામ)' },
                  { key: 'survey_number', label: 'Survey Number (સર્વે નં.)' },
                  { key: 'buyer_name', label: 'Buyer Name (ખરીદનાર)' },
                  { key: 'seller_name', label: 'Seller Name (વેચનાર)' },
                  { key: 'notice_date', label: 'Notice Date (તારીખ)' },
                  { key: 'district', label: 'District' },
                ].map((field) => (
                  <div key={field.key}>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {field.label}
                    </label>
                    <div className="p-3 bg-gray-50 rounded-lg border">
                      {selectedNotice[field.key as keyof Notice] || 
                       <span className="text-gray-400 italic">Not available</span>}
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-600">
                    Uploaded: {formatDate(selectedNotice.uploaded_at)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 