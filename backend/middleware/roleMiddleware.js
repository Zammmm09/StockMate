const requireRoles = (...allowedRoles) => {
  return (req, res, next) => {
    const currentRole = req.shopRole || req.shop?.role || "owner";

    if (!allowedRoles.includes(currentRole)) {
      return res.status(403).json({
        message: "Forbidden: insufficient permissions",
      });
    }

    next();
  };
};

export default requireRoles;