import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';

function App() {
  return (
    <div className="min-h-screen flex flex-col justify-between bg-white text-slate-900">
      <Navbar activeTab="home" onTabChange={() => {}} />
      <div className="flex-grow">
        <Home />
      </div>
      <Footer onTabChange={() => {}} />
    </div>
  );
}

export default App;