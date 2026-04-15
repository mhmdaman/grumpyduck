// ─────────────────────────────────────────────────────────────
// Mock Order Service (port 3003)
// ─────────────────────────────────────────────────────────────

const express = require('express');
require('dotenv').config();
const app = express();
const PORT = process.env.ORDER_SERVICE_PORT || 3003;

app.use(express.json());

// In-memory order store
const orders = [];

// ─── POST /api/orders ───────────────────────────────────────
// All order routes require authentication (configured in service registry)
app.post('/api/orders', (req, res) => {
  const userId = req.headers['x-user-id'];
  const { productId, quantity } = req.body;

  if (!productId || !quantity) {
    return res.status(400).json({ error: 'productId and quantity are required' });
  }

  const order = {
    id: `order_${Date.now()}`,
    userId,
    productId,
    quantity: parseInt(quantity),
    status: 'pending',
    total: (Math.random() * 500 + 10).toFixed(2), // Simulated price
    createdAt: new Date().toISOString(),
  };

  orders.push(order);
  res.status(201).json({ message: 'Order created', order });
});

// ─── GET /api/orders ────────────────────────────────────────
// Returns orders for the authenticated user only
app.get('/api/orders', (req, res) => {
  const userId = req.headers['x-user-id'];
  const userOrders = userId ? orders.filter((o) => o.userId === userId) : orders;
  res.json({ orders: userOrders, total: userOrders.length });
});

// ─── GET /api/orders/:id ────────────────────────────────────
app.get('/api/orders/:id', (req, res) => {
  const order = orders.find((o) => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  // Ensure user can only see their own orders
  const userId = req.headers['x-user-id'];
  if (userId && order.userId !== userId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  res.json({ order });
});

// ─── PATCH /api/orders/:id/status ───────────────────────────
app.patch('/api/orders/:id/status', (req, res) => {
  const order = orders.find((o) => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  const { status } = req.body;
  const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }

  order.status = status;
  order.updatedAt = new Date().toISOString();
  res.json({ message: 'Order status updated', order });
});

// ─── DELETE /api/orders/:id ─────────────────────────────────
app.delete('/api/orders/:id', (req, res) => {
  const index = orders.findIndex((o) => o.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Order not found' });
  }

  const deleted = orders.splice(index, 1)[0];
  res.json({ message: 'Order cancelled', order: deleted });
});

// ─── Health Check ───────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'order-service', port: PORT });
});

app.listen(PORT, () => {
  console.log(`🛒 Order Service running on port ${PORT}`);
});

module.exports = app;
