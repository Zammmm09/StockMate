import { useContext, useEffect, useState, useRef } from "react";
import axios from "axios";
import ShopContext from "../context/ShopContext";
import { io as socketIOClient } from "socket.io-client";

const ActivityLog = () => {
  const { shop } = useContext(ShopContext);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedUsers, setExpandedUsers] = useState({});
  const socketRef = useRef(null);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const token = localStorage.getItem("token");
        const { data } = await axios.get("http://localhost:5000/api/activity?limit=100", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setLogs(data);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load activity log");
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
    // setup socket
    const token = localStorage.getItem("token");
    if (shop && shop._id) {
      socketRef.current = socketIOClient("http://localhost:5000", {
        auth: { token },
      });

      socketRef.current.on("connect", () => {
        socketRef.current.emit("join", shop._id);
      });

      socketRef.current.on("activity:created", (log) => {
        // prepend new log
        setLogs((prev) => [log, ...prev]);
      });
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [shop]);

  const formatDate = (value) => {
    const now = new Date();
    const date = new Date(value);
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getActionIcon = (action, entityType) => {
    if (action === "create") return "➕";
    if (action === "update") return "✏️";
    if (action === "delete") return "🗑️";
    return "📝";
  };

  const getRoleColor = (role) => {
    if (role === "owner") return "bg-purple-100 text-purple-700";
    if (role === "manager") return "bg-blue-100 text-blue-700";
    return "bg-green-100 text-green-700";
  };

  const toggleUser = (actorId) => {
    setExpandedUsers((prev) => ({
      ...prev,
      [actorId]: !prev[actorId],
    }));
  };

  const exportLogs = async (actorId, format = "csv") => {
    try {
      const token = localStorage.getItem("token");
      const params = { format };
      if (actorId) params.actorId = actorId;

      const response = await axios.get("http://localhost:5000/api/activity/export", {
        params,
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });

      const blob = new Blob([response.data], { type: format === "json" ? "application/json" : "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      a.download = `activity_${actorId || "all"}_${ts}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.message || "Export failed");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading activity...</p>
        </div>
      </div>
    );
  }

  // Group logs by actor
  const groupedByActor = logs.reduce((acc, log) => {
    const actorId = log.actorId;
    if (!acc[actorId]) {
      acc[actorId] = {
        actorId,
        actorName: log.actorName,
        actorRole: log.actorRole,
        activities: [],
      };
    }
    acc[actorId].activities.push(log);
    return acc;
  }, {});

  const userGroups = Object.values(groupedByActor);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 p-4 md:p-6">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800">👥 Team Activity</h1>
          <p className="mt-2 text-gray-600">Activities grouped by team member</p>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 text-red-700 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* User Groups */}
        {logs.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-12">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="text-6xl mb-3">🔔</div>
              <p className="text-gray-500">No activity recorded yet</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {userGroups.map((user) => (
              <div
                key={user.actorId}
                className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100"
              >
                {/* User Header - Clickable Dropdown */}
                <button
                  onClick={() => toggleUser(user.actorId)}
                  className={`w-full ${getRoleColor(user.actorRole)} px-6 py-4 flex items-center gap-4 hover:opacity-90 transition-opacity`}
                >
                  {/* Avatar */}
                  <div className={`flex-shrink-0 w-14 h-14 rounded-full bg-white bg-opacity-30 flex items-center justify-center font-bold text-xl`}>
                    {user.actorName.charAt(0).toUpperCase()}
                  </div>

                  {/* User Info */}
                  <div className="flex-1 text-left">
                    <h3 className="text-xl font-bold">{user.actorName}</h3>
                    <p className="text-sm opacity-90 capitalize">{user.actorRole}</p>
                  </div>

                  {/* Activity Count */}
                  <span className="px-3 py-1 bg-white bg-opacity-20 rounded-full text-sm font-semibold">
                    {user.activities.length}
                  </span>

                  {/* Export Buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); exportLogs(user.actorId, "csv"); }}
                      title="Export CSV"
                      className="px-2 py-1 text-xs bg-white bg-opacity-30 rounded hover:bg-opacity-40"
                    >
                      CSV
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); exportLogs(user.actorId, "json"); }}
                      title="Export JSON"
                      className="px-2 py-1 text-xs bg-white bg-opacity-30 rounded hover:bg-opacity-40"
                    >
                      JSON
                    </button>
                  </div>

                  {/* Chevron Icon */}
                  <div className={`flex-shrink-0 text-2xl transform transition-transform ${expandedUsers[user.actorId] ? "rotate-180" : ""}`}>
                    ▼
                  </div>
                </button>

                {/* Activities Feed - Collapsible */}
                {expandedUsers[user.actorId] && (
                  <div className="max-h-[60vh] overflow-y-auto p-4 md:p-6 space-y-3 border-t border-gray-100">
                    {user.activities.map((log) => (
                      <div
                        key={log._id}
                        className="flex gap-3 animate-in fade-in slide-in-from-bottom-2"
                      >
                        {/* Action Icon */}
                        <div className="flex-shrink-0 mt-1">
                          <span className="text-2xl">{getActionIcon(log.action, log.entityType)}</span>
                        </div>

                        {/* Activity Bubble */}
                        <div className="flex-1">
                          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 hover:border-gray-300 transition-colors">
                            <div className="flex items-start justify-between mb-1">
                              <p className="text-gray-700 text-sm font-medium">{log.summary}</p>
                              <span className="text-xs text-gray-400 ml-2 whitespace-nowrap">
                                {formatDate(log.createdAt)}
                              </span>
                            </div>
                            {log.entityId && (
                              <p className="text-xs text-gray-400 mt-1">
                                Entity: {log.entityType} • ID: {log.entityId.slice(0, 8)}...
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Summary Footer */}
        {logs.length > 0 && (
          <div className="mt-6 bg-white rounded-lg shadow p-4 text-center text-sm text-gray-600">
            Total: {logs.length} activities from {userGroups.length} team member{userGroups.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityLog;
