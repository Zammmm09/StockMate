import express from 'express';
import Inventory from '../models/inventoryModel.js';
import Warehouse from '../models/warehouseModel.js';
import Shop from '../models/shopModel.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

// AI Chat endpoint
router.post('/', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    // Get shop ID from token if available
    let shopId = null;
    const token = req.headers.authorization?.split(' ')[1];
    
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'devsecret');
        // Token contains 'id' property, not 'shopId'
        shopId = decoded.id;
        console.log('Decoded shop ID:', shopId);
      } catch (err) {
        console.error('Token verification error:', err.message);
        // Token invalid or expired, continue without authentication
      }
    } else {
      console.log('No token provided');
    }

    // Fetch inventory and warehouse data if authenticated
    let inventoryData = [];
    let warehouseData = [];
    let shopData = null;

    if (shopId) {
      try {
        [inventoryData, warehouseData, shopData] = await Promise.all([
          Inventory.find({ shopId }).populate('warehouseId').limit(100),
          Warehouse.find({ shopId }),
          Shop.findById(shopId)
        ]);
      } catch (err) {
        console.error('Error fetching data:', err);
      }
    }

    // Generate context-aware response
    const reply = await generateSmartReply(message, inventoryData, warehouseData, shopData, shopId);

    res.json({ success: true, reply });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error processing your request',
      error: error.message 
    });
  }
});

