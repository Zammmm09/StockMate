import { useEffect, useState } from "react";
import axios from "axios";

const Inventory = () => {
  const [inventory, setInventory] = useState([]);
  const [warehouseGroups, setWarehouseGroups] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [viewMode, setViewMode] = useState("warehouse"); // Can switch between warehouse view and list view
  const [expandedWarehouses, setExpandedWarehouses] = useState({});
  const [formData, setFormData] = useState({
    warehouseId: "",
    productName: "",
    sku: "",
    quantity: "",
    price: "",
    category: "",
  });
  const [editingItem, setEditingItem] = useState(null);
  const [editFormData, setEditFormData] = useState({
    quantity: "",
    price: "",
  });

  useEffect(() => {
    fetchInventory();
    fetchWarehouses();
    fetchWarehouseGroups();
  }, []);

  const fetchInventory = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get("http://localhost:5000/api/inventory", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setInventory(res.data);
    } catch (error) {
      console.error("Error fetching inventory", error);
    }
  };

  const fetchWarehouseGroups = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get("http://localhost:5000/api/inventory/by-warehouse", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setWarehouseGroups(res.data);
      // Start with all warehouses expanded
      const expanded = {};
      res.data.forEach(group => {
        expanded[group.warehouse._id] = true;
      });
      setExpandedWarehouses(expanded);
    } catch (error) {
      console.error("Error fetching warehouse groups", error);
    }
  };

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

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      await axios.post("http://localhost:5000/api/inventory", formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setFormData({
        warehouseId: "",
        productName: "",
        sku: "",
        quantity: "",
        price: "",
        category: "",
      });
      fetchInventory();
      fetchWarehouseGroups();
    } catch (error) {
      console.error("Error adding product", error);
    }
  };

  const handleDeleteProduct = async (id) => {
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`http://localhost:5000/api/inventory/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchInventory();
      fetchWarehouseGroups();
    } catch (error) {
      console.error("Error deleting product", error);
    }
  };

  const handleUpdateQuantity = async (id, newQuantity) => {
    try {
      const token = localStorage.getItem("token");
      await axios.put(
        `http://localhost:5000/api/inventory/${id}`,
        { quantity: newQuantity },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchInventory();
      fetchWarehouseGroups();
    } catch (error) {
      console.error("Error updating quantity", error);
    }
  };

  const handleEditClick = (item) => {
    setEditingItem(item._id);
    setEditFormData({
      quantity: item.quantity,
      price: item.price,
    });
  };

  const handleEditChange = (e) => {
    setEditFormData({ ...editFormData, [e.target.name]: e.target.value });
  };

  const handleSaveEdit = async (id) => {
    try {
      const token = localStorage.getItem("token");
      await axios.put(
        `http://localhost:5000/api/inventory/${id}`,
        {
          quantity: parseFloat(editFormData.quantity),
          price: parseFloat(editFormData.price),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setEditingItem(null);
      setEditFormData({ quantity: "", price: "" });
      fetchInventory();
      fetchWarehouseGroups();
    } catch (error) {
      console.error("Error updating item", error);
      alert("Error updating item: " + (error.response?.data?.message || "Unknown error"));
    }
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
    setEditFormData({ quantity: "", price: "" });
  };

  const toggleWarehouse = (warehouseId) => {
    setExpandedWarehouses(prev => ({
      ...prev,
      [warehouseId]: !prev[warehouseId]
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-4xl font-bold text-gray-800 mb-2">Manage Inventory</h2>
              <p className="text-gray-600">Add and manage your product inventory</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode("warehouse")}
                className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                  viewMode === "warehouse"
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg"
                    : "bg-white text-gray-700 border-2 border-gray-300 hover:border-blue-400"
                }`}
              >
                🏢 By Warehouse
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                  viewMode === "list"
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg"
                    : "bg-white text-gray-700 border-2 border-gray-300 hover:border-blue-400"
                }`}
              >
                📋 List View
              </button>
            </div>
          </div>
        </div>

        {/* Add Product Form */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <span>➕</span> Add New Product
          </h3>
          <form onSubmit={handleAddProduct} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Warehouse</label>
              <select
                name="warehouseId"
                value={formData.warehouseId}
                onChange={handleChange}
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                required
              >
                <option value="">Select Warehouse</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse._id} value={warehouse._id}>
                    {warehouse.name} - {warehouse.location}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Product Name</label>
              <input
                type="text"
                name="productName"
                placeholder="Enter product name"
                value={formData.productName}
                onChange={handleChange}
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">SKU</label>
              <input
                type="text"
                name="sku"
                placeholder="Enter SKU"
                value={formData.sku}
                onChange={handleChange}
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Quantity</label>
              <input
                type="number"
                name="quantity"
                placeholder="Enter quantity"
                value={formData.quantity}
                onChange={handleChange}
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                min="0"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Price ($)</label>
              <input
                type="number"
                name="price"
                placeholder="Enter price"
                value={formData.price}
                onChange={handleChange}
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                min="0"
                step="0.01"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <input
                type="text"
                name="category"
                placeholder="Enter category"
                value={formData.category}
                onChange={handleChange}
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                required
              />
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl"
              >
                ➕ Add Product
              </button>
            </div>
          </form>
        </div>

        {/* Inventory List */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          {viewMode === "warehouse" ? (
            // Warehouse Grouped View
            <>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
                  <span>🏢</span> Inventory by Warehouse
                </h3>
                <span className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-semibold">
                  {warehouseGroups.length} {warehouseGroups.length === 1 ? 'warehouse' : 'warehouses'}
                </span>
              </div>

              {warehouseGroups.length === 0 ? (
                <div className="text-center py-16">
                  <span className="text-6xl mb-4 block">🏢</span>
                  <h4 className="text-xl font-semibold text-gray-800 mb-2">No Warehouses Found</h4>
                  <p className="text-gray-600">Add a warehouse first to start managing inventory</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {warehouseGroups.map((group) => (
                    <div
                      key={group.warehouse._id}
                      className="border-2 border-gray-200 rounded-xl overflow-hidden bg-gradient-to-br from-white to-gray-50"
                    >
                      {/* Warehouse Header */}
                      <div
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-5 cursor-pointer hover:from-blue-700 hover:to-indigo-700 transition-all"
                        onClick={() => toggleWarehouse(group.warehouse._id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">
                              {expandedWarehouses[group.warehouse._id] ? "📂" : "📁"}
                            </span>
                            <div>
                              <h4 className="text-xl font-bold">{group.warehouse.name}</h4>
                              <p className="text-blue-100 text-sm">📍 {group.warehouse.location}</p>
                            </div>
                          </div>
                          <div className="flex gap-6 items-center">
                            <div className="text-right">
                              <p className="text-sm text-blue-100">Products</p>
                              <p className="text-2xl font-bold">{group.stats.productCount}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-blue-100">Total Items</p>
                              <p className="text-2xl font-bold">{group.stats.totalItems}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-blue-100">Total Value</p>
                              <p className="text-2xl font-bold">${Number(group.stats.totalValue).toLocaleString()}</p>
                            </div>
                            <span className="text-3xl">
                              {expandedWarehouses[group.warehouse._id] ? "▼" : "▶"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Products in Warehouse */}
                      {expandedWarehouses[group.warehouse._id] && (
                        <div className="p-5">
                          {group.products.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                              <p className="text-lg">📦 No products in this warehouse yet</p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {group.products.map((item) => (
                                <div
                                  key={item._id}
                                  className="border-2 border-gray-200 rounded-xl p-5 bg-white hover:shadow-xl transition-all duration-300"
                                >
                                  {editingItem === item._id ? (
                                    // Edit Mode
                                    <div className="space-y-4">
                                      <div className="pb-3 border-b border-gray-200">
                                        <h4 className="text-lg font-bold text-gray-800">{item.productName}</h4>
                                        <p className="text-sm text-gray-500 font-mono">SKU: {item.sku}</p>
                                      </div>
                                      <div className="space-y-3">
                                        <div>
                                          <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Quantity
                                          </label>
                                          <input
                                            type="number"
                                            name="quantity"
                                            value={editFormData.quantity}
                                            onChange={handleEditChange}
                                            className="w-full p-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            min="0"
                                            required
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Price ($)
                                          </label>
                                          <input
                                            type="number"
                                            name="price"
                                            value={editFormData.price}
                                            onChange={handleEditChange}
                                            className="w-full p-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            min="0"
                                            step="0.01"
                                            required
                                          />
                                        </div>
                                      </div>
                                      <div className="flex space-x-2 pt-2">
                                        <button
                                          className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-medium transition-colors"
                                          onClick={() => handleSaveEdit(item._id)}
                                        >
                                          ✓ Save
                                        </button>
                                        <button
                                          className="flex-1 bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 font-medium transition-colors"
                                          onClick={handleCancelEdit}
                                        >
                                          ✕ Cancel
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    // View Mode
                                    <div className="space-y-4">
                                      <div>
                                        <h4 className="text-lg font-bold text-gray-800 mb-1">{item.productName}</h4>
                                        <p className="text-sm text-gray-500 font-mono">SKU: {item.sku}</p>
                                      </div>
                                      <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                          <span className="text-sm text-gray-600">Quantity:</span>
                                          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">
                                            {item.quantity} pcs
                                          </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                          <span className="text-sm text-gray-600">Price:</span>
                                          <span className="font-semibold text-gray-800">${item.price}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                          <span className="text-sm text-gray-600">Category:</span>
                                          <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-semibold">
                                            {item.category}
                                          </span>
                                        </div>
                                        <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                                          <span className="text-sm text-gray-600">Total Value:</span>
                                          <span className="font-bold text-green-600">
                                            ${(item.quantity * item.price).toLocaleString()}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="grid grid-cols-2 gap-2 pt-2">
                                        <button
                                          className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
                                          onClick={() => handleEditClick(item)}
                                        >
                                          ✏️ Edit
                                        </button>
                                        <button
                                          className="bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 text-sm font-medium transition-colors"
                                          onClick={() => handleDeleteProduct(item._id)}
                                        >
                                          🗑️ Delete
                                        </button>
                                      </div>
                                      <div className="grid grid-cols-2 gap-2">
                                        <button
                                          className="bg-green-500 text-white px-3 py-2 rounded-lg hover:bg-green-600 text-sm font-medium transition-colors"
                                          onClick={() => handleUpdateQuantity(item._id, item.quantity + 1)}
                                        >
                                          +1
                                        </button>
                                        <button
                                          className="bg-orange-500 text-white px-3 py-2 rounded-lg hover:bg-orange-600 text-sm font-medium transition-colors"
                                          onClick={() => handleUpdateQuantity(item._id, item.quantity - 1)}
                                        >
                                          -1
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            // List View (Original)
            <>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
                  <span>📦</span> Inventory List
                </h3>
                <span className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-semibold">
                  {inventory.length} {inventory.length === 1 ? 'item' : 'items'}
                </span>
              </div>
              
              {inventory.length === 0 ? (
                <div className="text-center py-16">
                  <span className="text-6xl mb-4 block">📦</span>
                  <h4 className="text-xl font-semibold text-gray-800 mb-2">No Products Found</h4>
                  <p className="text-gray-600">Add your first product to get started</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {inventory.map((item) => (
                    <div
                      key={item._id}
                      className="border-2 border-gray-200 rounded-xl p-5 bg-gradient-to-br from-white to-gray-50 hover:shadow-xl transition-all duration-300"
                    >
                      {editingItem === item._id ? (
                        // Edit Mode
                        <div className="space-y-4">
                          <div className="pb-3 border-b border-gray-200">
                            <h4 className="text-lg font-bold text-gray-800">{item.productName}</h4>
                            <p className="text-sm text-gray-500 font-mono">SKU: {item.sku}</p>
                          </div>
                          <div className="space-y-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Quantity
                              </label>
                              <input
                                type="number"
                                name="quantity"
                                value={editFormData.quantity}
                                onChange={handleEditChange}
                                className="w-full p-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                min="0"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Price ($)
                              </label>
                              <input
                                type="number"
                                name="price"
                                value={editFormData.price}
                                onChange={handleEditChange}
                                className="w-full p-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                min="0"
                                step="0.01"
                                required
                              />
                            </div>
                          </div>
                          <div className="flex space-x-2 pt-2">
                            <button
                              className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-medium transition-colors"
                              onClick={() => handleSaveEdit(item._id)}
                            >
                              ✓ Save
                            </button>
                            <button
                              className="flex-1 bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 font-medium transition-colors"
                              onClick={handleCancelEdit}
                            >
                              ✕ Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        // View Mode
                        <div className="space-y-4">
                          <div>
                            <h4 className="text-lg font-bold text-gray-800 mb-1">{item.productName}</h4>
                            <p className="text-sm text-gray-500 font-mono">SKU: {item.sku}</p>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">Quantity:</span>
                              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">
                                {item.quantity} pcs
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">Price:</span>
                              <span className="font-semibold text-gray-800">${item.price}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">Category:</span>
                              <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-semibold">
                                {item.category}
                              </span>
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                              <span className="text-sm text-gray-600">Total Value:</span>
                              <span className="font-bold text-green-600">
                                ${(item.quantity * item.price).toLocaleString()}
                              </span>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 pt-2">
                            <button
                              className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
                              onClick={() => handleEditClick(item)}
                            >
                              ✏️ Edit
                            </button>
                            <button
                              className="bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 text-sm font-medium transition-colors"
                              onClick={() => handleDeleteProduct(item._id)}
                            >
                              🗑️ Delete
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              className="bg-green-500 text-white px-3 py-2 rounded-lg hover:bg-green-600 text-sm font-medium transition-colors"
                              onClick={() => handleUpdateQuantity(item._id, item.quantity + 1)}
                            >
                              +1
                            </button>
                            <button
                              className="bg-orange-500 text-white px-3 py-2 rounded-lg hover:bg-orange-600 text-sm font-medium transition-colors"
                              onClick={() => handleUpdateQuantity(item._id, item.quantity - 1)}
                            >
                              -1
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Inventory;
