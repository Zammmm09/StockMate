import { useContext, useEffect, useState } from "react";
import ShopContext from "../context/ShopContext";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const Dashboard = () => {
  const { shop, logoutShop } = useContext(ShopContext);
  const navigate = useNavigate();
  const [warehouses, setWarehouses] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem("token");
        const [warehousesRes, inventoryRes] = await Promise.all([
          axios.get("http://localhost:5000/api/warehouse", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get("http://localhost:5000/api/inventory", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        setWarehouses(warehousesRes.data);
        setInventory(inventoryRes.data);
      } catch (error) {
        console.error("Error fetching data", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleLogout = () => {
    logoutShop();
    navigate("/login");
  };

  const getInventoryForWarehouse = (warehouseId) => {
    return inventory.filter((item) => item.warehouseId === warehouseId);
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-700 text-lg font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const totalInventory = inventory.length;
  const totalWarehouses = warehouses.length;
  const totalValue = inventory.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  
  // Calculate total storage capacity and usage
  const totalCapacity = warehouses.reduce((sum, w) => sum + w.capacity, 0);
  const totalUsed = warehouses.reduce((sum, w) => sum + (w.storageInfo?.used || 0), 0);
  const totalRemaining = totalCapacity - totalUsed;
  const overallUsagePercentage = totalCapacity > 0 ? Math.round((totalUsed / totalCapacity) * 100) : 0;

  const getStorageColor = (percentage) => {
    if (percentage >= 90) return { bg: "bg-red-500", text: "text-red-600", light: "bg-red-50" };
    if (percentage >= 70) return { bg: "bg-yellow-500", text: "text-yellow-600", light: "bg-yellow-50" };
    return { bg: "bg-green-500", text: "text-green-600", light: "bg-green-50" };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Welcome back, <span className="text-blue-600">{shop?.name}</span>
          </h1>
          <p className="text-gray-600">Manage your inventory and warehouses</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Warehouses</p>
                <p className="text-3xl font-bold text-gray-800 mt-2">{totalWarehouses}</p>
              </div>
              <div className="bg-blue-100 p-4 rounded-full">
                <span className="text-3xl">🏭</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Products</p>
                <p className="text-3xl font-bold text-gray-800 mt-2">{totalInventory}</p>
              </div>
              <div className="bg-green-100 p-4 rounded-full">
                <span className="text-3xl">📦</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Value</p>
                <p className="text-3xl font-bold text-gray-800 mt-2">${totalValue.toLocaleString()}</p>
              </div>
              <div className="bg-purple-100 p-4 rounded-full">
                <span className="text-3xl">💰</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-orange-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Storage Available</p>
                <p className="text-3xl font-bold text-gray-800 mt-2">{totalRemaining}</p>
                <p className="text-xs text-gray-500 mt-1">{overallUsagePercentage}% used</p>
              </div>
              <div className="bg-orange-100 p-4 rounded-full">
                <span className="text-3xl">📊</span>
              </div>
            </div>
          </div>
        </div>

        {/* Warehouses */}
        <div className="space-y-6">
          {warehouses.length === 0 ? (
            <div className="bg-white rounded-xl shadow-lg p-12 text-center">
              <span className="text-6xl mb-4 block">🏭</span>
              <h3 className="text-2xl font-semibold text-gray-800 mb-2">No Warehouses Yet</h3>
              <p className="text-gray-600 mb-6">Create your first warehouse to get started</p>
              <button
                onClick={() => navigate("/warehouses")}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Create Warehouse
              </button>
            </div>
          ) : (
            warehouses.map((warehouse) => {
              const warehouseInventory = getInventoryForWarehouse(warehouse._id);
              const warehouseValue = warehouseInventory.reduce((sum, item) => sum + (item.quantity * item.price), 0);
              const storageInfo = warehouse.storageInfo || {
                used: 0,
                remaining: warehouse.capacity,
                total: warehouse.capacity,
                usagePercentage: 0,
                itemCount: 0
              };
              const colors = getStorageColor(storageInfo.usagePercentage);
              
              return (
                <div key={warehouse._id} className="bg-white rounded-xl shadow-lg overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-2xl font-bold mb-1">{warehouse.name}</h2>
                        <p className="text-blue-100 flex items-center gap-2">
                          <span>📍</span> {warehouse.location}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-blue-100">Capacity</p>
                        <p className="text-2xl font-bold">{warehouse.capacity} units</p>
                      </div>
                    </div>
                    
                    {/* Storage Progress Bar */}
                    <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Storage Usage</span>
                        <span className="text-sm font-semibold">
                          {storageInfo.usagePercentage}% used
                        </span>
                      </div>
                      <div className="w-full bg-white/30 rounded-full h-2.5 overflow-hidden">
                        <div
                          className={`h-full bg-white transition-all duration-500 rounded-full`}
                          style={{ width: `${Math.min(storageInfo.usagePercentage, 100)}%` }}
                        ></div>
                      </div>
                      <div className="flex items-center justify-between mt-2 text-xs">
                        <span>{storageInfo.used} used</span>
                        <span>{storageInfo.remaining} remaining</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-6">
                    {warehouseInventory.length > 0 ? (
                      <>
                        <div className="mb-4 flex items-center justify-between">
                          <h3 className="text-xl font-semibold text-gray-800">Inventory Items</h3>
                          <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                            {warehouseInventory.length} items • ${warehouseValue.toLocaleString()} value
                          </span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="min-w-full">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Product</th>
                                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">SKU</th>
                                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Quantity</th>
                                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Price</th>
                                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Category</th>
                                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Value</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {warehouseInventory.map((item) => (
                                <tr key={item._id} className="hover:bg-gray-50 transition-colors">
                                  <td className="py-4 px-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900">{item.productName}</div>
                                  </td>
                                  <td className="py-4 px-4 whitespace-nowrap">
                                    <div className="text-sm text-gray-600 font-mono">{item.sku}</div>
                                  </td>
                                  <td className="py-4 px-4 whitespace-nowrap">
                                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                      {item.quantity} pcs
                                    </span>
                                  </td>
                                  <td className="py-4 px-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900">${item.price}</div>
                                  </td>
                                  <td className="py-4 px-4 whitespace-nowrap">
                                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                                      {item.category}
                                    </span>
                                  </td>
                                  <td className="py-4 px-4 whitespace-nowrap">
                                    <div className="text-sm font-semibold text-green-600">
                                      ${(item.quantity * item.price).toLocaleString()}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-12">
                        <span className="text-5xl mb-4 block">📦</span>
                        <p className="text-gray-600 text-lg">No inventory in this warehouse</p>
                        <button
                          onClick={() => navigate("/inventory")}
                          className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          Add Products
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;