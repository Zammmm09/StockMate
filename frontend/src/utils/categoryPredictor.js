const categorySignals = [
  {
    category: "Snacks/Biscuits",
    keywords: [
      "biscuit",
      "biscuits",
      "cookie",
      "cookies",
      "parle",
      "parle-g",
      "oreo",
      "hide seek",
      "lays",
      "kurkure",
      "chips",
      "namkeen",
      "snack",
      "snacks",
      "wafer",
      "wafers",
    ],
  },
  {
    category: "Beverages",
    keywords: [
      "tea",
      "coffee",
      "juice",
      "cola",
      "pepsi",
      "coke",
      "sprite",
      "fanta",
      "water",
      "drink",
      "beverage",
      "milkshake",
      "soda",
    ],
  },
  {
    category: "Dairy",
    keywords: [
      "milk",
      "curd",
      "paneer",
      "cheese",
      "butter",
      "ghee",
      "yogurt",
      "dahi",
      "cream",
    ],
  },
  {
    category: "Grains/Rice",
    keywords: [
      "rice",
      "basmati",
      "atta",
      "flour",
      "wheat",
      "maida",
      "suji",
      "rava",
      "dal",
      "lentil",
      "pulses",
      "grain",
    ],
  },
  {
    category: "Personal Care",
    keywords: [
      "soap",
      "shampoo",
      "toothpaste",
      "brush",
      "facewash",
      "cream",
      "lotion",
      "deodorant",
      "sanitizer",
      "conditioner",
    ],
  },
  {
    category: "Household/Cleaning",
    keywords: [
      "detergent",
      "phenyl",
      "cleaner",
      "dishwash",
      "harpic",
      "surf",
      "vim",
      "soapnut",
      "mop",
      "bleach",
      "floor",
    ],
  },
  {
    category: "Electronics",
    keywords: [
      "charger",
      "cable",
      "usb",
      "earphone",
      "headphone",
      "battery",
      "adapter",
      "speaker",
      "keyboard",
      "mouse",
      "led",
    ],
  },
  {
    category: "Stationery",
    keywords: [
      "pen",
      "pencil",
      "notebook",
      "register",
      "paper",
      "marker",
      "eraser",
      "sharpener",
      "file",
      "folder",
      "stapler",
    ],
  },
  {
    category: "Medicines/Health",
    keywords: [
      "tablet",
      "capsule",
      "syrup",
      "medicine",
      "bandage",
      "mask",
      "thermometer",
      "first aid",
      "pain",
      "vitamin",
    ],
  },
];

const normalize = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const getTokenWeight = (keyword) => {
  if (keyword.length >= 8) return 4;
  if (keyword.length >= 5) return 3;
  return 2;
};

export const predictCategory = ({ productName = "", sku = "" }) => {
  const input = normalize(`${productName} ${sku}`);

  if (!input) {
    return {
      category: "",
      confidence: 0,
      alternatives: [],
      reason: "",
    };
  }

  const scored = categorySignals
    .map(({ category, keywords }) => {
      const matches = keywords.filter((keyword) => {
        const normalizedKeyword = normalize(keyword);
        return input.includes(normalizedKeyword);
      });

      const score = matches.reduce(
        (total, keyword) => total + getTokenWeight(keyword),
        0
      );

      return { category, score, matches };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return {
      category: "General Merchandise",
      confidence: 35,
      alternatives: [],
      reason: "No strong category keywords matched.",
    };
  }

  const best = scored[0];
  const second = scored[1];
  const margin = second ? best.score - second.score : best.score;
  const confidence = Math.min(96, 55 + best.score * 8 + margin * 4);

  return {
    category: best.category,
    confidence,
    alternatives: scored.slice(1, 4).map((item) => item.category),
    reason: `Matched: ${best.matches.join(", ")}`,
  };
};