// Smart reply generator with real data
async function generateSmartReply(message, inventory, warehouses, shop, shopId) {
  const lowerMessage = message.toLowerCase();
  const words = lowerMessage.split(/\s+/);

  // Helper function to check if message contains any of the keywords
  const containsAny = (keywords) => keywords.some(kw => lowerMessage.includes(kw));
  const containsAll = (keywords) => keywords.every(kw => lowerMessage.includes(kw));

  // ADD INVENTORY ITEM COMMAND - Interactive guided process
  if (containsAny(['add item', 'add product', 'create item', 'create product', 'new item', 'new product', 'product name:', 'item name:'])) {
    // Extract item details - Multiple pattern matching
    let productName = null;
    let sku = null;
    let quantity = null;
    let price = null;
    let category = null;
    let warehouseId = null;

    // Pattern 1: Structured format "Product Name: X, SKU: Y, Quantity: Z, Price: A, Category: B, Warehouse: C"
    const productMatch = message.match(/(?:product\s+name|item\s+name|name):\s*([^,\n]+?)(?:,|\s+(?:sku|quantity|price|category|warehouse)|$)/i);
    const skuMatch = message.match(/sku:\s*([A-Z0-9\-]+)/i);
    const quantityMatch = message.match(/(?:quantity|qty|amount):\s*(\d+)/i);
    const priceMatch = message.match(/(?:price|cost):\s*\$?(\d+(?:\.\d{1,2})?)/i);
    const categoryMatch = message.match(/category:\s*([^,\n]+?)(?:,|\s+warehouse|$)/i);
    const warehouseMatch = message.match(/warehouse:\s*([^,\n]+?)(?:,|$)/i);

    if (productMatch) productName = productMatch[1].trim();
    if (skuMatch) sku = skuMatch[1].trim().toUpperCase();
    if (quantityMatch) quantity = parseInt(quantityMatch[1]);
    if (priceMatch) price = parseFloat(priceMatch[1]);
    if (categoryMatch) category = categoryMatch[1].trim();
    if (warehouseMatch) {
      const warehouseName = warehouseMatch[1].trim();
      // Find warehouse by name
      const foundWarehouse = warehouses.find(w => w.name.toLowerCase() === warehouseName.toLowerCase());
      if (foundWarehouse) warehouseId = foundWarehouse._id;
    }

    // Pattern 2: Natural language
    if (!productName) {
      const nameMatch = message.match(/(?:called|named|product|item)\s+([A-Za-z0-9\s]+?)(?:\s+(?:sku|quantity|qty|price|category|warehouse|,|$))/i);
      if (nameMatch) productName = nameMatch[1].trim();
    }

    // If all details provided, create inventory item
    if (productName && sku && quantity !== null && price !== null && category && warehouseId) {
      // Validate inputs
      if (quantity < 0) {
        return `❌ Quantity must be 0 or greater.\n\nPlease provide a valid quantity.`;
      }
      if (price < 0) {
        return `❌ Price must be 0 or greater.\n\nPlease provide a valid price.`;
      }

      // Create the inventory item
      try {
        const newItem = await Inventory.create({
          shopId: shopId,
          warehouseId: warehouseId,
          productName: productName,
          sku: sku,
          quantity: quantity,
          price: price,
          category: category
        });

        const warehouse = warehouses.find(w => w._id.toString() === warehouseId.toString());
        
        return `✅ Product added to inventory successfully!\n\n📦 Product Details:\n• Name: ${newItem.productName}\n• SKU: ${newItem.sku}\n• Quantity: ${newItem.quantity} units\n• Price: $${newItem.price}\n• Category: ${newItem.category}\n• Warehouse: ${warehouse.name}\n• Created: Just now\n\n🎉 Your inventory has been updated!`;
      } catch (error) {
        console.error('Error creating inventory item:', error);
        if (error.code === 11000) {
          return `❌ A product with SKU "${sku}" already exists.\n\nPlease use a unique SKU or update the existing product.`;
        }
        return `❌ Oops! I couldn't add the product.\n\nError: ${error.message}\n\nPlease check the details and try again.`;
      }
    }

    // Guide user through providing missing information
    if (productName || sku || quantity !== null || price !== null || category || warehouseId) {
      let response = `I can help you add a product! I have:\n`;
      if (productName) response += `✅ Product Name: ${productName}\n`;
      if (sku) response += `✅ SKU: ${sku}\n`;
      if (quantity !== null) response += `✅ Quantity: ${quantity}\n`;
      if (price !== null) response += `✅ Price: $${price}\n`;
      if (category) response += `✅ Category: ${category}\n`;
      if (warehouseId) {
        const wh = warehouses.find(w => w._id.toString() === warehouseId.toString());
        response += `✅ Warehouse: ${wh.name}\n`;
      }
      
      response += `\nStill need:\n`;
      if (!productName) response += `❌ Product name (e.g., "Laptop", "T-Shirt")\n`;
      if (!sku) response += `❌ SKU code (e.g., "LAP-001", "TSH-BLK-M")\n`;
      if (quantity === null) response += `❌ Quantity (e.g., 100, 500)\n`;
      if (price === null) response += `❌ Price (e.g., 49.99, 1200)\n`;
      if (!category) response += `❌ Category (e.g., "Electronics", "Clothing")\n`;
      if (!warehouseId) {
        if (warehouses.length === 0) {
          response += `❌ Warehouse - You need to create a warehouse first! Say "add warehouse" to create one.\n`;
        } else {
          response += `❌ Warehouse name (Available: ${warehouses.map(w => w.name).join(', ')})\n`;
        }
      }
      
      response += `\n💡 Complete format:\n"Product Name: Laptop, SKU: LAP-001, Quantity: 50, Price: 999, Category: Electronics, Warehouse: ${warehouses.length > 0 ? warehouses[0].name : 'Main Storage'}"`;
      
      return response;
    }

    // No details provided - provide full guidance
    if (warehouses.length === 0) {
      return `To add products, you first need to create a warehouse! 🏢\n\nSay "add warehouse" and I'll guide you through creating one.`;
    }

    return `I'd be happy to help you add a product to inventory! 📦\n\nTo add a product, I need:\n\n1️⃣ **Product Name**\n   What is the product called?\n   Examples: "Laptop", "T-Shirt", "Coffee Mug"\n\n2️⃣ **SKU (Stock Keeping Unit)**\n   Unique product code\n   Examples: "LAP-001", "TSH-BLK-M", "MUG-WHT"\n\n3️⃣ **Quantity**\n   How many units?\n   Examples: 50, 100, 1000\n\n4️⃣ **Price**\n   Price per unit\n   Examples: 49.99, 15, 999.99\n\n5️⃣ **Category**\n   Product category\n   Examples: "Electronics", "Clothing", "Accessories"\n\n6️⃣ **Warehouse**\n   Which warehouse to store it in?\n   Available: ${warehouses.map(w => w.name).join(', ')}\n\n💡 **Tell me all at once:**\n"Product Name: Laptop, SKU: LAP-001, Quantity: 50, Price: 999, Category: Electronics, Warehouse: ${warehouses[0].name}"\n\nWhat would you like to add?`;
  }

  // ADD WAREHOUSE COMMAND - Interactive guided process
  if (containsAny(['add warehouse', 'create warehouse', 'new warehouse', 'make warehouse', 'build warehouse', 'warehouse name', 'warehouse:'])) {
    // Check if user just wants to add warehouse without details
    const hasDetails = lowerMessage.length > 20; // Simple heuristic
    
    // Extract warehouse details from the message - Multiple pattern matching
    let name = null;
    let location = null;
    let capacity = null;

    // Pattern 1: "Warehouse Name: X, Location: Y, Capacity: Z" (structured format)
    const structuredMatch = message.match(/(?:warehouse\s+)?name:\s*([^,\n]+?)(?:,|\s+location:)/i);
    const structuredLocation = message.match(/location:\s*([^,\n]+?)(?:,|\s+capacity:|\s*$)/i);
    const structuredCapacity = message.match(/capacity:\s*(\d+)/i);

    if (structuredMatch) name = structuredMatch[1].trim();
    if (structuredLocation) location = structuredLocation[1].trim();
    if (structuredCapacity) capacity = parseInt(structuredCapacity[1]);

    // Pattern 2: "called/named X at/in Y with/capacity Z" (natural language)
    if (!name) {
      const nameMatch = message.match(/(?:called|named|name:|warehouse:?)\s+([A-Za-z0-9\s]+?)(?:\s+(?:at|in|location|with|capacity|,|$))/i);
      if (nameMatch) name = nameMatch[1].trim();
    }

    if (!location) {
      const locationMatch = message.match(/(?:at|in|location:?)\s+([A-Za-z0-9\s,]+?)(?:\s+(?:with|capacity|,|$))/i);
      if (locationMatch) location = locationMatch[1].trim();
    }

    if (!capacity) {
      const capacityMatch = message.match(/(?:capacity|cap:?|size:?)\s+(\d+)/i);
      if (capacityMatch) capacity = parseInt(capacityMatch[1]);
    }

    // Pattern 3: Simple comma-separated values after keywords
    if (!name && !location && !capacity) {
      const parts = message.split(/,/).map(p => p.trim());
      if (parts.length >= 3) {
        // Try to identify which is which
        parts.forEach(part => {
          if (part.match(/name/i) && !name) {
            name = part.replace(/.*name:?\s*/i, '').trim();
          } else if (part.match(/location/i) && !location) {
            location = part.replace(/.*location:?\s*/i, '').trim();
          } else if (part.match(/capacity/i) && !capacity) {
            const capMatch = part.match(/(\d+)/);
            if (capMatch) capacity = parseInt(capMatch[1]);
          }
        });
      }
    }

    // If all details provided, create warehouse
    if (name && location && capacity) {
      // Validate capacity
      if (capacity < 1) {
        return `❌ Capacity must be a positive number greater than 0.\n\nPlease try again with a valid capacity, for example:\n"Warehouse Name: ${name}, Location: ${location}, Capacity: 1000"`;
      }

      // Create the warehouse
      try {
        const newWarehouse = await Warehouse.create({
          shopId: shopId,
          name: name,
          location: location,
          capacity: capacity
        });

        return `✅ Warehouse created successfully!\n\n📦 Details:\n• Name: ${newWarehouse.name}\n• Location: ${newWarehouse.location}\n• Capacity: ${newWarehouse.capacity} units\n• Created: Just now\n\n🎉 You can now assign inventory items to this warehouse from the Inventory page!`;
      } catch (error) {
        console.error('Error creating warehouse:', error);
        return `❌ Oops! I couldn't create the warehouse.\n\nError: ${error.message}\n\nPlease check the details and try again.`;
      }
    }

    // Guide user through providing missing information
    let missingInfo = [];
    if (!name) missingInfo.push('warehouse name');
    if (!location) missingInfo.push('location');
    if (!capacity) missingInfo.push('capacity');

    // Partial information provided - guide them on what's missing
    if (name || location || capacity) {
      let response = `I can help you create a warehouse! I have:\n`;
      if (name) response += `✅ Name: ${name}\n`;
      if (location) response += `✅ Location: ${location}\n`;
      if (capacity) response += `✅ Capacity: ${capacity} units\n`;
      
      response += `\nStill need:\n`;
      if (!name) response += `❌ Warehouse name (e.g., "Aurify Clothing", "Main Storage")\n`;
      if (!location) response += `❌ Location (e.g., "Nashik", "New York")\n`;
      if (!capacity) response += `❌ Capacity in units (e.g., 1000, 5000)\n`;
      
      response += `\n💡 You can provide it in any of these formats:\n\n📝 Format 1 (Structured):\n"Warehouse Name: Main Storage, Location: Nashik, Capacity: 1000"\n\n📝 Format 2 (Natural):\n"Add warehouse called Main Storage at Nashik with capacity 1000"\n\nJust tell me the missing information!`;
      
      return response;
    }

    // No details provided - provide full guidance
    return `I'd be happy to help you create a new warehouse! 🏢\n\nTo create a warehouse, I need three things:\n\n1️⃣ **Warehouse Name**\n   What would you like to call it?\n   Examples: "Aurify Clothing", "Main Storage", "Downtown Warehouse"\n\n2️⃣ **Location**\n   Where is the warehouse located?\n   Examples: "Nashik", "New York", "123 Main St, Boston"\n\n3️⃣ **Capacity**\n   How many units can it hold?\n   Examples: 1000, 5000, 10000\n\n💡 **Tell me in any format:**\n\n📝 Option 1 (Structured):\n"Warehouse Name: Aurify Clothing, Location: Nashik, Capacity: 1000"\n\n📝 Option 2 (Natural language):\n"Add warehouse called Main Storage at New York with capacity 5000"\n\n📝 Option 3 (Simple):\n"Create warehouse Downtown at Boston capacity 3000"\n\nWhat would you like to do?`;
  }

  // Greeting responses
  if (containsAny(['hello', 'hi', 'hey', 'greetings', 'good morning', 'good afternoon', 'good evening'])) {
    return `Hello! I'm your StockMate AI assistant. I have access to your inventory and warehouse data. How can I help you today?`;
  }

  // Gratitude responses
  if (containsAny(['thank', 'thanks', 'appreciate'])) {
    return `You're welcome! Let me know if you need anything else with your inventory management!`;
  }

  // Help requests
  if (containsAny(['help', 'what can you do', 'capabilities', 'features', 'assist'])) {
    return `I can help you with:\n\n📦 Inventory Management:\n• "How many products do I have?"\n• "Show me low stock items"\n• "Find [product name]"\n• "Add product/item"\n\n🏢 Warehouse Management:\n• "List my warehouses"\n• "Add warehouse"\n\n📊 Smart Analytics:\n• "Generate inventory report"\n• "Show profit margins"\n• "Inventory turnover rate"\n• "Predict reorder for [product]"\n• "Items by category"\n• "Top performing products"\n\nI can create warehouses, add items, and provide detailed analytics! Just ask me anything!`;
  }

  // SMART ANALYTICS - Inventory Report
  if (containsAny(['inventory report', 'generate report', 'full report', 'detailed report', 'stock report'])) {
    if (inventory.length === 0) {
      return "You don't have any inventory items yet. Add some products first to generate a report!";
    }

    const totalQty = inventory.reduce((sum, item) => sum + item.quantity, 0);
    const totalValue = inventory.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    const avgPrice = totalValue / totalQty;
    const lowStock = inventory.filter(item => item.quantity < 10).length;
    
    // Category breakdown
    const categories = {};
    inventory.forEach(item => {
      if (!categories[item.category]) {
        categories[item.category] = { count: 0, value: 0, qty: 0 };
      }
      categories[item.category].count++;
      categories[item.category].value += item.quantity * item.price;
      categories[item.category].qty += item.quantity;
    });

    let categoryBreakdown = Object.entries(categories)
      .sort((a, b) => b[1].value - a[1].value)
      .map(([cat, data]) => `  • ${cat}: ${data.count} items, ${data.qty} units, $${data.value.toFixed(2)}`)
      .join('\n');

    // Top 5 most valuable items
    const topItems = [...inventory]
      .sort((a, b) => (b.quantity * b.price) - (a.quantity * a.price))
      .slice(0, 5)
      .map((item, i) => `  ${i + 1}. ${item.productName}: ${item.quantity} × $${item.price} = $${(item.quantity * item.price).toFixed(2)}`)
      .join('\n');

    const reportDate = new Date().toLocaleDateString();
    
    return `📊 INVENTORY REPORT\nGenerated: ${reportDate}\n\n━━━━━━━━━━━━━━━━━━━━━━\n📦 OVERVIEW\n━━━━━━━━━━━━━━━━━━━━━━\n• Total Products: ${inventory.length}\n• Total Units: ${totalQty}\n• Total Value: $${totalValue.toFixed(2)}\n• Average Price/Unit: $${avgPrice.toFixed(2)}\n• Low Stock Items: ${lowStock}\n• Warehouses: ${warehouses.length}\n\n━━━━━━━━━━━━━━━━━━━━━━\n📂 BY CATEGORY\n━━━━━━━━━━━━━━━━━━━━━━\n${categoryBreakdown}\n\n━━━━━━━━━━━━━━━━━━━━━━\n💰 TOP 5 VALUABLE ITEMS\n━━━━━━━━━━━━━━━━━━━━━━\n${topItems}\n\n━━━━━━━━━━━━━━━━━━━━━━`;
  }

  // SMART ANALYTICS - Profit Margin Calculations
  if (containsAny(['profit margin', 'profit analysis', 'margin analysis', 'profitability'])) {
    if (inventory.length === 0) {
      return "You don't have any inventory items yet. Add products to analyze profit margins!";
    }

    // Note: Since we don't have cost data, we'll use a standard 40% markup assumption
    // In a real system, you'd store cost separately from selling price
    
    let analysis = `💰 PROFIT MARGIN ANALYSIS\n\n`;
    analysis += `Note: Profit calculations assume a 40% markup on cost.\nFor accurate margins, track product cost separately.\n\n`;
    
    const itemsWithMargin = inventory.map(item => {
      const estimatedCost = item.price / 1.4; // Assuming 40% markup
      const profitPerUnit = item.price - estimatedCost;
      const totalProfit = profitPerUnit * item.quantity;
      const marginPercent = ((profitPerUnit / item.price) * 100).toFixed(1);
      
      return {
        ...item,
        estimatedCost,
        profitPerUnit,
        totalProfit,
        marginPercent: parseFloat(marginPercent)
      };
    });

    // Highest margin items
    const highMargin = [...itemsWithMargin]
      .sort((a, b) => b.marginPercent - a.marginPercent)
      .slice(0, 5)
      .map((item, i) => `  ${i + 1}. ${item.productName}: ${item.marginPercent}% margin, $${item.profitPerUnit.toFixed(2)}/unit`)
      .join('\n');

    // Most profitable items (by total profit)
    const mostProfitable = [...itemsWithMargin]
      .sort((a, b) => b.totalProfit - a.totalProfit)
      .slice(0, 5)
      .map((item, i) => `  ${i + 1}. ${item.productName}: $${item.totalProfit.toFixed(2)} total profit`)
      .join('\n');

    const totalEstimatedProfit = itemsWithMargin.reduce((sum, item) => sum + item.totalProfit, 0);
    const avgMargin = itemsWithMargin.reduce((sum, item) => sum + item.marginPercent, 0) / itemsWithMargin.length;

    analysis += `📈 OVERALL METRICS\n• Total Estimated Profit: $${totalEstimatedProfit.toFixed(2)}\n• Average Margin: ${avgMargin.toFixed(1)}%\n\n`;
    analysis += `🏆 HIGHEST MARGIN PRODUCTS\n${highMargin}\n\n`;
    analysis += `💎 MOST PROFITABLE PRODUCTS\n${mostProfitable}`;

    return analysis;
  }

  // SMART ANALYTICS - Inventory Turnover Rate
  if (containsAny(['turnover', 'turnover rate', 'inventory turnover', 'stock turnover', 'rotation'])) {
    if (inventory.length === 0) {
      return "You don't have any inventory items yet. Add products to analyze turnover rates!";
    }

    // Note: True turnover requires sales data over time
    // Here we'll provide insights based on current stock levels
    
    let analysis = `📉 INVENTORY TURNOVER ANALYSIS\n\n`;
    analysis += `Note: Accurate turnover requires sales/COGS data over time.\nThis analysis shows current stock velocity indicators.\n\n`;

    // Calculate days of supply based on quantity (lower qty = faster turnover)
    const itemsByVelocity = inventory.map(item => {
      // Estimate: items with lower quantity might be faster moving
      const velocityScore = item.quantity < 20 ? 'High' : item.quantity < 100 ? 'Medium' : 'Low';
      const daysOfSupply = item.quantity < 20 ? '< 30 days' : item.quantity < 100 ? '30-90 days' : '> 90 days';
      
      return {
        ...item,
        velocityScore,
        daysOfSupply
      };
    });

    const highVelocity = itemsByVelocity.filter(i => i.velocityScore === 'High');
    const mediumVelocity = itemsByVelocity.filter(i => i.velocityScore === 'Medium');
    const lowVelocity = itemsByVelocity.filter(i => i.velocityScore === 'Low');

    analysis += `🚀 VELOCITY DISTRIBUTION\n`;
    analysis += `• High Velocity (Fast-moving): ${highVelocity.length} items\n`;
    analysis += `• Medium Velocity: ${mediumVelocity.length} items\n`;
    analysis += `• Low Velocity (Slow-moving): ${lowVelocity.length} items\n\n`;

    if (highVelocity.length > 0) {
      const top = highVelocity.slice(0, 5).map((item, i) => 
        `  ${i + 1}. ${item.productName}: ${item.quantity} units (${item.daysOfSupply})`
      ).join('\n');
      analysis += `⚡ FAST-MOVING ITEMS (Consider Reordering)\n${top}\n\n`;
    }

    if (lowVelocity.length > 0) {
      const slow = lowVelocity.slice(0, 5).map((item, i) => 
        `  ${i + 1}. ${item.productName}: ${item.quantity} units (${item.daysOfSupply})`
      ).join('\n');
      analysis += `🐌 SLOW-MOVING ITEMS (Consider Promotions)\n${slow}\n\n`;
    }

    analysis += `💡 RECOMMENDATIONS\n`;
    analysis += `• Monitor fast-moving items to prevent stockouts\n`;
    analysis += `• Consider promotions for slow-moving inventory\n`;
    analysis += `• Track sales data to calculate actual turnover ratio`;

    return analysis;
  }

  // SMART ANALYTICS - Reorder Predictions
  if (containsAny(['predict reorder', 'when to reorder', 'reorder prediction', 'restock prediction', 'reorder for'])) {
    if (inventory.length === 0) {
      return "You don't have any inventory items yet. Add products to get reorder predictions!";
    }

    // Extract product name if specified
    let targetProduct = null;
    const productMatch = message.match(/(?:for|predict|reorder)\s+(.+?)(?:\s*$)/i);
    if (productMatch) {
      const searchTerm = productMatch[1].trim().toLowerCase();
      targetProduct = inventory.find(item => 
        item.productName.toLowerCase().includes(searchTerm) ||
        item.sku.toLowerCase() === searchTerm.toLowerCase()
      );
    }

    if (targetProduct) {
      // Detailed prediction for specific product
      const safetyStock = Math.ceil(targetProduct.quantity * 0.2); // 20% safety stock
      const reorderPoint = safetyStock + 10; // Simple reorder point
      const suggestedOrderQty = Math.ceil(targetProduct.quantity * 0.5); // 50% of current
      
      const daysUntilReorder = targetProduct.quantity <= reorderPoint ? 0 : 
        targetProduct.quantity < 50 ? 7 : targetProduct.quantity < 100 ? 14 : 30;

      let urgency = 'Low';
      if (targetProduct.quantity <= reorderPoint) urgency = '🔴 CRITICAL';
      else if (targetProduct.quantity < 30) urgency = '🟡 Medium';
      else urgency = '🟢 Low';

      return `📊 REORDER PREDICTION\n\n📦 Product: ${targetProduct.productName}\n🏷️ SKU: ${targetProduct.sku}\n📍 Current Stock: ${targetProduct.quantity} units\n\n━━━━━━━━━━━━━━━━━━━━━━\n⚠️ Urgency Level: ${urgency}\n━━━━━━━━━━━━━━━━━━━━━━\n\n📈 RECOMMENDATIONS\n• Reorder Point: ${reorderPoint} units\n• Safety Stock: ${safetyStock} units\n• Suggested Order Qty: ${suggestedOrderQty} units\n• Estimated Days Until Reorder: ${daysUntilReorder} days\n\n💡 ${targetProduct.quantity <= reorderPoint ? 'ACTION REQUIRED: Place order now!' : targetProduct.quantity < 30 ? 'PLAN AHEAD: Order within a week' : 'MONITOR: No immediate action needed'}`;
    }

    // General reorder analysis for all products
    const needsReorder = inventory.filter(item => item.quantity < 20);
    const upcoming = inventory.filter(item => item.quantity >= 20 && item.quantity < 50);

    let analysis = `📊 REORDER PREDICTIONS\n\n`;
    
    if (needsReorder.length > 0) {
      analysis += `🔴 IMMEDIATE REORDER NEEDED (${needsReorder.length} items)\n`;
      needsReorder.slice(0, 5).forEach((item, i) => {
        const suggestedQty = Math.ceil(item.quantity * 2);
        analysis += `  ${i + 1}. ${item.productName} (${item.quantity} left) - Order ${suggestedQty} units\n`;
      });
      analysis += `\n`;
    }

    if (upcoming.length > 0) {
      analysis += `🟡 PLAN TO REORDER SOON (${upcoming.length} items)\n`;
      upcoming.slice(0, 5).forEach((item, i) => {
        analysis += `  ${i + 1}. ${item.productName}: ${item.quantity} units (~7-14 days)\n`;
      });
      analysis += `\n`;
    }

    if (needsReorder.length === 0 && upcoming.length === 0) {
      analysis += `🟢 ALL ITEMS WELL STOCKED\nNo immediate reorder needed!\n\n`;
    }

    analysis += `💡 TIP: Say "predict reorder for [product name]" for detailed predictions!`;

    return analysis;
  }

  // Product count queries (flexible patterns)
  if ((containsAny(['how many', 'number of', 'count', 'total']) && containsAny(['product', 'item', 'sku'])) ||
      containsAny(['product count', 'item count', 'inventory size'])) {
    const count = inventory.length;
    if (count === 0) {
      return "You currently have 0 products in your inventory. To get started, go to the Inventory page and click 'Add Item' to add your first product!";
    }
    return `You have ${count} product${count !== 1 ? 's' : ''} in your inventory.`;
  }

  // Inventory value queries
  if ((containsAny(['total', 'overall', 'entire']) && containsAny(['value', 'worth', 'price', 'cost'])) ||
      containsAny(['inventory value', 'stock value', 'how much is', 'what is the value'])) {
    if (inventory.length === 0) {
      return "Your inventory is empty. Start by adding products from the Inventory page!";
    }
    const totalQty = inventory.reduce((sum, item) => sum + item.quantity, 0);
    const totalValue = inventory.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    return `Your total inventory is worth $${totalValue.toFixed(2)} with ${totalQty} units across ${inventory.length} products.`;
  }

  // Low stock alerts (flexible patterns)
  if (containsAny(['low stock', 'running low', 'need reorder', 'restock', 'shortage', 'almost empty', 'out of stock'])) {
    const lowStock = inventory.filter(item => item.quantity < 10);
    if (lowStock.length === 0) {
      return "Good news! No items are running low on stock right now. All your products are well stocked! ✅";
    }
    const items = lowStock.slice(0, 5).map(item => `• ${item.productName} (${item.quantity} left)`).join('\n');
    return `⚠️ You have ${lowStock.length} item${lowStock.length !== 1 ? 's' : ''} running low:\n${items}${lowStock.length > 5 ? '\n...and more.' : ''}`;
  }

  // Most expensive items
  if (containsAny(['most expensive', 'highest price', 'costliest', 'priciest', 'top price'])) {
    if (inventory.length === 0) return "You don't have any products in inventory yet.";
    const expensive = [...inventory].sort((a, b) => b.price - a.price).slice(0, 5);
    const items = expensive.map((item, i) => `${i + 1}. ${item.productName} - $${item.price}`).join('\n');
    return `💰 Your most expensive items:\n${items}`;
  }

  // Cheapest items
  if (containsAny(['cheapest', 'lowest price', 'most affordable', 'least expensive', 'budget'])) {
    if (inventory.length === 0) return "You don't have any products in inventory yet.";
    const cheap = [...inventory].sort((a, b) => a.price - b.price).slice(0, 5);
    const items = cheap.map((item, i) => `${i + 1}. ${item.productName} - $${item.price}`).join('\n');
    return `💵 Your most affordable items:\n${items}`;
  }

  // Average price
  if (containsAny(['average price', 'mean price', 'typical price', 'average cost'])) {
    if (inventory.length === 0) return "You don't have any products in inventory yet.";
    const avgPrice = inventory.reduce((sum, item) => sum + item.price, 0) / inventory.length;
    return `The average product price in your inventory is $${avgPrice.toFixed(2)}.`;
  }

  // Search for specific product
  if (containsAny(['find', 'search', 'look for', 'locate', 'show me', 'do i have', 'tell me about'])) {
    // Extract potential product name (words after keywords)
    const searchKeywords = ['find', 'search', 'look for', 'locate', 'show me', 'do i have', 'tell me about'];
    let searchTerm = '';
    
    for (const kw of searchKeywords) {
      const idx = lowerMessage.indexOf(kw);
      if (idx !== -1) {
        searchTerm = message.substring(idx + kw.length).trim();
        break;
      }
    }
    
    // Remove common words
    searchTerm = searchTerm.replace(/\b(product|item|called|named|the|a|an)\b/gi, '').trim();
    
    if (searchTerm.length > 2) {
      const found = inventory.filter(item => 
        item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchTerm.toLowerCase())
      );
      
      if (found.length > 0) {
        const details = found.slice(0, 5).map(item => 
          `• ${item.productName}\n  SKU: ${item.sku} | Qty: ${item.quantity} | Price: $${item.price} | Category: ${item.category}`
        ).join('\n\n');
        return `🔍 Found ${found.length} matching product${found.length !== 1 ? 's' : ''}:\n\n${details}${found.length > 5 ? '\n\n...and more results.' : ''}`;
      }
      return `❌ No products found matching "${searchTerm}". Try a different search term or check your spelling.`;
    }
  }

  // Category queries
  if (containsAny(['categor', 'type', 'classification', 'group'])) {
    if (inventory.length === 0) return "You don't have any products in inventory yet.";
    const categories = {};
    inventory.forEach(item => {
      categories[item.category] = (categories[item.category] || 0) + 1;
    });
    const catList = Object.entries(categories)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, count]) => `• ${cat}: ${count} item${count !== 1 ? 's' : ''}`)
      .join('\n');
    return `📂 Your inventory by category:\n${catList}`;
  }

  // Warehouse count and list
  if (containsAny(['warehouse', 'storage', 'location']) && containsAny(['how many', 'list', 'show', 'tell me'])) {
    if (warehouses.length === 0) return "You don't have any warehouses set up yet. Create one from the Warehouses page!";
    const list = warehouses.map((w, i) => `${i + 1}. ${w.name} - ${w.location} (Capacity: ${w.capacity})`).join('\n');
    return `🏢 You have ${warehouses.length} warehouse${warehouses.length !== 1 ? 's' : ''}:\n${list}`;
  }

  // Warehouse capacity
  if (containsAny(['capacity', 'space', 'room']) && containsAny(['warehouse', 'storage'])) {
    if (warehouses.length === 0) return "You don't have any warehouses set up yet.";
    const totalCapacity = warehouses.reduce((sum, w) => sum + w.capacity, 0);
    const totalUsed = inventory.reduce((sum, item) => sum + item.quantity, 0);
    const percentUsed = totalCapacity > 0 ? ((totalUsed / totalCapacity) * 100).toFixed(1) : 0;
    return `📦 Warehouse capacity:\n• Total capacity: ${totalCapacity} units\n• Currently used: ${totalUsed} units\n• Usage: ${percentUsed}%`;
  }

  // Empty warehouses
  if (containsAny(['empty', 'unused', 'vacant']) && containsAny(['warehouse', 'storage'])) {
    const warehouseItems = {};
    inventory.forEach(item => {
      const whId = item.warehouseId?._id?.toString() || item.warehouseId?.toString();
      warehouseItems[whId] = (warehouseItems[whId] || 0) + 1;
    });
    const empty = warehouses.filter(w => !warehouseItems[w._id.toString()]);
    if (empty.length === 0) return "All your warehouses have inventory items stored in them! ✅";
    const list = empty.map(w => `• ${w.name} (${w.location})`).join('\n');
    return `📭 ${empty.length} warehouse${empty.length !== 1 ? 's are' : ' is'} empty:\n${list}`;
  }

  // Shop/Business information
  if (shop && containsAny(['my shop', 'my business', 'shop name', 'business name', 'my store', 'company info'])) {
    return `🏪 Your Shop Information:\n• Name: ${shop.name}\n• Location: ${shop.address}\n• Email: ${shop.email}\n• Phone: ${shop.phone}`;
  }

  // Statistics and overview
  if (containsAny(['stat', 'overview', 'summary', 'dashboard', 'report', 'analytics', 'performance'])) {
    const totalProducts = inventory.length;
    const totalWarehouses = warehouses.length;
    
    if (totalProducts === 0 && totalWarehouses === 0) {
      return `📊 Your StockMate Summary:\n• Products: 0\n• Warehouses: 0\n\n🚀 Getting Started:\n1. Create a warehouse from the Warehouses page\n2. Add products from the Inventory page\n3. Start managing your stock!`;
    }
    
    if (totalProducts === 0) {
      return `📊 Your StockMate Summary:\n• Products: 0\n• Warehouses: ${totalWarehouses}\n\n✅ You have warehouses set up!\nNow add some products from the Inventory page to start tracking your stock.`;
    }
    
    const totalValue = inventory.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    const totalQty = inventory.reduce((sum, item) => sum + item.quantity, 0);
    const avgPrice = totalQty > 0 ? (totalValue / totalQty).toFixed(2) : '0.00';
    const lowStock = inventory.filter(item => item.quantity < 10).length;
    
    return `📊 Your StockMate Summary:\n\n📦 Inventory:\n• ${totalProducts} product${totalProducts !== 1 ? 's' : ''}\n• ${totalQty} total units\n• $${totalValue.toFixed(2)} total value\n• $${avgPrice} average price per unit\n${lowStock > 0 ? `• ⚠️ ${lowStock} item${lowStock !== 1 ? 's' : ''} low on stock\n` : ''}\n🏢 Warehouses: ${totalWarehouses}`;
  }

  // What to do / Getting started
  if (containsAny(['what should i do', 'how to start', 'getting started', 'what now', 'next steps', 'what first'])) {
    if (inventory.length === 0 && warehouses.length === 0) {
      return `🚀 Here's how to get started with StockMate:\n\n1️⃣ Create your first warehouse:\n   • Go to the Warehouses page\n   • Click "Add Warehouse"\n   • Enter warehouse details\n\n2️⃣ Add your first product:\n   • Go to the Inventory page\n   • Click "Add Item"\n   • Fill in product details\n\n3️⃣ Start tracking:\n   • Monitor stock levels\n   • Get low stock alerts\n   • Analyze your inventory data`;
    }
    return `💡 Here's what you can do:\n• View and manage your ${inventory.length} product${inventory.length !== 1 ? 's' : ''}\n• Monitor your ${warehouses.length} warehouse${warehouses.length !== 1 ? 's' : ''}\n• Track stock levels and get alerts\n• Analyze inventory data and trends\n\nJust ask me any questions!`;
  }

  // Intelligent fallback - try to understand user intent
  const fallbackResponses = {
    inventory: `I can help with inventory questions! Try asking:\n• "How many products do I have?"\n• "What's my total inventory value?"\n• "Show me low stock items"\n• "Find [product name]"`,
    warehouse: `I can help with warehouse questions! Try asking:\n• "List my warehouses"\n• "Which warehouses are empty?"\n• "What's my warehouse capacity?"`,
    help: `I'm your AI assistant with access to your real data! I understand natural language questions like:\n\n💬 Examples:\n• "How many items do I have?"\n• "What's my most expensive product?"\n• "Show me products running low"\n• "Find laptop"\n• "Give me an overview"\n• "List my warehouses"\n\nJust ask me anything!`,
    default: `I'm not sure I understood that. I can help you with:\n\n📦 Inventory: product counts, values, stock levels, search\n🏢 Warehouses: capacity, locations, empty warehouses\n📊 Analytics: overviews, statistics, reports\n\nTry asking a specific question or type "help" for examples!`
  };

  // Simple keyword-based fallback
  if (containsAny(['inventory', 'product', 'item', 'stock'])) {
    return fallbackResponses.inventory;
  }

  if (containsAny(['warehouse', 'storage', 'location'])) {
    return fallbackResponses.warehouse;
  }

  // Default response for unclear queries
  return fallbackResponses.default;
}

export default router;
