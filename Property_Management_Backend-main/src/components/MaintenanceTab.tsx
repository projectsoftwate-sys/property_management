import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, AlertCircle, Flame, Zap, Droplet, Wind } from 'lucide-react';

interface MaintenanceIssue {
  id: string;
  title: string;
  description: string;
  category: 'fire' | 'electrical' | 'gas' | 'water' | 'general';
  status: 'open' | 'assigned' | 'in_progress' | 'completed';
  property: { name: string };
  creator: { full_name: string };
  assignee?: { full_name: string };
  created_at: string;
}

const categoryIcons = {
  fire: Flame,
  electrical: Zap,
  gas: Wind,
  water: Droplet,
  general: AlertCircle,
};

const categoryColors = {
  fire: 'bg-red-100 text-red-700',
  electrical: 'bg-yellow-100 text-yellow-700',
  gas: 'bg-orange-100 text-orange-700',
  water: 'bg-blue-100 text-blue-700',
  general: 'bg-slate-100 text-slate-700',
};

const statusColors = {
  open: 'bg-slate-100 text-slate-700',
  assigned: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  completed: 'bg-green-100 text-green-700',
};

export default function MaintenanceTab() {
  const [issues, setIssues] = useState<MaintenanceIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchIssues();
  }, [statusFilter]);

  const fetchIssues = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      let url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/maintenance-issues`;
      if (statusFilter !== 'all') {
        url += `?status=${statusFilter}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      if (result.data) {
        setIssues(result.data);
      }
    } catch (error) {
      console.error('Error fetching issues:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return <div className="text-center py-8 text-slate-600">Loading maintenance issues...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-slate-900">Maintenance Issues</h2>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" />
          New Issue
        </button>
      </div>

      <div className="flex gap-2 mb-6">
        {['all', 'open', 'assigned', 'in_progress', 'completed'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === status
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
            }`}
          >
            {status.replace('_', ' ').charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
          </button>
        ))}
      </div>

      {issues.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <AlertCircle className="w-12 h-12 mx-auto mb-3 text-slate-400" />
          <p>No maintenance issues found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {issues.map((issue) => {
            const Icon = categoryIcons[issue.category];
            return (
              <div
                key={issue.id}
                className="bg-white border border-slate-200 rounded-lg p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`p-2 rounded-lg ${categoryColors[issue.category]}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-slate-900">{issue.title}</h3>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[issue.status]}`}>
                          {issue.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 mb-2">{issue.description}</p>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span>{issue.property.name}</span>
                        <span>•</span>
                        <span>Created by {issue.creator.full_name}</span>
                        <span>•</span>
                        <span>{formatDate(issue.created_at)}</span>
                        {issue.assignee && (
                          <>
                            <span>•</span>
                            <span>Assigned to {issue.assignee.full_name}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
