import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Key, CheckCircle, XCircle } from 'lucide-react';

interface KeyCheckout {
  id: string;
  checked_out_at: string;
  checked_in_at: string | null;
  expected_return_at: string | null;
  notes: string;
  key: {
    key_number: string;
    description: string;
    key_set: {
      name: string;
      property: {
        name: string;
      };
    };
  };
  user: {
    full_name: string;
    role: string;
  };
  issue?: {
    id: string;
    title: string;
  };
}

export default function KeysTab() {
  const [checkouts, setCheckouts] = useState<KeyCheckout[]>([]);
  const [loading, setLoading] = useState(true);
  const [showActiveOnly, setShowActiveOnly] = useState(true);

  useEffect(() => {
    fetchCheckouts();
  }, [showActiveOnly]);

  const fetchCheckouts = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      let url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/keys/checkouts`;
      if (showActiveOnly) {
        url += '?active=true';
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      if (result.data) {
        setCheckouts(result.data);
      }
    } catch (error) {
      console.error('Error fetching checkouts:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return <div className="text-center py-8 text-slate-600">Loading key checkouts...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-slate-900">Key Management</h2>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" />
          Checkout Key
        </button>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setShowActiveOnly(true)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            showActiveOnly
              ? 'bg-blue-600 text-white'
              : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
          }`}
        >
          Active Checkouts
        </button>
        <button
          onClick={() => setShowActiveOnly(false)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            !showActiveOnly
              ? 'bg-blue-600 text-white'
              : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
          }`}
        >
          All History
        </button>
      </div>

      {checkouts.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Key className="w-12 h-12 mx-auto mb-3 text-slate-400" />
          <p>No key checkouts found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {checkouts.map((checkout) => (
            <div
              key={checkout.id}
              className="bg-white border border-slate-200 rounded-lg p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3 flex-1">
                  <div className={`p-2 rounded-lg ${checkout.checked_in_at ? 'bg-green-100' : 'bg-amber-100'}`}>
                    <Key className={`w-5 h-5 ${checkout.checked_in_at ? 'text-green-600' : 'text-amber-600'}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-slate-900">
                        {checkout.key.key_set.name} - Key #{checkout.key.key_number}
                      </h3>
                      {checkout.checked_in_at ? (
                        <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                          <CheckCircle className="w-3 h-3" />
                          Returned
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
                          <XCircle className="w-3 h-3" />
                          Checked Out
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 mb-2">{checkout.key.key_set.property.name}</p>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span>Checked out by {checkout.user.full_name}</span>
                      <span>•</span>
                      <span>{formatDate(checkout.checked_out_at)}</span>
                      {checkout.checked_in_at && (
                        <>
                          <span>•</span>
                          <span>Returned {formatDate(checkout.checked_in_at)}</span>
                        </>
                      )}
                      {checkout.issue && (
                        <>
                          <span>•</span>
                          <span>Issue: {checkout.issue.title}</span>
                        </>
                      )}
                    </div>
                    {checkout.notes && (
                      <p className="text-sm text-slate-600 mt-2 italic">{checkout.notes}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
