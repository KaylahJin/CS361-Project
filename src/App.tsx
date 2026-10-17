
import { useState } from 'react';
import Navbar, { type TabType } from './components/Navbar';
import Home from './pages/Home';
import Requirements from './pages/Requirements';
import Employers from './pages/Employers';
import Positions from './pages/Positions';
import Students from './pages/Students';
import Periods from './pages/Periods';
import CoopPlans from './pages/CoopPlans';
import Login from './pages/Login';
import Account from './pages/Account';
import Footer from './components/Footer';
import AuthProvider from './auth/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import type { Company } from './types/company';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [selectedCompany, setSelectedCompany] =
    useState<Company | null>(null);

  // เมื่อเลือกเมนูตำแหน่งงานตามปกติ ให้แสดงทุกบริษัท
  const handleTabChange = (tab: TabType) => {
    if (tab === 'positions') {
      setSelectedCompany(null);
    }

    setActiveTab(tab);
  };

  // เปิดหน้าตำแหน่งงานโดยกรองบริษัทที่เลือกจากหน้าสถานประกอบการ
  const handleViewCompanyPositions = (company: Company) => {
    setSelectedCompany(company);
    setActiveTab('positions');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return <Home onTabChange={handleTabChange} />;

      case 'requirements':
        return <Requirements />;

      case 'employers':
        return (
          <Employers
            onViewPositions={handleViewCompanyPositions}
          />
        );

      case 'positions':
        return (
          <Positions
            initialCompanyId={selectedCompany?.company_id}
            initialCompanyName={selectedCompany?.name}
            onClearCompany={() => setSelectedCompany(null)}
          />
        );

      // The navbar hides this tab when signed out, and the gate here is what
      // catches a session that ends while the page is open: the active page is
      // a tab in state, so nothing navigates away on its own.
      case 'students':
        return (
          <ProtectedRoute fallback={<Login onSuccess={() => handleTabChange('students')} />}>
            <Students />
          </ProtectedRoute>
        );

      case 'periods':
        return <Periods />;

      case 'coop-plans':
        return (
          <ProtectedRoute fallback={<Login onSuccess={() => handleTabChange('coop-plans')} />}>
            <CoopPlans onNavigateLogin={() => handleTabChange('login')} />
          </ProtectedRoute>
        );

      case 'login':
        return <Login onSuccess={() => handleTabChange('account')} />;

      // The fallback is the Login page itself: this app tracks the active tab
      // in state instead of the URL, so there is nowhere to redirect to.
      case 'account':
        return (
          <ProtectedRoute fallback={<Login onSuccess={() => handleTabChange('account')} />}>
            <Account />
          </ProtectedRoute>
        );

      default:
        return <Home onTabChange={handleTabChange} />;
    }
  };

  // AuthProvider has to wrap the Navbar too, which reads auth status to choose
  // between the login button and the account/logout pair.
  return (
    <AuthProvider>
      <div className="flex min-h-screen flex-col bg-white font-sans text-slate-900 antialiased">
        <Navbar
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />

        <div className="flex-1">
          {renderContent()}
        </div>

        <Footer onTabChange={handleTabChange} />
      </div>
    </AuthProvider>
  );
}

export default App;
