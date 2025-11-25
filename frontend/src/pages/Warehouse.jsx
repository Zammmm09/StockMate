import { useEffect, useState } from "react";
import axios from "axios";

const Warehouse = () => {
  const [warehouses, setWarehouses] = useState([]);
  const [formData, setFormData] = useState({ name: "", location: "", capacity: "" });
  const [editingWarehouse, setEditingWarehouse] = useState(null);
  const [editFormData, setEditFormData] = useState({ name: "", location: "", capacity: "" });

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const fetchWarehouses = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get("http://localhost:5000/api/warehouse", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setWarehouses(res.data);
    } catch (error) {
      console.error("Error fetching warehouses", error);
    }
  };

  const getStorageColor = (percentage) => {
    if (percentage >= 90) return { bg: "bg-red-500", text: "text-red-600", light: "bg-red-50" };
    if (percentage >= 70) return { bg: "bg-yellow-500", text: "text-yellow-600", light: "bg-yellow-50" };
    return { bg: "bg-green-500", text: "text-green-600", light: "bg-green-50" };
  };

  const getStorageStatus = (percentage) => {
    if (percentage >= 90) return "⚠️ Critical";
    if (percentage >= 70) return "⚡ High Usage";
    return "✅ Available";
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAddWarehouse = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      await axios.post("http://localhost:5000/api/warehouse", formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setFormData({ name: "", location: "", capacity: "" });
      fetchWarehouses(); // Reload the warehouse list
    } catch (error) {
      console.error("Error adding warehouse", error);
      alert("Error adding warehouse: " + (error.response?.data?.message || "Unknown error"));
    }
  };

  const handleDeleteWarehouse = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        alert("No authentication token found. Please login again.");
        return;
      }
      
      const response = await axios.delete(`http://localhost:5000/api/warehouse/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.data.message) {
        // Everything worked, reload the list
        fetchWarehouses();
      }
    } catch (error) {
      console.error("Full error object:", error);
      console.error("Error response:", error.response);
      
      let errorMessage = "Error deleting warehouse";
      
      if (error.response) {
        // Got an error response from the server
        errorMessage = error.response.data?.message || error.response.data?.error || `Server error: ${error.response.status}`;
      } else if (error.request) {
        // Sent the request but got no response back
        errorMessage = "No response from server. Is the backend running?";
      } else {
        // Something weird happened
        errorMessage = error.message || "Unknown error occurred";
      }
      
      alert(errorMessage);
    }
  };

  const handleEditClick = (warehouse) => {
    setEditingWarehouse(warehouse._id);
    setEditFormData({
      name: warehouse.name,
      location: warehouse.location,
      capacity: warehouse.capacity
    });
  };

  const handleEditChange = (e) => {
    setEditFormData({ ...editFormData, [e.target.name]: e.target.value });
  };

  const handleCancelEdit = () => {
    setEditingWarehouse(null);
    setEditFormData({ name: "", location: "", capacity: "" });
  };

  const handleUpdateWarehouse = async (e, warehouseId) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      await axios.put(
        `http://localhost:5000/api/warehouse/${warehouseId}`,
        editFormData,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setEditingWarehouse(null);
      setEditFormData({ name: "", location: "", capacity: "" });
      fetchWarehouses();
    } catch (error) {
      console.error("Error updating warehouse", error);
      alert("Error updating warehouse: " + (error.response?.data?.message || "Unknown error"));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h2 className="text-4xl font-bold text-gray-800 mb-2">Manage Warehouses</h2>
          <p className="text-gray-600">Create and manage your warehouse locations</p>
        </div>

        {/* Form to add a new warehouse */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <span>➕</span> Add New Warehouse
          </h3>
          <form onSubmit={handleAddWarehouse} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Warehouse Name</label>
              <input
                type="text"
                name="name"
                placeholder="Enter warehouse name"
                value={formData.name}
                onChange={handleChange}
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
              <input
                type="text"
                name="location"
                placeholder="Enter location"
                value={formData.location}
                onChange={handleChange}
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Capacity (units)</label>
              <input
                type="number"
                name="capacity"
                placeholder="Enter capacity"
                value={formData.capacity}
                onChange={handleChange}
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                min="1"
                required
              />
            </div>
            <div className="md:col-span-3">
              <button 
                type="submit" 
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 rounded-lg font-semibold hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl"
              >
                ➕ Add Warehouse
              </button>
            </div>
          </form>
        </div>

        {/* List of all warehouses */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
              <span>🏭</span> Your Warehouses
            </h3>
            <span className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-semibold">
              {warehouses.length} {warehouses.length === 1 ? 'warehouse' : 'warehouses'}
            </span>
          </div>
          
          {warehouses.length === 0 ? (
            <div className="text-center py-16">
              <span className="text-6xl mb-4 block">🏭</span>
              <h4 className="text-xl font-semibold text-gray-800 mb-2">No Warehouses Yet</h4>
              <p className="text-gray-600">Create your first warehouse to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {warehouses.map((warehouse) => {
                const storageInfo = warehouse.storageInfo || {
                  used: 0,
                  remaining: warehouse.capacity,
                  total: warehouse.capacity,
                  usagePercentage: 0,
                  itemCount: 0
                };
                const colors = getStorageColor(storageInfo.usagePercentage);
                
                return (
                  <div
                    key={warehouse._id}
                    className="border-2 border-gray-200 rounded-xl p-6 bg-gradient-to-br from-white to-blue-50 hover:shadow-xl transition-all duration-300"
                  >
                    {editingWarehouse === warehouse._id ? (
                      /* Edit form for warehouse */
                      <form onSubmit={(e) => handleUpdateWarehouse(e, warehouse._id)}>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-lg font-bold text-gray-800">✏️ Edit Warehouse</h4>
                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              className="text-gray-500 hover:text-gray-700 text-xl"
                              title="Cancel"
                            >
                              ✕
                            </button>
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Warehouse Name
                            </label>
                            <input
                              type="text"
                              name="name"
                              value={editFormData.name}
                              onChange={handleEditChange}
                              className="w-full p-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              required
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Location
                            </label>
                            <input
                              type="text"
                              name="location"
                              value={editFormData.location}
                              onChange={handleEditChange}
                              className="w-full p-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              required
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Capacity (units)
                            </label>
                            <input
                              type="number"
                              name="capacity"
                              value={editFormData.capacity}
                              onChange={handleEditChange}
                              className="w-full p-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              min="1"
                              required
                            />
                            {storageInfo.used > 0 && (
                              <p className="text-xs text-gray-500 mt-1">
                                Current usage: {storageInfo.used} units (cannot set below this)
                              </p>
                            )}
                          </div>
                          
                          <div className="flex gap-2 pt-2">
                            <button
                              type="submit"
                              className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-medium transition-colors"
                            >
                              💾 Save
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400 font-medium transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </form>
                    ) : (
                      /* Just showing warehouse details */
                      <div>
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <h4 className="text-xl font-bold text-gray-800 mb-2">{warehouse.name}</h4>
                            <p className="text-gray-600 flex items-center gap-2 text-sm">
                              <span>📍</span> {warehouse.location}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <div className="bg-blue-100 p-2 rounded-lg">
                              <button
                                onClick={() => handleEditClick(warehouse)}
                                className="text-blue-600 hover:text-blue-700 text-xl transition-colors"
                                title="Edit warehouse"
                              >
                                ✏️
                              </button>
                            </div>
                            <div className="bg-red-100 p-2 rounded-lg">
                              <button
                                onClick={() => handleDeleteWarehouse(warehouse._id, warehouse.name)}
                                className="text-red-600 hover:text-red-700 text-xl transition-colors"
                                title="Delete warehouse"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Storage usage bar */}
                        <div className="mt-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-700">Storage Usage</span>
                            <span className={`text-xs font-semibold ${colors.text}`}>
                              {getStorageStatus(storageInfo.usagePercentage)}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                            <div
                              className={`h-full ${colors.bg} transition-all duration-500 rounded-full`}
                              style={{ width: `${Math.min(storageInfo.usagePercentage, 100)}%` }}
                            ></div>
                          </div>
                          <div className="flex items-center justify-between mt-2 text-xs text-gray-600">
                            <span>{storageInfo.used} / {storageInfo.total} units</span>
                            <span className="font-semibold">{storageInfo.usagePercentage}% used</span>
                          </div>
                        </div>

                        {/* Storage Details */}
                        <div className="space-y-3 pt-4 border-t border-gray-200">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600 flex items-center gap-1">
                              <span>📦</span> Items Stored:
                            </span>
                            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">
                              {storageInfo.itemCount}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600 flex items-center gap-1">
                              <span>📊</span> Total Capacity:
                            </span>
                            <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-semibold">
                              {warehouse.capacity} units
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600 flex items-center gap-1">
                              <span>🔄</span> Remaining:
                            </span>
                            <span className={`px-3 py-1 ${colors.light} ${colors.text} rounded-full text-sm font-semibold`}>
                              {storageInfo.remaining} units
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Warehouse;
