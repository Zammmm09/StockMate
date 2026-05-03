import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";

const movementLabels = {
  create: "Added",
  increase: "Increased",
  decrease: "Decreased",
  adjust: "Adjusted",
  delete: "Deleted",
  "bulk-adjust": "Bulk Adjusted",
  "transfer-in": "Transfer In",
  "transfer-out": "Transfer Out",
};

const movementStyles = {
  create: "bg-green-100 text-green-800",
  increase: "bg-blue-100 text-blue-800",
  decrease: "bg-orange-100 text-orange-800",
  adjust: "bg-purple-100 text-purple-800",
  delete: "bg-red-100 text-red-800",
  "bulk-adjust": "bg-gray-100 text-gray-800",
  "transfer-in": "bg-teal-100 text-teal-800",
  "transfer-out": "bg-amber-100 text-amber-800",
};

const formatDate = (value) =>
  new Date(value).toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const StockMovements = () => {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [movementType, setMovementType] = useState("");

  const fetchMovements = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const token = localStorage.getItem("token");
      const params = { limit: 200 };
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (movementType) params.movementType = movementType;

      const { data } = await axios.get("http://localhost:5000/api/stock-movements", {
        params,
        headers: { Authorization: `Bearer ${token}` },
      });

      setMovements(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load stock movement history");
      setMovements([]);
    } finally {
      setLoading(false);
    }
  }, [movementType, searchQuery]);

  useEffect(() => {
    fetchMovements();
  }, [fetchMovements]);

  const totals = useMemo(() => {
    return movements.reduce(
      (summary, item) => {
        const change = Number(item.quantityChange) || 0;
        if (change > 0) summary.stockIn += change;
        if (change < 0) summary.stockOut += Math.abs(change);
        if (item.movementType === "delete") summary.deleted += 1;
        summary.net += change;
        return summary;
      },
      { stockIn: 0, stockOut: 0, net: 0, deleted: 0 }
    );
  }, [movements]);

  const exportCsv = async () => {
    try {
      const token = localStorage.getItem("token");
      const params = {};
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (movementType) params.movementType = movementType;

      const response = await axios.get("http://localhost:5000/api/stock-movements/export", {
        params,
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });

      const blob = new Blob([response.data], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `stock_movements_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.message || "Export failed");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 rounded-2xl bg-white p-6 shadow-lg">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-600">
                Accountability
              </p>
              <h1 className="mt-2 text-4xl font-bold text-gray-800">Stock Movement History</h1>
              <p className="mt-2 text-gray-600">
                Track every stock add, edit, delete, increase, and decrease with user and timestamp.
              </p>
            </div>
            <button
              type="button"
              onClick={exportCsv}
              className="rounded-lg bg-gray-900 px-5 py-3 font-semibold text-white hover:bg-gray-800"
            >
              Export CSV
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-xl border-l-4 border-blue-500 bg-white p-5 shadow">
            <p className="text-sm font-medium text-gray-600">Movements</p>
            <p className="mt-2 text-3xl font-bold text-gray-800">{movements.length}</p>
          </div>
          <div className="rounded-xl border-l-4 border-green-500 bg-white p-5 shadow">
            <p className="text-sm font-medium text-gray-600">Stock In</p>
            <p className="mt-2 text-3xl font-bold text-gray-800">+{totals.stockIn}</p>
          </div>
          <div className="rounded-xl border-l-4 border-orange-500 bg-white p-5 shadow">
            <p className="text-sm font-medium text-gray-600">Stock Out</p>
            <p className="mt-2 text-3xl font-bold text-gray-800">-{totals.stockOut}</p>
          </div>
          <div className="rounded-xl border-l-4 border-purple-500 bg-white p-5 shadow">
            <p className="text-sm font-medium text-gray-600">Net Change</p>
            <p className="mt-2 text-3xl font-bold text-gray-800">
              {totals.net > 0 ? "+" : ""}
              {totals.net}
            </p>
          </div>
        </div>

        <div className="mb-6 rounded-xl bg-white p-5 shadow">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_220px_auto]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search product, SKU, or user"
              className="rounded-lg border-2 border-gray-300 p-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={movementType}
              onChange={(e) => setMovementType(e.target.value)}
              className="rounded-lg border-2 border-gray-300 p-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All movement types</option>
              {Object.entries(movementLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={fetchMovements}
              className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
            >
              Apply
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl bg-white shadow-lg">
          {loading ? (
            <div className="p-12 text-center text-gray-600">Loading movement history...</div>
          ) : movements.length === 0 ? (
            <div className="p-12 text-center">
              <h3 className="text-xl font-semibold text-gray-800">No movements yet</h3>
              <p className="mt-2 text-gray-600">Add or update inventory to start recording history.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Product</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Old</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">New</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Change</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">User</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {movements.map((item) => (
                    <tr key={item._id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600">
                        {formatDate(item.createdAt)}
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-semibold text-gray-900">{item.productName}</p>
                        <p className="font-mono text-xs text-gray-500">{item.sku}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${movementStyles[item.movementType] || "bg-gray-100 text-gray-800"}`}>
                          {movementLabels[item.movementType] || item.movementType}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm font-semibold text-gray-700">{item.oldQuantity}</td>
                      <td className="px-4 py-4 text-sm font-semibold text-gray-700">{item.newQuantity}</td>
                      <td className={`px-4 py-4 text-sm font-bold ${item.quantityChange >= 0 ? "text-green-700" : "text-red-700"}`}>
                        {item.quantityChange > 0 ? "+" : ""}
                        {item.quantityChange}
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-sm font-semibold text-gray-800">{item.actorName}</p>
                        <p className="text-xs capitalize text-gray-500">{item.actorRole}</p>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">{item.reason || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StockMovements;
