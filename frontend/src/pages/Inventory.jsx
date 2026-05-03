import { useContext, useEffect, useRef, useState } from "react";
import axios from "axios";
import QRCode from "qrcode";
import ShopContext from "../context/ShopContext";
import { predictCategory } from "../utils/categoryPredictor";
import { predictStockRisk } from "../utils/stockRiskPredictor";

const Inventory = () => {
  const { shop } = useContext(ShopContext);
  const [inventory, setInventory] = useState([]);
  const [warehouseGroups, setWarehouseGroups] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [viewMode, setViewMode] = useState("warehouse");
  const [expandedWarehouses, setExpandedWarehouses] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState({
    warehouseId: "",
    productName: "",
    sku: "",
    quantity: "",
    price: "",
    category: "",
  });
  const [editingItem, setEditingItem] = useState(null);
  const [editFormData, setEditFormData] = useState({ quantity: "", price: "" });
  const [categoryPrediction, setCategoryPrediction] = useState(null);
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [selectedQrItem, setSelectedQrItem] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrLoading, setQrLoading] = useState(false);
  const [selectedTransferItem, setSelectedTransferItem] = useState(null);
  const [transferForm, setTransferForm] = useState({
    destinationWarehouseId: "",
    quantity: "",
    reason: "",
  });
  const [transferLoading, setTransferLoading] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanMessage, setScanMessage] = useState("");
  const videoRef = useRef(null);
  const scannerControlsRef = useRef(null);
  const streamRef = useRef(null);
  const scanFrameRef = useRef(null);

  const role = shop?.role || "owner";
  const canManageInventory = role === "owner" || role === "manager" || role === "employee";

  const getItemWarehouseId = (item) => String(item.warehouseId?._id || item.warehouseId);

  const updateInventoryItemState = (updatedItem) => {
    setInventory((prev) =>
      prev.map((item) => (item._id === updatedItem._id ? updatedItem : item))
    );

    setWarehouseGroups((prev) =>
      prev.map((group) => ({
        ...group,
        products: group.products.map((item) =>
          item._id === updatedItem._id ? updatedItem : item
        ),
      }))
    );
  };

  const addInventoryItemState = (newItem) => {
    setInventory((prev) => [newItem, ...prev]);

    setWarehouseGroups((prev) =>
      prev.map((group) =>
        String(group.warehouse._id) === getItemWarehouseId(newItem)
          ? { ...group, products: [newItem, ...group.products] }
          : group
      )
    );
  };

  const upsertInventoryItemState = (nextItem) => {
    setInventory((prev) => {
      const exists = prev.some((item) => item._id === nextItem._id);
      return exists
        ? prev.map((item) => (item._id === nextItem._id ? nextItem : item))
        : [nextItem, ...prev];
    });

    setWarehouseGroups((prev) =>
      prev.map((group) => {
        const exists = group.products.some((item) => item._id === nextItem._id);
        const belongsInGroup = String(group.warehouse._id) === getItemWarehouseId(nextItem);

        if (exists) {
          return {
            ...group,
            products: group.products.map((item) =>
              item._id === nextItem._id ? nextItem : item
            ),
          };
        }

        return belongsInGroup
          ? { ...group, products: [nextItem, ...group.products] }
          : group;
      })
    );
  };

  const removeInventoryItemState = (id) => {
    setInventory((prev) => prev.filter((item) => item._id !== id));

    setWarehouseGroups((prev) =>
      prev.map((group) => ({
        ...group,
        products: group.products.filter((item) => item._id !== id),
      }))
    );
  };

  const renderStockRisk = (item) => {
    const risk = predictStockRisk(item);

    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-gray-600">ML Stock Risk</span>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${risk.badgeClass}`}>
            {risk.status}
          </span>
        </div>
        <p className="mt-2 text-xs text-gray-600">
          {risk.recommendation} About {risk.daysOfStock} day{risk.daysOfStock === 1 ? "" : "s"} of stock left.
        </p>
      </div>
    );
  };

  const openTransferModal = (item) => {
    setSelectedTransferItem(item);
    setTransferForm({
      destinationWarehouseId: "",
      quantity: "",
      reason: "",
    });
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem("token");
        const [inventoryRes, warehousesRes, groupsRes] = await Promise.all([
          axios.get("http://localhost:5000/api/inventory", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get("http://localhost:5000/api/warehouse", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get("http://localhost:5000/api/inventory/by-warehouse", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        setInventory(inventoryRes.data);
        setWarehouses(warehousesRes.data);
        setWarehouseGroups(groupsRes.data);

        const expanded = {};
        groupsRes.data.forEach((group) => {
          expanded[group.warehouse._id] = true;
        });
        setExpandedWarehouses(expanded);
      } catch (error) {
        console.error("Error fetching inventory data", error);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    return () => stopScanner();
  }, []);

  const buildSkuQrPayload = (item) =>
    JSON.stringify({
      type: "stockmate-sku",
      sku: item.sku,
      productName: item.productName,
      category: item.category,
    });

  const extractSkuFromScan = (rawValue) => {
    try {
      const parsed = JSON.parse(rawValue);
      return parsed?.sku || rawValue;
    } catch {
      return rawValue;
    }
  };

  const openQrModal = async (item) => {
    setSelectedQrItem(item);
    setQrDataUrl("");
    setQrLoading(true);

    try {
      const dataUrl = await QRCode.toDataURL(buildSkuQrPayload(item), {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 320,
        color: {
          dark: "#111827",
          light: "#ffffff",
        },
      });
      setQrDataUrl(dataUrl);
    } catch (error) {
      console.error("Error generating QR code", error);
      alert("Failed to generate QR code");
    } finally {
      setQrLoading(false);
    }
  };

  const downloadQrCode = () => {
    if (!qrDataUrl || !selectedQrItem) return;
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `${selectedQrItem.sku}-qr.png`;
    link.click();
  };

  const printQrCode = () => {
    if (!qrDataUrl || !selectedQrItem) return;
    const printWindow = window.open("", "_blank", "width=420,height=560");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>${selectedQrItem.sku} QR Label</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 32px; text-align: center; color: #111827; }
            img { width: 260px; height: 260px; }
            h1 { font-size: 22px; margin: 16px 0 6px; }
            p { margin: 4px 0; color: #4b5563; }
            .sku { font-family: monospace; font-size: 18px; color: #111827; }
          </style>
        </head>
        <body>
          <img src="${qrDataUrl}" alt="${selectedQrItem.sku} QR code" />
          <h1>${selectedQrItem.productName}</h1>
          <p class="sku">${selectedQrItem.sku}</p>
          <p>${selectedQrItem.category}</p>
          <script>window.onload = () => { window.print(); window.close(); };</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const stopScanner = () => {
    if (scannerControlsRef.current) {
      scannerControlsRef.current.stop();
      scannerControlsRef.current = null;
    }

    if (scanFrameRef.current) {
      cancelAnimationFrame(scanFrameRef.current);
      scanFrameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const applyScannedValue = (rawValue) => {
    const sku = extractSkuFromScan(rawValue).trim();
    if (!sku) return;

    setSearchQuery(sku);
    setScanMessage(`Searching for SKU: ${sku}`);
    setScannerOpen(false);
    stopScanner();
  };

  const startScanner = async () => {
    setScanMessage("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setScanMessage("Camera access is not available in this browser.");
      return;
    }

    try {
      setScannerOpen(true);
      setScanMessage("Point the camera at a StockMate QR label or barcode.");

      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const codeReader = new BrowserMultiFormatReader();
      scannerControlsRef.current = await codeReader.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result) => {
          if (result) {
            applyScannedValue(result.getText());
          }
        }
      );
    } catch (zxingError) {
      console.warn("ZXing scanner failed, trying native detector", zxingError);

      if (!("BarcodeDetector" in window)) {
        setScannerOpen(false);
        stopScanner();
        setScanMessage("Unable to start scanner. Check camera permissions or search by SKU manually.");
        return;
      }

      try {
      const detector = new window.BarcodeDetector({
        formats: ["qr_code", "code_128", "ean_13", "ean_8", "upc_a", "upc_e"],
      });
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });

      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      const scan = async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          scanFrameRef.current = requestAnimationFrame(scan);
          return;
        }

        const codes = await detector.detect(videoRef.current);
        if (codes.length > 0) {
          applyScannedValue(codes[0].rawValue);
          return;
        }

        scanFrameRef.current = requestAnimationFrame(scan);
      };

      scanFrameRef.current = requestAnimationFrame(scan);
      } catch (nativeError) {
        console.error("Error starting scanner", nativeError);
        setScannerOpen(false);
        stopScanner();
        setScanMessage("Unable to start scanner. Check camera permissions or search by SKU manually.");
      }
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const nextFormData = { ...formData, [name]: value };

    if (name === "category") {
      setCategoryTouched(true);
    }

    if (name === "productName" || name === "sku") {
      const prediction = predictCategory({
        productName: nextFormData.productName,
        sku: nextFormData.sku,
      });

      setCategoryPrediction(prediction.category ? prediction : null);

      if (!categoryTouched && prediction.category && prediction.confidence >= 65) {
        nextFormData.category = prediction.category;
      }
    }

    setFormData(nextFormData);
  };

  const applyCategoryPrediction = () => {
    if (!categoryPrediction?.category) return;
    setFormData({ ...formData, category: categoryPrediction.category });
    setCategoryTouched(true);
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.post("http://localhost:5000/api/inventory", formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      addInventoryItemState(data);
      setFormData({
        warehouseId: "",
        productName: "",
        sku: "",
        quantity: "",
        price: "",
        category: "",
      });
      setCategoryPrediction(null);
      setCategoryTouched(false);
    } catch (error) {
      console.error("Error adding product", error);
      alert(error.response?.data?.message || "Failed to add product");
    }
  };

  const handleDeleteProduct = async (id) => {
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`http://localhost:5000/api/inventory/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      removeInventoryItemState(id);
    } catch (error) {
      console.error("Error deleting product", error);
    }
  };

  const handleUpdateQuantity = async (id, newQuantity) => {
    if (newQuantity < 0) return;

    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.put(
        `http://localhost:5000/api/inventory/${id}`,
        { quantity: newQuantity },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      updateInventoryItemState(data);
    } catch (error) {
      console.error("Error updating quantity", error);
    }
  };

  const handleTransferChange = (e) => {
    const { name, value } = e.target;
    setTransferForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTransferItem) return;

    try {
      setTransferLoading(true);
      const token = localStorage.getItem("token");
      const { data } = await axios.post(
        `http://localhost:5000/api/inventory/${selectedTransferItem._id}/transfer`,
        {
          destinationWarehouseId: transferForm.destinationWarehouseId,
          quantity: Number(transferForm.quantity),
          reason: transferForm.reason,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      upsertInventoryItemState(data.sourceItem);
      upsertInventoryItemState(data.destinationItem);
      setSelectedTransferItem(null);
      setTransferForm({ destinationWarehouseId: "", quantity: "", reason: "" });
    } catch (error) {
      console.error("Error transferring stock", error);
      alert(error.response?.data?.message || "Failed to transfer stock");
    } finally {
      setTransferLoading(false);
    }
  };

  const handleEditClick = (item) => {
    setEditingItem(item._id);
    setEditFormData({ quantity: item.quantity, price: item.price });
  };

  const handleEditChange = (e) => {
    setEditFormData({ ...editFormData, [e.target.name]: e.target.value });
  };

  const handleSaveEdit = async (id) => {
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.put(
        `http://localhost:5000/api/inventory/${id}`,
        {
          quantity: parseFloat(editFormData.quantity),
          price: parseFloat(editFormData.price),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      updateInventoryItemState(data);
      setEditingItem(null);
      setEditFormData({ quantity: "", price: "" });
    } catch (error) {
      console.error("Error updating item", error);
      alert(error.response?.data?.message || "Failed to update item");
    }
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
    setEditFormData({ quantity: "", price: "" });
  };

  const toggleWarehouse = (warehouseId) => {
    setExpandedWarehouses((prev) => ({
      ...prev,
      [warehouseId]: !prev[warehouseId],
    }));
  };

  const filteredInventory = inventory.filter(
    (item) =>
      item.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredWarehouseGroups = warehouseGroups
    .map((group) => ({
      ...group,
      products: group.products.filter(
        (item) =>
          item.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.category.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    }))
    .filter((group) => group.products.length > 0 || searchQuery === "");

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

        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="relative">
            <input
              type="text"
              placeholder="🔍 Search products by name, SKU, or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full p-4 pr-12 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-lg"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="mt-2 text-sm text-gray-600">
              Found {viewMode === "warehouse" ? filteredWarehouseGroups.reduce((sum, g) => sum + g.products.length, 0) : filteredInventory.length} products
            </p>
          )}
          <div className="mt-4 flex flex-col gap-3 border-t border-gray-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-800">Barcode / QR lookup</p>
              <p className="text-sm text-gray-600">Scan a QR label or type a SKU above to jump to a product.</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={startScanner}
                className="rounded-lg bg-gray-900 px-4 py-2 font-semibold text-white hover:bg-gray-800"
              >
                Scan Code
              </button>
              {scannerOpen && (
                <button
                  type="button"
                  onClick={() => {
                    setScannerOpen(false);
                    stopScanner();
                  }}
                  className="rounded-lg border-2 border-gray-300 bg-white px-4 py-2 font-semibold text-gray-700 hover:border-gray-400"
                >
                  Stop
                </button>
              )}
            </div>
          </div>
          {scanMessage && (
            <p className="mt-3 rounded-lg bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800">
              {scanMessage}
            </p>
          )}
          {scannerOpen && (
            <div className="mt-4 overflow-hidden rounded-xl border-2 border-gray-200 bg-gray-950">
              <video
                ref={videoRef}
                className="h-72 w-full object-cover"
                muted
                playsInline
              />
            </div>
          )}
        </div>

        {canManageInventory ? (
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
                <input type="text" name="productName" placeholder="Enter product name" value={formData.productName} onChange={handleChange} className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">SKU</label>
                <input type="text" name="sku" placeholder="Enter SKU" value={formData.sku} onChange={handleChange} className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors font-mono" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Quantity</label>
                <input type="number" name="quantity" placeholder="Enter quantity" value={formData.quantity} onChange={handleChange} className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" min="0" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Price ($)</label>
                <input type="number" name="price" placeholder="Enter price" value={formData.price} onChange={handleChange} className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" min="0" step="0.01" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <input type="text" name="category" placeholder="Enter category" value={formData.category} onChange={handleChange} className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" required />
                {categoryPrediction && (
                  <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-emerald-800">
                          Suggested: {categoryPrediction.category}
                        </p>
                        <p className="text-emerald-700">
                          Confidence: {categoryPrediction.confidence}%
                        </p>
                        {categoryPrediction.reason && (
                          <p className="mt-1 text-xs text-emerald-700">
                            {categoryPrediction.reason}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={applyCategoryPrediction}
                        className="shrink-0 rounded-md bg-emerald-600 px-3 py-2 font-semibold text-white hover:bg-emerald-700"
                      >
                        Use
                      </button>
                    </div>
                    {categoryPrediction.alternatives.length > 0 && (
                      <p className="mt-2 text-xs text-emerald-700">
                        Alternatives: {categoryPrediction.alternatives.join(", ")}
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div className="md:col-span-2 lg:col-span-3">
                <button type="submit" className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 rounded-lg font-semibold hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl">➕ Add Product</button>
              </div>
            </form>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border border-blue-100">
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Inventory Access</h3>
            <p className="text-gray-600">Employees can review stock and update quantities, but cannot add or delete products.</p>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-lg p-6">
          {viewMode === "warehouse" ? (
            <>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-semibold text-gray-800 flex items-center gap-2"><span>🏢</span> Inventory by Warehouse</h3>
                <span className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-semibold">
                  {filteredWarehouseGroups.length} {filteredWarehouseGroups.length === 1 ? "warehouse" : "warehouses"}
                </span>
              </div>

              {filteredWarehouseGroups.length === 0 ? (
                <div className="text-center py-16">
                  <span className="text-6xl mb-4 block">🏢</span>
                  <h4 className="text-xl font-semibold text-gray-800 mb-2">{searchQuery ? "No Products Found" : "No Warehouses Found"}</h4>
                  <p className="text-gray-600">{searchQuery ? "Try adjusting your search query" : "Add a warehouse first to start managing inventory"}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredWarehouseGroups.map((group) => (
                    <div key={group.warehouse._id} className="border-2 border-gray-200 rounded-xl overflow-hidden bg-gradient-to-br from-white to-gray-50">
                      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-5 cursor-pointer hover:from-blue-700 hover:to-indigo-700 transition-all" onClick={() => toggleWarehouse(group.warehouse._id)}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{expandedWarehouses[group.warehouse._id] ? "📂" : "📁"}</span>
                            <div>
                              <h4 className="text-xl font-bold">{group.warehouse.name}</h4>
                              <p className="text-blue-100 text-sm">📍 {group.warehouse.location}</p>
                            </div>
                          </div>
                          <span className="text-3xl">{expandedWarehouses[group.warehouse._id] ? "▼" : "▶"}</span>
                        </div>
                      </div>

                      {expandedWarehouses[group.warehouse._id] && (
                        <div className="p-5">
                          {group.products.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                              <p className="text-lg">📦 No products in this warehouse yet</p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {group.products.map((item) => (
                                <div key={item._id} className="border-2 border-gray-200 rounded-xl p-5 bg-white hover:shadow-xl transition-all duration-300">
                                  {editingItem === item._id ? (
                                    <div className="space-y-4">
                                      <div className="pb-3 border-b border-gray-200">
                                        <h4 className="text-lg font-bold text-gray-800">{item.productName}</h4>
                                        <p className="text-sm text-gray-500 font-mono">SKU: {item.sku}</p>
                                      </div>
                                      <div className="space-y-3">
                                        <div>
                                          <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                                          <input type="number" name="quantity" value={editFormData.quantity} onChange={handleEditChange} className="w-full p-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" min="0" required />
                                        </div>
                                        <div>
                                          <label className="block text-sm font-medium text-gray-700 mb-1">Price ($)</label>
                                          <input type="number" name="price" value={editFormData.price} onChange={handleEditChange} className="w-full p-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" min="0" step="0.01" required />
                                        </div>
                                      </div>
                                      <div className="flex space-x-2 pt-2">
                                        <button className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-medium transition-colors" onClick={() => handleSaveEdit(item._id)}>✓ Save</button>
                                        <button className="flex-1 bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 font-medium transition-colors" onClick={handleCancelEdit}>✕ Cancel</button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="space-y-4">
                                      <div>
                                        <h4 className="text-lg font-bold text-gray-800 mb-1">{item.productName}</h4>
                                        <p className="text-sm text-gray-500 font-mono">SKU: {item.sku}</p>
                                      </div>
                                      <div className="space-y-2">
                                        <div className="flex items-center justify-between"><span className="text-sm text-gray-600">Quantity:</span><span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">{item.quantity} pcs</span></div>
                                        <div className="flex items-center justify-between"><span className="text-sm text-gray-600">Price:</span><span className="font-semibold text-gray-800">${item.price}</span></div>
                                        <div className="flex items-center justify-between"><span className="text-sm text-gray-600">Category:</span><span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-semibold">{item.category}</span></div>
                                        <div className="flex items-center justify-between pt-2 border-t border-gray-200"><span className="text-sm text-gray-600">Total Value:</span><span className="font-bold text-green-600">${(item.quantity * item.price).toLocaleString()}</span></div>
                                      </div>
                                      {renderStockRisk(item)}
                                      {canManageInventory && (
                                        <div className="grid grid-cols-2 gap-2 pt-2">
                                          <button className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors" onClick={() => handleEditClick(item)}>✏️ Edit</button>
                                          <button className="bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 text-sm font-medium transition-colors" onClick={() => handleDeleteProduct(item._id)}>🗑️ Delete</button>
                                        </div>
                                      )}
                                      <button
                                        type="button"
                                        className="w-full rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
                                        onClick={() => openQrModal(item)}
                                      >
                                        Generate QR Label
                                      </button>
                                      <button
                                        type="button"
                                        className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
                                        onClick={() => openTransferModal(item)}
                                        disabled={warehouses.length < 2 || item.quantity <= 0}
                                      >
                                        Transfer Stock
                                      </button>
                                      <div className="grid grid-cols-2 gap-2">
                                        <button className="bg-green-500 text-white px-3 py-2 rounded-lg hover:bg-green-600 text-sm font-medium transition-colors" onClick={() => handleUpdateQuantity(item._id, item.quantity + 1)}>+1</button>
                                        <button className="bg-orange-500 text-white px-3 py-2 rounded-lg hover:bg-orange-600 text-sm font-medium transition-colors" onClick={() => handleUpdateQuantity(item._id, item.quantity - 1)}>-1</button>
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
            <>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-semibold text-gray-800 flex items-center gap-2"><span>📦</span> Inventory List</h3>
                <span className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-semibold">{filteredInventory.length} {filteredInventory.length === 1 ? "item" : "items"}</span>
              </div>

              {filteredInventory.length === 0 ? (
                <div className="text-center py-16">
                  <span className="text-6xl mb-4 block">📦</span>
                  <h4 className="text-xl font-semibold text-gray-800 mb-2">{searchQuery ? "No Products Found" : "No Products Found"}</h4>
                  <p className="text-gray-600">{searchQuery ? "Try adjusting your search query" : "Add your first product to get started"}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredInventory.map((item) => (
                    <div key={item._id} className="border-2 border-gray-200 rounded-xl p-5 bg-gradient-to-br from-white to-gray-50 hover:shadow-xl transition-all duration-300">
                      {editingItem === item._id ? (
                        <div className="space-y-4">
                          <div className="pb-3 border-b border-gray-200">
                            <h4 className="text-lg font-bold text-gray-800">{item.productName}</h4>
                            <p className="text-sm text-gray-500 font-mono">SKU: {item.sku}</p>
                          </div>
                          <div className="space-y-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                              <input type="number" name="quantity" value={editFormData.quantity} onChange={handleEditChange} className="w-full p-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" min="0" required />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Price ($)</label>
                              <input type="number" name="price" value={editFormData.price} onChange={handleEditChange} className="w-full p-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" min="0" step="0.01" required />
                            </div>
                          </div>
                          <div className="flex space-x-2 pt-2">
                            <button className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-medium transition-colors" onClick={() => handleSaveEdit(item._id)}>✓ Save</button>
                            <button className="flex-1 bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 font-medium transition-colors" onClick={handleCancelEdit}>✕ Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div>
                            <h4 className="text-lg font-bold text-gray-800 mb-1">{item.productName}</h4>
                            <p className="text-sm text-gray-500 font-mono">SKU: {item.sku}</p>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between"><span className="text-sm text-gray-600">Quantity:</span><span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">{item.quantity} pcs</span></div>
                            <div className="flex items-center justify-between"><span className="text-sm text-gray-600">Price:</span><span className="font-semibold text-gray-800">${item.price}</span></div>
                            <div className="flex items-center justify-between"><span className="text-sm text-gray-600">Category:</span><span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-semibold">{item.category}</span></div>
                            <div className="flex items-center justify-between pt-2 border-t border-gray-200"><span className="text-sm text-gray-600">Total Value:</span><span className="font-bold text-green-600">${(item.quantity * item.price).toLocaleString()}</span></div>
                          </div>
                          {renderStockRisk(item)}
                          {canManageInventory && (
                            <div className="grid grid-cols-2 gap-2 pt-2">
                              <button className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors" onClick={() => handleEditClick(item)}>✏️ Edit</button>
                              <button className="bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 text-sm font-medium transition-colors" onClick={() => handleDeleteProduct(item._id)}>🗑️ Delete</button>
                            </div>
                          )}
                          <button
                            type="button"
                            className="w-full rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
                            onClick={() => openQrModal(item)}
                          >
                            Generate QR Label
                          </button>
                          <button
                            type="button"
                            className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
                            onClick={() => openTransferModal(item)}
                            disabled={warehouses.length < 2 || item.quantity <= 0}
                          >
                            Transfer Stock
                          </button>
                          <div className="grid grid-cols-2 gap-2">
                            <button className="bg-green-500 text-white px-3 py-2 rounded-lg hover:bg-green-600 text-sm font-medium transition-colors" onClick={() => handleUpdateQuantity(item._id, item.quantity + 1)}>+1</button>
                            <button className="bg-orange-500 text-white px-3 py-2 rounded-lg hover:bg-orange-600 text-sm font-medium transition-colors" onClick={() => handleUpdateQuantity(item._id, item.quantity - 1)}>-1</button>
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
      {selectedQrItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/70 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">SKU QR Label</h3>
                <p className="mt-1 text-sm text-gray-600">{selectedQrItem.productName}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedQrItem(null);
                  setQrDataUrl("");
                }}
                className="rounded-full bg-gray-100 px-3 py-1 text-xl font-bold text-gray-600 hover:bg-gray-200"
                aria-label="Close QR label"
              >
                ×
              </button>
            </div>

            <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-5 text-center">
              {qrLoading ? (
                <div className="flex h-80 items-center justify-center">
                  <div className="text-gray-600">Generating QR code...</div>
                </div>
              ) : (
                <>
                  {qrDataUrl && (
                    <img
                      src={qrDataUrl}
                      alt={`${selectedQrItem.sku} QR code`}
                      className="mx-auto h-72 w-72 rounded-lg bg-white p-3 shadow"
                    />
                  )}
                  <h4 className="mt-4 text-lg font-bold text-gray-900">{selectedQrItem.productName}</h4>
                  <p className="font-mono text-base font-semibold text-gray-700">{selectedQrItem.sku}</p>
                  <p className="text-sm text-gray-500">{selectedQrItem.category}</p>
                </>
              )}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={downloadQrCode}
                disabled={!qrDataUrl}
                className="rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                Download PNG
              </button>
              <button
                type="button"
                onClick={printQrCode}
                disabled={!qrDataUrl}
                className="rounded-lg bg-gray-900 px-4 py-3 font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                Print Label
              </button>
            </div>
          </div>
        </div>
      )}
      {selectedTransferItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/70 p-4">
          <form
            onSubmit={handleTransferSubmit}
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">Transfer Stock</h3>
                <p className="mt-1 text-sm text-gray-600">
                  {selectedTransferItem.productName} · {selectedTransferItem.sku}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTransferItem(null)}
                className="rounded-full bg-gray-100 px-3 py-1 text-xl font-bold text-gray-600 hover:bg-gray-200"
                aria-label="Close transfer form"
              >
                ×
              </button>
            </div>

            <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 p-4">
              <p className="text-sm font-semibold text-blue-900">
                Available: {selectedTransferItem.quantity} units
              </p>
              <p className="mt-1 text-sm text-blue-800">
                Current warehouse:{" "}
                {warehouses.find((warehouse) => String(warehouse._id) === getItemWarehouseId(selectedTransferItem))?.name || "Unknown"}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Destination Warehouse
                </label>
                <select
                  name="destinationWarehouseId"
                  value={transferForm.destinationWarehouseId}
                  onChange={handleTransferChange}
                  className="w-full rounded-lg border-2 border-gray-300 p-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select destination</option>
                  {warehouses
                    .filter((warehouse) => String(warehouse._id) !== getItemWarehouseId(selectedTransferItem))
                    .map((warehouse) => (
                      <option key={warehouse._id} value={warehouse._id}>
                        {warehouse.name} - {warehouse.location}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Quantity
                </label>
                <input
                  type="number"
                  name="quantity"
                  value={transferForm.quantity}
                  onChange={handleTransferChange}
                  min="1"
                  max={selectedTransferItem.quantity}
                  className="w-full rounded-lg border-2 border-gray-300 p-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Reason
                </label>
                <input
                  type="text"
                  name="reason"
                  value={transferForm.reason}
                  onChange={handleTransferChange}
                  placeholder="Restocking branch, balancing storage, urgent request..."
                  className="w-full rounded-lg border-2 border-gray-300 p-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSelectedTransferItem(null)}
                className="rounded-lg border-2 border-gray-300 bg-white px-4 py-3 font-semibold text-gray-700 hover:border-gray-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={transferLoading}
                className="rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
              >
                {transferLoading ? "Transferring..." : "Transfer"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Inventory;
