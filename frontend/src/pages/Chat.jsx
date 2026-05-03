import { useContext, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { io as socketIOClient } from "socket.io-client";
import ShopContext from "../context/ShopContext";

const roleLabel = {
  owner: "Owner",
  manager: "Manager",
  employee: "Employee",
};

const roleColor = {
  owner: "bg-purple-100 text-purple-700",
  manager: "bg-blue-100 text-blue-700",
  employee: "bg-green-100 text-green-700",
};

const Chat = () => {
  const { shop } = useContext(ShopContext);
  const socketRef = useRef(null);
  const selectedUserRef = useRef(null);
  const [participants, setParticipants] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [loadingParticipants, setLoadingParticipants] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [error, setError] = useState("");
  const isReadOnlyThread = shop?.role === "employee" && selectedUser?.role === "owner";

  const api = useMemo(() => axios.create({ baseURL: "http://localhost:5000" }), []);

  const authHeaders = useMemo(() => {
    const token = localStorage.getItem("token");
    return { Authorization: `Bearer ${token}` };
  }, []);

  const formatTime = (value) =>
    new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  useEffect(() => {
    const loadParticipants = async () => {
      try {
        setLoadingParticipants(true);
        const { data } = await api.get("/api/chat/participants", { headers: authHeaders });
        setParticipants(data.participants || []);
        if ((data.participants || []).length > 0) {
          setSelectedUser(data.participants[0]);
        }
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load chat contacts");
      } finally {
        setLoadingParticipants(false);
      }
    };

    loadParticipants();
  }, [api, authHeaders]);

  useEffect(() => {
    if (!shop?._id) return;

    const token = localStorage.getItem("token");
    socketRef.current = socketIOClient("http://localhost:5000", {
      auth: { token },
    });

    socketRef.current.on("connect", () => {
      socketRef.current.emit("join", shop._id);
    });

    socketRef.current.on("chat:message", (incoming) => {
      const senderId = incoming?.senderId?._id || incoming?.senderId;
      const receiverId = incoming?.receiverId?._id || incoming?.receiverId;
      const selectedId = selectedUserRef.current?._id;
      if (!selectedId) return;

      const isCurrentThread =
        [String(senderId), String(receiverId)].includes(String(shop._id)) &&
        [String(senderId), String(receiverId)].includes(String(selectedId));

      if (isCurrentThread) {
        setMessages((prev) => {
          const exists = prev.some((item) => item._id === incoming._id);
          return exists ? prev : [...prev, incoming];
        });
      }
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [shop?._id]);

  useEffect(() => {
    const loadMessages = async () => {
      if (!selectedUser?._id) return;
      try {
        setLoadingMessages(true);
        setError("");
        const { data } = await api.get(`/api/chat/${selectedUser._id}`, {
          headers: authHeaders,
        });
        setMessages(data.messages || []);
        if (socketRef.current) {
          socketRef.current.emit("chat:join", selectedUser._id);
        }
      } catch (err) {
        const message = err.response?.data?.message || "Failed to load messages";
        setError(message);
        setMessages([]);
      } finally {
        setLoadingMessages(false);
      }
    };

    loadMessages();
    return () => {
      if (socketRef.current && selectedUser?._id) {
        socketRef.current.emit("chat:leave", selectedUser._id);
      }
    };
  }, [api, selectedUser, authHeaders]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!selectedUser?._id || !message.trim() || isReadOnlyThread) return;

    try {
      setSending(true);
      await api.post(
        "/api/chat/messages",
        { receiverId: selectedUser._id, message },
        { headers: authHeaders }
      );
      setMessage("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const sendBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcastMessage.trim()) return;

    try {
      setSendingBroadcast(true);
      const { data } = await api.post(
        "/api/chat/broadcast",
        { message: broadcastMessage },
        { headers: authHeaders }
      );

      const selectedId = selectedUser?._id;
      if (selectedId && (data.messages || []).length > 0) {
        const match = data.messages.find(
          (item) => String(item.receiverId?._id || item.receiverId) === String(selectedId)
        );
        if (match) {
          setMessages((prev) => {
            const exists = prev.some((item) => item._id === match._id);
            return exists ? prev : [...prev, match];
          });
        }
      }

      setBroadcastMessage("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to send broadcast");
    } finally {
      setSendingBroadcast(false);
    }
  };

  if (loadingParticipants) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading chat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 p-4 md:p-6">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="rounded-2xl bg-white shadow-lg border border-gray-100 overflow-hidden">
          <div className="border-b border-gray-100 p-5">
            <p className="text-sm uppercase tracking-[0.25em] text-blue-600 font-semibold">Messages</p>
            <h1 className="mt-1 text-2xl font-bold text-gray-800">Team Chat</h1>
            <p className="mt-2 text-sm text-gray-500">
              {roleLabel[shop?.role || "owner"]} can chat with approved team members only.
            </p>
          </div>

          {error && <div className="border-b border-red-100 bg-red-50 px-5 py-3 text-sm text-red-700">{error}</div>}

          {shop?.role === "owner" && (
            <form onSubmit={sendBroadcast} className="border-b border-gray-100 px-5 py-4">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Broadcast</label>
              <div className="mt-2 flex gap-2">
                <input
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  placeholder="Message all managers and employees"
                  className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
                />
                <button
                  type="submit"
                  disabled={sendingBroadcast || !broadcastMessage.trim()}
                  className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sendingBroadcast ? "Sending..." : "Send"}
                </button>
              </div>
            </form>
          )}

          <div className="max-h-[70vh] overflow-y-auto p-3 space-y-2">
            {participants.length === 0 ? (
              <div className="p-4 text-sm text-gray-500">No approved chat contacts yet.</div>
            ) : (
              participants.map((person) => (
                <button
                  key={person._id}
                  onClick={() => setSelectedUser(person)}
                  className={`w-full rounded-xl border p-4 text-left transition-all ${
                    selectedUser?._id === person._id
                      ? "border-blue-300 bg-blue-50"
                      : "border-gray-100 bg-white hover:border-blue-200 hover:bg-blue-50/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-11 w-11 items-center justify-center rounded-full font-bold ${roleColor[person.role] || "bg-gray-100 text-gray-700"}`}>
                        {person.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">{person.name}</p>
                        <p className="text-xs text-gray-500">{person.email}</p>
                      </div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${roleColor[person.role] || "bg-gray-100 text-gray-700"}`}>
                      {roleLabel[person.role] || person.role}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="flex min-h-[70vh] flex-col overflow-hidden rounded-2xl bg-white shadow-lg border border-gray-100">
          {selectedUser ? (
            <>
              <header className="flex items-center justify-between gap-4 border-b border-gray-100 p-5">
                <div className="flex items-center gap-3">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-full font-bold ${roleColor[selectedUser.role] || "bg-gray-100 text-gray-700"}`}>
                    {selectedUser.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">{selectedUser.name}</h2>
                    <p className="text-sm text-gray-500">{roleLabel[selectedUser.role] || selectedUser.role}</p>
                  </div>
                </div>
                <span className={`rounded-full px-3 py-1 text-sm font-semibold ${roleColor[selectedUser.role] || "bg-gray-100 text-gray-700"}`}>
                  Approved chat
                </span>
              </header>

              {isReadOnlyThread && (
                <div className="border-b border-amber-100 bg-amber-50 px-5 py-3 text-sm text-amber-800">
                  Read-only thread: employees can view messages from the owner, but cannot reply.
                </div>
              )}

              <div className="flex-1 space-y-3 overflow-y-auto bg-gradient-to-b from-white to-gray-50 p-5">
                {loadingMessages ? (
                  <div className="text-sm text-gray-500">Loading conversation...</div>
                ) : messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-center text-gray-500">
                    <div>
                      <div className="text-5xl mb-3">💬</div>
                      <p>No messages yet. Start the conversation.</p>
                    </div>
                  </div>
                ) : (
                  messages.map((item) => {
                    const mine = String(item.senderId?._id || item.senderId) === String(shop?._id);
                    const senderName = item.senderId?.name || item.senderName || "Unknown";
                    const senderRole = item.senderRole || item.senderId?.role || "owner";

                    return (
                      <div key={item._id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${mine ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-800"}`}>
                          <div className="mb-1 flex items-center gap-2 text-xs opacity-80">
                            <span className="font-semibold">{senderName}</span>
                            <span>•</span>
                            <span className="capitalize">{senderRole}</span>
                            <span>•</span>
                            <span>{formatTime(item.createdAt)}</span>
                          </div>
                          <p className="whitespace-pre-wrap text-sm leading-relaxed">{item.message}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <form onSubmit={sendMessage} className="border-t border-gray-100 bg-white p-4">
                <div className="flex gap-3">
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows="2"
                    placeholder={`Message ${selectedUser.name}...`}
                    disabled={isReadOnlyThread}
                    className="min-h-[56px] flex-1 rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                  />
                  <button
                    type="submit"
                    disabled={sending || !message.trim() || isReadOnlyThread}
                    className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isReadOnlyThread ? "Read only" : sending ? "Sending..." : "Send"}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-10 text-center text-gray-500">
              <div>
                <div className="text-6xl mb-3">💬</div>
                <p>Select a contact to start chatting.</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Chat;
