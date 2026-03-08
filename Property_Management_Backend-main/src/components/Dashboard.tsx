import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, Building2, Wrench, Key } from 'lucide-react';
import PropertiesTab from './PropertiesTab';
import MaintenanceTab from './MaintenanceTab';
import KeysTab from './KeysTab';

type Tab = 'properties' | 'maintenance' | 'keys';

export default function Dashboard() {
  const { profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('properties');

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Property Management</h1>
              <p className="text-sm text-slate-600 mt-1">
                {profile?.full_name} • {profile?.role}
              </p>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="border-b border-slate-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('properties')}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'properties'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                <Building2 className="w-5 h-5" />
                Properties & Units
              </button>
              <button
                onClick={() => setActiveTab('maintenance')}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'maintenance'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                <Wrench className="w-5 h-5" />
                Maintenance Issues
              </button>
              <button
                onClick={() => setActiveTab('keys')}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'keys'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                <Key className="w-5 h-5" />
                Key Management
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'properties' && <PropertiesTab />}
            {activeTab === 'maintenance' && <MaintenanceTab />}
            {activeTab === 'keys' && <KeysTab />}
          </div>
        </div>
      </div>
    </div>
  );
}
