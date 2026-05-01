import { createContext, useState, useEffect } from "react";

const ShopContext = createContext();

const normalizeShop = (shopData) => ({
  ...shopData,
  role: shopData?.role || "owner",
  parentShopId: shopData?.parentShopId || null,
});

export const ShopProvider = ({ children }) => {
  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load shop data from localStorage on mount
  useEffect(() => {
    const storedShop = localStorage.getItem("shop");
    if (storedShop) {
      try {
        setShop(normalizeShop(JSON.parse(storedShop)));
      } catch (error) {
        console.error("Error parsing shop data:", error);
        localStorage.removeItem("shop");
        localStorage.removeItem("token");
      }
    }
    setLoading(false);
  }, []);

  // Function to log in a shop (store token and shop info)
  const loginShop = (shopData, token) => {
    const normalizedShop = normalizeShop(shopData);
    localStorage.setItem("shop", JSON.stringify(normalizedShop));
    localStorage.setItem("token", token);
    setShop(normalizedShop);
  };

  // Function to log out the shop
  const logoutShop = () => {
    localStorage.removeItem("shop");
    localStorage.removeItem("token");
    setShop(null);
  };

  return (
    <ShopContext.Provider value={{ shop, loading, loginShop, logoutShop }}>
      {children}
    </ShopContext.Provider>
  );
};

export default ShopContext;
