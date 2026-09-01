import { useState } from 'react';
import Navbar, { type TabType } from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Requirements from './pages/Requirements';
import Employers from './pages/Employers';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('home');

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return <Home onTabChange={setActiveTab} />;
      case 'requirements':
        return <Requirements />;
      case 'employers':
        return <Employers />;
      default:
        return <Home onTabChange={setActiveTab} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-white text-slate-900">
      <Navbar activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="flex-grow">
        {renderContent()}
      </div>
      <Footer onTabChange={setActiveTab} />
    </div>
  );
}

export default App;