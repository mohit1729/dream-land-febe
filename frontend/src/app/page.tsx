'use client';

import { useState, useEffect } from 'react';
import UploadSection from '@/components/UploadSection';
import DashboardSection from '@/components/DashboardSection';
import StatsSection from '@/components/StatsSection';
import SimpleMapLinks from '@/components/SimpleMapLinks';
import { Upload, BarChart3, Database, Settings, MapPin } from 'lucide-react';

interface Notice {
  id: string;
  village_name?: string;
  survey_number?: string;
  buyer_name?: string;
  seller_name?: string;
  notice_date?: string;
  advocate_name?: string;
  advocate_address?: string;
  advocate_mobile?: string;
  confidence_score?: number;
  uploaded_at: string;
  latitude?: number;
  longitude?: number;
  district?: string;
  taluka?: string;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState('upload');
  const [stats, setStats] = useState({
    totalNotices: 0,
    uniqueVillages: 0,
    avgConfidence: 0,
    recentScans: 0
  });

  const [notices, setNotices] = useState<Notice[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [loading, setLoading] = useState(false);

  // Load initial data
  useEffect(() => {
    loadNotices();
  }, [refreshTrigger]);

  const loadNotices = async () => {
    try {
      setLoading(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/api/notices`);
      const data = await response.json();
      
      if (data.success && data.notices) {
        setNotices(data.notices);
        calculateStats(data.notices);
      }
    } catch (error) {
      console.error('Error loading notices:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (noticesData: Notice[]) => {
    const total = noticesData.length;
    const uniqueVillages = new Set(
      noticesData
        .map(notice => notice.village_name)
        .filter(village => village && village.trim() !== '')
    ).size;

    const confidenceScores = noticesData
      .map(notice => notice.confidence_score)
      .filter((score): score is number => typeof score === 'number' && !isNaN(score));
    
    const avgConfidence = confidenceScores.length > 0 ? 
      (confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length) : 0;

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const recentScans = noticesData.filter(notice => {
      const uploadDate = new Date(notice.uploaded_at);
      return uploadDate >= oneWeekAgo;
    }).length;

    setStats({
      totalNotices: total,
      uniqueVillages,
      avgConfidence: Math.round(avgConfidence * 100),
      recentScans
    });
  };

  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const tabs = [
    { id: 'upload', label: 'Upload Notice', icon: Upload, color: 'bg-blue-500' },
    { id: 'dashboard', label: 'All Notices', icon: Database, color: 'bg-green-500' },
    { id: 'map', label: 'Property Map', icon: MapPin, color: 'bg-orange-500' },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, color: 'bg-purple-500' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-2 rounded-xl">
                <Settings className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Property Notice System</h1>
                <p className="text-sm text-gray-600 hidden sm:block">AI-Powered Gujarati OCR Dashboard</p>
              </div>
            </div>
            
            {/* Stats Summary */}
            <div className="hidden md:flex items-center space-x-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.totalNotices}</div>
                <div className="text-xs text-gray-500">Total</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.uniqueVillages}</div>
                <div className="text-xs text-gray-500">Villages</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{stats.avgConfidence}%</div>
                <div className="text-xs text-gray-500">Accuracy</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Stats */}
      <div className="md:hidden bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-lg font-bold text-blue-600">{stats.totalNotices}</div>
              <div className="text-xs text-gray-500">Total Notices</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-green-600">{stats.uniqueVillages}</div>
              <div className="text-xs text-gray-500">Villages</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-purple-600">{stats.avgConfidence}%</div>
              <div className="text-xs text-gray-500">Accuracy</div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1 sm:space-x-4 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-3 sm:px-6 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 bg-blue-50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:block">{tab.label}</span>
                  <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'upload' && (
          <UploadSection onNoticeUploaded={triggerRefresh} />
        )}
        
        {activeTab === 'dashboard' && (
          <DashboardSection notices={notices} onNoticesChange={triggerRefresh} />
        )}
        
        {activeTab === 'map' && (
          <SimpleMapLinks notices={notices} />
        )}
        
        {activeTab === 'analytics' && (
          <StatsSection notices={notices} stats={stats} />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-sm text-gray-500">
              © 2024 Property Notice System. AI-Powered OCR Solution.
            </div>
            <div className="mt-2 md:mt-0 text-sm text-gray-400">
              Built with Next.js, React & Tailwind CSS
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
