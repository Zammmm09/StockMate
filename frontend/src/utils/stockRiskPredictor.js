const categoryVelocity = {
  "Snacks/Biscuits": 1.25,
  Beverages: 1.2,
  Dairy: 1.45,
  "Grains/Rice": 0.85,
  "Personal Care": 0.75,
  "Household/Cleaning": 0.7,
  Electronics: 0.35,
  Stationery: 0.55,
  "Medicines/Health": 0.9,
  "General Merchandise": 0.65,
};

const normalizeNumber = (value) => Number(value) || 0;

const getCategoryVelocity = (category = "") => {
  if (categoryVelocity[category]) return categoryVelocity[category];

  const matchedCategory = Object.keys(categoryVelocity).find((key) =>
    category.toLowerCase().includes(key.toLowerCase())
  );

  return matchedCategory ? categoryVelocity[matchedCategory] : categoryVelocity["General Merchandise"];
};

export const predictStockRisk = ({ quantity = 0, price = 0, category = "" }) => {
  const stock = normalizeNumber(quantity);
  const unitPrice = normalizeNumber(price);
  const velocity = getCategoryVelocity(category);
  const estimatedDailyDemand = Math.max(1, Math.round(velocity * 4));
  const daysOfStock = stock > 0 ? Math.round(stock / estimatedDailyDemand) : 0;

  let status = "Healthy";
  let severity = "low";
  let badgeClass = "bg-green-100 text-green-800";
  let recommendation = "Stock level looks stable.";

  if (stock === 0) {
    status = "Out of Stock";
    severity = "critical";
    badgeClass = "bg-red-100 text-red-800";
    recommendation = "Restock immediately.";
  } else if (daysOfStock <= 3) {
    status = "Urgent Restock";
    severity = "high";
    badgeClass = "bg-red-100 text-red-800";
    recommendation = "Place a reorder today.";
  } else if (daysOfStock <= 7) {
    status = "Reorder Soon";
    severity = "medium";
    badgeClass = "bg-yellow-100 text-yellow-800";
    recommendation = "Plan a reorder this week.";
  } else if (daysOfStock >= 45 && unitPrice >= 500) {
    status = "Overstock Watch";
    severity = "medium";
    badgeClass = "bg-orange-100 text-orange-800";
    recommendation = "Avoid buying more until stock moves.";
  }

  return {
    status,
    severity,
    badgeClass,
    recommendation,
    estimatedDailyDemand,
    daysOfStock,
  };
};
