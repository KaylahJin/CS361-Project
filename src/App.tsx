
import { useState } from 'react';
import Navbar, { type TabType } from './components/Navbar';
import Home from './pages/Home';
import Requirements from './pages/Requirements';
import Employers from './pages/Employers';
import Positions from './pages/Positions';
import Students from './pages/Students';
import Periods from './pages/Periods';
import CoopPlans from './pages/CoopPlans';
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

      case 'students':
        return <Students />;

      case 'periods':
        return <Periods />;

      case 'coop-plans':
        return <CoopPlans />;

      default:
        return <Home onTabChange={handleTabChange} />;
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-white font-sans text-slate-900 antialiased">
      <Navbar
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />

      <div className="flex-1">
        {renderContent()}
      </div>
    </div>
  );
}

export default App;
