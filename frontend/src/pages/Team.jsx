import { useContext, useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import ShopContext from "../context/ShopContext";

const securityQuestions = [
  "What was the name of your first pet?",
  "In which city were you born?",
  "What is your mother's maiden name?",
  "What was the name of your first school?",
  "What is your favorite book?",
  "What was your childhood nickname?",
];

const Team = () => {
  const { shop } = useContext(ShopContext);
  const navigate = useNavigate();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: shop?.role === "manager" ? "employee" : "manager",
    phone: "",
    address: "",
    securityQuestion: "",
    securityAnswer: "",
  });

  useEffect(() => {
    if (!["owner", "manager"].includes(shop?.role || "owner")) {
      navigate("/dashboard");
      return;
    }

    const fetchStaff = async () => {
      try {
        const token = localStorage.getItem("token");
        const { data } = await axios.get("http://localhost:5000/api/shop/staff", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setStaff(data);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load team members");
      } finally {
        setLoading(false);
      }
    };

    fetchStaff();
  }, [navigate, shop]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.post("http://localhost:5000/api/shop/staff", formData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setStaff((current) => [data.staff, ...current]);
      setFormData({
        name: "",
        email: "",
        password: "",
        role: shop?.role === "manager" ? "employee" : "manager",
        phone: "",
        address: "",
        securityQuestion: "",
        securityAnswer: "",
      });
      setSuccess("Team member created successfully");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create team member");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this team member?")) {
      return;
    }

    try {
      const token = localStorage.getItem("token");
      await axios.delete(`http://localhost:5000/api/shop/staff/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStaff((current) => current.filter((member) => member._id !== id));
      setSuccess("Team member removed");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete team member");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading team...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 rounded-3xl bg-white/80 p-6 shadow-lg backdrop-blur">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">{shop?.role === "manager" ? "Manager Dashboard" : "Owner Dashboard"}</p>
          <h1 className="mt-2 text-4xl font-bold text-gray-800">{shop?.role === "manager" ? "Employee Management" : "Team Management"}</h1>
          <p className="mt-2 text-gray-600">
            {shop?.role === "manager"
              ? "Manage employee accounts."
              : "Create manager and employee accounts for your shop."}
          </p>
        </div>

        {(error || success) && (
          <div className="mb-6 space-y-3">
            {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>}
            {success && <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-700">{success}</div>}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-xl font-semibold text-gray-800">{shop?.role === "manager" ? "Create Employee" : "Create Team Member"}</h2>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
              <input name="name" value={formData.name} onChange={handleChange} className="rounded-lg border border-gray-300 p-3" placeholder="Full name" required />
              <input name="email" type="email" value={formData.email} onChange={handleChange} className="rounded-lg border border-gray-300 p-3" placeholder="Email" required />
              <input name="password" type="password" value={formData.password} onChange={handleChange} className="rounded-lg border border-gray-300 p-3" placeholder="Temporary password" required />
              <select name="role" value={formData.role} onChange={handleChange} className="rounded-lg border border-gray-300 p-3">
                {shop?.role === "owner" && <option value="manager">Manager</option>}
                <option value="employee">Employee</option>
              </select>
              <input name="phone" value={formData.phone} onChange={handleChange} className="rounded-lg border border-gray-300 p-3" placeholder="Phone" />
              <input name="address" value={formData.address} onChange={handleChange} className="rounded-lg border border-gray-300 p-3" placeholder="Address" />
              <select name="securityQuestion" value={formData.securityQuestion} onChange={handleChange} className="rounded-lg border border-gray-300 p-3 md:col-span-2" required>
                <option value="">Select a security question</option>
                {securityQuestions.map((question) => (
                  <option key={question} value={question}>{question}</option>
                ))}
              </select>
              <input name="securityAnswer" value={formData.securityAnswer} onChange={handleChange} className="rounded-lg border border-gray-300 p-3 md:col-span-2" placeholder="Security answer" required />
              <button disabled={saving} type="submit" className="rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60 md:col-span-2">
                {saving ? "Saving..." : "Create Account"}
              </button>
            </form>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-xl font-semibold text-gray-800">Current Team</h2>
            <div className="space-y-3">
              {staff.length === 0 ? (
                <p className="text-sm text-gray-500">No team members yet.</p>
              ) : (
                staff.map((member) => (
                  <div key={member._id} className="rounded-xl border border-gray-200 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-gray-800">{member.name}</p>
                        <p className="text-sm text-gray-500">{member.email}</p>
                        <span className="mt-2 inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
                          {member.role}
                        </span>
                      </div>
                      <button onClick={() => handleDelete(member._id)} className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100">
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Team;
