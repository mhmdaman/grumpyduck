// ─────────────────────────────────────────────────────────────
// Mock Product Service (port 3002)
// ─────────────────────────────────────────────────────────────

const express = require('express');
require('dotenv').config();
const app = express();
const PORT = process.env.PRODUCT_SERVICE_PORT || 3002;

app.use(express.json());

// In-memory product store
const products = [
  { id: 'prod_1', name: 'Mechanical Keyboard', price: 149.99, category: 'Electronics', stock: 50 },
  { id: 'prod_2', name: 'Wireless Mouse', price: 49.99, category: 'Electronics', stock: 120 },
  { id: 'prod_3', name: 'USB-C Hub', price: 39.99, category: 'Accessories', stock: 200 },
  { id: 'prod_4', name: '4K Monitor', price: 399.99, category: 'Electronics', stock: 30 },
  { id: 'prod_5', name: 'Standing Desk', price: 599.99, category: 'Furniture', stock: 15 },
];

// ─── GET /api/products ──────────────────────────────────────
// Public route — anyone can browse products
app.get('/api/products', (req, res) => {
  const { category, minPrice, maxPrice } = req.query;
  let result = [...products];

  if (category) result = result.filter((p) => p.category === category);
  if (minPrice) result = result.filter((p) => p.price >= parseFloat(minPrice));
  if (maxPrice) result = result.filter((p) => p.price <= parseFloat(maxPrice));

  res.json({ products: result, total: result.length });
});

// ─── GET /api/products/:id ──────────────────────────────────
// Public route — view a single product
app.get('/api/products/:id', (req, res) => {
  const product = products.find((p) => p.id === req.params.id);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  res.json({ product });
});

// ─── POST /api/products ─────────────────────────────────────
// Protected route — only authenticated users can create products
app.post('/api/products', (req, res) => {
  const { name, price, category, stock } = req.body;

  if (!name || !price) {
    return res.status(400).json({ error: 'name and price are required' });
  }

  const product = {
    id: `prod_${Date.now()}`,
    name,
    price: parseFloat(price),
    category: category || 'Uncategorized',
    stock: stock || 0,
    createdBy: req.headers['x-user-id'] || 'unknown',
    createdAt: new Date().toISOString(),
  };

  products.push(product);
  res.status(201).json({ message: 'Product created', product });
});

// ─── PUT /api/products/:id ──────────────────────────────────
app.put('/api/products/:id', (req, res) => {
  const index = products.findIndex((p) => p.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Product not found' });
  }

  products[index] = { ...products[index], ...req.body, id: products[index].id };
  res.json({ message: 'Product updated', product: products[index] });
});

// ─── DELETE /api/products/:id ───────────────────────────────
app.delete('/api/products/:id', (req, res) => {
  const index = products.findIndex((p) => p.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Product not found' });
  }

  const deleted = products.splice(index, 1)[0];
  res.json({ message: 'Product deleted', product: deleted });
});

// ─── Health Check ───────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'product-service', port: PORT });
});

app.listen(PORT, () => {
  console.log(`📦 Product Service running on port ${PORT}`);
});

module.exports = app;
