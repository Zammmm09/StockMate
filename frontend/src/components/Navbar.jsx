import { useContext } from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import ShopContext from "../context/ShopContext";

const Navbar = () => {
  const { shop, logoutShop } = useContext(ShopContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logoutShop();
    navigate("/login");
  };

  return (
    <nav className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          {/* Logo and Brand Name */}
          <Link to="/" className="flex items-center space-x-3 hover:opacity-90 transition-opacity">
            <div className="bg-white p-2 rounded-lg">
              <img src="/stockmate_icon.png" alt="StockMate Logo" className="h-8 w-8" />
            </div>
            <span className="text-2xl font-bold">StockMate</span>
          </Link>

          {/* Navigation Links (Only for logged-in shops) */}
          {shop && (
            <div className="flex space-x-2">
              <NavLink
                to="/"
                className={({ isActive }) =>
                  `px-4 py-2 rounded-lg font-medium transition-all ${
                    isActive 
                      ? "bg-white text-blue-600 shadow-md" 
                      : "hover:bg-blue-700 hover:shadow-sm"
                  }`
                }
              >
                📊 Dashboard
              </NavLink>
              <NavLink
                to="/inventory"
                className={({ isActive }) =>
                  `px-4 py-2 rounded-lg font-medium transition-all ${
                    isActive 
                      ? "bg-white text-blue-600 shadow-md" 
                      : "hover:bg-blue-700 hover:shadow-sm"
                  }`
                }
              >
                📦 Inventory
              </NavLink>
              <NavLink
                to="/warehouses"
                className={({ isActive }) =>
                  `px-4 py-2 rounded-lg font-medium transition-all ${
                    isActive 
                      ? "bg-white text-blue-600 shadow-md" 
                      : "hover:bg-blue-700 hover:shadow-sm"
                  }`
                }
              >
                🏭 Warehouses
              </NavLink>
            </div>
          )}

          {/* Authentication Section */}
          <div>
            {shop ? (
              <div className="flex items-center space-x-4">
                <NavLink
                  to="/profile"
                  className="group flex items-center space-x-3 bg-white/10 px-5 py-2.5 rounded-full backdrop-blur-sm border border-white/20 hover:bg-white/20 hover:border-white/30 transition-all duration-200"
                >
                  <div className="w-8 h-8 bg-white/30 rounded-full flex items-center justify-center text-lg group-hover:bg-white/40 transition-all">
                    👤
                  </div>
                  <span className="font-medium">{shop.name}</span>
                </NavLink>
                <button
                  onClick={handleLogout}
                  className="bg-red-500 px-5 py-2 rounded-lg hover:bg-red-600 font-medium transition-colors shadow-md hover:shadow-lg"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex space-x-3">
                <NavLink
                  to="/login"
                  className={({ isActive }) =>
                    `px-5 py-2 rounded-lg font-medium transition-all ${
                      isActive 
                        ? "bg-white text-blue-600 shadow-md" 
                        : "bg-white/20 hover:bg-white/30 backdrop-blur-sm"
                    }`
                  }
                >
                  Sign In
                </NavLink>
                <NavLink
                  to="/register"
                  className={({ isActive }) =>
                    `px-5 py-2 rounded-lg font-medium transition-all ${
                      isActive 
                        ? "bg-white text-blue-600 shadow-md" 
                        : "bg-green-500 hover:bg-green-600 shadow-md hover:shadow-lg"
                    }`
                  }
                >
                  Sign Up
                </NavLink>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
