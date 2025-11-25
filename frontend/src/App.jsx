import { Routes, Route, Navigate } from "react-router-dom";
import { useContext } from "react";
import ShopContext from "./context/ShopContext";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import AIChatbox from "./components/AIChatbox";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import Dashboard from "./pages/Dashboard";
import Warehouses from "./pages/Warehouse";
import Inventory from "./pages/Inventory";
import Profile from "./pages/Profile";

function App() {
  const { shop, loading } = useContext(ShopContext);

  // Show loading state while checking localStorage
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Navbar />
      <div className="flex-1 container mx-auto p-4">
        <Routes>
          <Route path="/" element={shop ? <Dashboard /> : <Navigate to="/login" />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/warehouses" element={shop ? <Warehouses /> : <Navigate to="/login" />} />
          <Route path="/inventory" element={shop ? <Inventory /> : <Navigate to="/login" />} />
          <Route path="/profile" element={shop ? <Profile /> : <Navigate to="/login" />} />
        </Routes>
      </div>
      <Footer />
      {shop && <AIChatbox />}
    </div>
  );
}

export default App;
