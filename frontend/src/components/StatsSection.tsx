'use client';

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, LineChart, Line, ResponsiveContainer } from 'recharts';
import { TrendingUp, MapPin, Calendar, Home } from 'lucide-react';

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

interface StatsData {
  totalNotices: number;
  uniqueVillages: number;
  recentScans: number;
}

interface StatsSectionProps {
  notices: Notice[];
  stats: StatsData;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

export default function StatsSection({ notices, stats }: StatsSectionProps) {
  const analytics = useMemo(() => {
    // Village distribution
    const villageCount: Record<string, number> = {};
    notices.forEach(notice => {
      if (notice.village_name) {
        villageCount[notice.village_name] = (villageCount[notice.village_name] || 0) + 1;
      }
    });
    
    const villageData = Object.entries(villageCount)
      .map(([village, count]) => ({ village, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Trending villages (most active in property sales)
    const trendingVillages = Object.entries(villageCount)
      .map(([village, count]) => ({ village, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8); // Top 8 trending villages

    // District distribution
    const districtCount: Record<string, number> = {};
    notices.forEach(notice => {
      if (notice.district) {
        districtCount[notice.district] = (districtCount[notice.district] || 0) + 1;
      }
    });

    const districtData = Object.entries(districtCount)
      .map(([district, count]) => ({ district, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    // Monthly uploads
    const monthlyData: Record<string, number> = {};
    notices.forEach(notice => {
      const date = new Date(notice.uploaded_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlyData[monthKey] = (monthlyData[monthKey] || 0) + 1;
    });

    const monthlyUploads = Object.entries(monthlyData)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6); // Last 6 months

    // Recent activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentActivity = notices
      .filter(notice => new Date(notice.uploaded_at) >= thirtyDaysAgo)
      .reduce((acc, notice) => {
        const date = notice.uploaded_at.split('T')[0];
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    const activityData = Object.entries(recentActivity)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      villageData,
      monthlyUploads,
      trendingVillages,
      districtData,
      activityData
    };
  }, [notices]);

  const StatCard = ({ icon: Icon, title, value, subtitle, color }: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    value: string | number;
    subtitle: string;
    color: string;
  }) => (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center">
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        <div className="ml-4">
          <h3 className="text-sm font-medium text-gray-500">{title}</h3>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-600">{subtitle}</p>
        </div>
      </div>
    </div>
  );

  if (notices.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <div className="text-gray-400 mb-4">
            <BarChart className="h-16 w-16 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Analytics Data</h3>
          <p className="text-gray-500">Upload some property notices to see analytics and insights.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={TrendingUp}
          title="Total Notices"
          value={stats.totalNotices}
          subtitle="Property notices processed"
          color="bg-blue-500"
        />
        <StatCard
          icon={MapPin}
          title="Unique Villages"
          value={stats.uniqueVillages}
          subtitle="Different locations"
          color="bg-green-500"
        />
        <StatCard
          icon={Home}
          title="This Week"
          value={stats.recentScans}
          subtitle="Recent uploads"
          color="bg-orange-500"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Village Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-6">Top Villages by Notice Count</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.villageData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="village" 
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  fontSize={12}
                />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* District Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-6">District Distribution</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.districtData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="district" 
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  fontSize={12}
                />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly Uploads */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-6">Monthly Upload Trends</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics.monthlyUploads}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#10B981" 
                  strokeWidth={3}
                  dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-6">Recent Activity (Last 30 Days)</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics.activityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  fontSize={10}
                />
                <YAxis />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#F59E0B" 
                  strokeWidth={2}
                  dot={{ fill: '#F59E0B', strokeWidth: 2, r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Villages */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-6">Top Villages by Notice Count</h3>
        <div className="space-y-4">
          {analytics.trendingVillages.map((village, index) => (
            <div key={village.village} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-medium text-sm`}
                       style={{ backgroundColor: COLORS[index % COLORS.length] }}>
                    {index + 1}
                  </div>
                </div>
                <div>
                  <p className="font-medium text-gray-900">{village.village}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-gray-900">{village.count}</p>
                <p className="text-sm text-gray-500">notices</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary Insights */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Key Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 mb-2">
              {analytics.villageData[0]?.village || 'N/A'}
            </div>
            <div className="text-sm text-gray-600">Most Active Village</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600 mb-2">
              {analytics.trendingVillages[0]?.village || 'N/A'}
            </div>
            <div className="text-sm text-gray-600">Top Trending Village</div>
          </div>
        </div>
      </div>
    </div>
  );
} 