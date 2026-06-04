import express from "express";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";
import compression from "compression";

dotenv.config();

const app = express();

app.use(compression());

app.use(cors());
app.use(express.json());

// ✅ Load environment variables
const ACCOUNT_NUMBER = process.env.ACCOUNT_NUMBER;
const API_KEY = process.env.API_KEY;

if (!ACCOUNT_NUMBER || !API_KEY) {
  console.error(
    "❌ Missing API credentials. Make sure ACCOUNT_NUMBER and API_KEY are set in Render."
  );
  process.exit(1);
}

// =====================================================
// CACHE HELPERS
// =====================================================

const CACHE_TTL = 1000 * 60 * 30; // 30 minutes

const cache = {
  brands: { data: null, timestamp: 0 },
  products: { data: null, timestamp: 0 },
  styles: { data: null, timestamp: 0 },
};

function isFresh(entry) {
  return entry.data && Date.now() - entry.timestamp < CACHE_TTL;
}

function getAuthHeaders() {
  const authString = `${ACCOUNT_NUMBER}:${API_KEY}`;
  const authHeader = "Basic " + Buffer.from(authString).toString("base64");

  return {
    Authorization: authHeader,
    "Content-Type": "application/json",
  };
}

async function fetchFromSS(url) {
  const response = await fetch(url, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`S&S API Error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

async function getCachedBrands() {
  if (isFresh(cache.brands)) {
    console.log("⚡ Serving brands from cache");
    return cache.brands.data;
  }

  console.log("🔍 Fetching brands from S&S API...");

  const data = await fetchFromSS("https://api-ca.ssactivewear.com/v2/Brands");

  cache.brands = {
    data,
    timestamp: Date.now(),
  };

  return data;
}

async function getCachedProducts() {
  if (isFresh(cache.products)) {
    console.log("⚡ Serving products from cache");
    return cache.products.data;
  }

  console.log("🔍 Fetching products from S&S API...");

  const data = await fetchFromSS("https://api-ca.ssactivewear.com/v2/products");

  cache.products = {
    data,
    timestamp: Date.now(),
  };

  return data;
}

async function getCachedStyles() {
  if (isFresh(cache.styles)) {
    console.log("⚡ Serving styles from cache");
    return cache.styles.data;
  }

  console.log("🔍 Fetching styles from S&S API...");

  const data = await fetchFromSS("https://api-ca.ssactivewear.com/v2/styles");

  cache.styles = {
    data,
    timestamp: Date.now(),
  };

  return data;
}

// =====================================================
// STATIC FRONTEND
// =====================================================

app.use(express.static(path.join(process.cwd(), "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "index.html"));
});

// =====================================================
// API ROUTES
// =====================================================

app.get("/brands", async (req, res) => {
  try {
    const brands = await getCachedBrands();

    console.log(`✅ Total Brands Available: ${brands.length}`);

    res.json({ brands });
  } catch (error) {
    console.error("❌ Error fetching brands:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/products/:brandId", async (req, res) => {
  try {
    const { brandId } = req.params;

    console.log("🔍 Filtering products for brand:", brandId);

    const allProducts = await getCachedProducts();

    console.log(`✅ Total Products Available: ${allProducts.length}`);

    const matchingProducts = allProducts.filter(
      (product) => product.brandID == brandId
    );

    if (matchingProducts.length === 0) {
      console.warn(`⚠️ No products found for brand ${brandId}.`);
    } else {
      console.log(`✅ Found ${matchingProducts.length} products.`);
    }

    const grouped = new Map();

    matchingProducts.forEach((product) => {
      const { styleID } = product;

      if (!grouped.has(styleID)) {
        grouped.set(styleID, {
          styleID: product.styleID,
          brandName: product.brandName,
          styleName: product.styleName,
          piecePrice: product.piecePrice,
          colorFrontImage: product.colorFrontImage,
          styleImage: product.styleImage,
          sku: product.styleCode || product.productCode || "N/A",
          variants: [],
        });
      }

      grouped.get(styleID).variants.push({
        colorName: product.colorName,
        colorFrontImage: product.colorFrontImage,
        colorBackImage: product.colorBackImage,
        colorSideImage: product.colorSideImage,
        colorOnModelFrontImage: product.colorOnModelFrontImage,
        colorOnModelSideImage: product.colorOnModelSideImage,
        colorOnModelBackImage: product.colorOnModelBackImage,
        colorSwatchImage: product.colorSwatchImage,
        colorHex: product.color1 || "#CCCCCC",
        color1: product.color1,
        sizeName: product.sizeName,
        sizeCode: product.sizeCode,
        piecePrice: product.piecePrice,
        qty: product.qty,
      });
    });

    const finalProducts = Array.from(grouped.values());

    res.json({ brandId, products: finalProducts });
  } catch (error) {
    console.error("❌ Error fetching products:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/styles", async (req, res) => {
  try {
    const styles = await getCachedStyles();
    const products = await getCachedProducts();

    console.log(`✅ Total Styles Available: ${styles.length}`);
    console.log(`✅ Total Products Available: ${products.length}`);

    const stylesWithPrices = styles.map((style) => {
      const matchingProduct = products.find(
        (product) => product.styleID === style.styleID
      );

      return {
        ...style,
        description: style.description || "No description available.",
        piecePrice: matchingProduct ? matchingProduct.piecePrice : null,
      };
    });

    res.json({ styles: stylesWithPrices });
  } catch (error) {
    console.error("❌ Error fetching styles:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/styles/:id", async (req, res) => {
  try {
    const styleID = req.params.id;

    console.log(`📡 Fetching styleID: ${styleID}`);

    const styleRes = await fetch(
      `https://api-ca.ssactivewear.com/v2/styles/${styleID}`,
      {
        headers: getAuthHeaders(),
      }
    );

    if (!styleRes.ok) {
      throw new Error(`❌ Style fetch failed: ${styleRes.status}`);
    }

    const styleRaw = await styleRes.json();
    const style = Array.isArray(styleRaw) ? styleRaw[0] : styleRaw;

    if (!style) {
      throw new Error("❌ Style data is empty");
    }

    const allProducts = await getCachedProducts();

    const variants = allProducts.filter(
      (product) => product.styleID === parseInt(styleID)
    );

    console.log(
      `✅ Found ${variants.length} cached variant records for style ${styleID}`
    );

    res.json({ ...style, variants });
  } catch (error) {
    console.error("❌ /styles/:id error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/categories", async (req, res) => {
  try {
    const styles = await getCachedStyles();

    console.log(`✅ Total Styles Available: ${styles.length}`);

    const uniqueCategories = [...new Set(styles.map((style) => style.baseCategory))]
      .filter(Boolean)
      .map((category) => ({ name: category }));

    res.json({ categories: uniqueCategories });
  } catch (error) {
    console.error("❌ Error fetching categories:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ✅ Category filtering route
app.get("/category-products/:categoryId", async (req, res) => {
  try {
    const { categoryId } = req.params;

    console.log("🔍 Filtering products for category/style/brand:", categoryId);

    const allProducts = await getCachedProducts();

    const matchingProducts = allProducts.filter(
      (product) =>
        product.baseCategoryID == categoryId ||
        product.styleID == categoryId ||
        product.brandID == categoryId
    );

    if (matchingProducts.length === 0) {
      console.warn(`⚠️ No products found for category ${categoryId}.`);
    } else {
      console.log(
        `✅ Found ${matchingProducts.length} products in category ${categoryId}.`
      );
    }

    const grouped = new Map();

    matchingProducts.forEach((product) => {
      const { styleID } = product;

      if (!grouped.has(styleID)) {
        grouped.set(styleID, {
          styleID: product.styleID,
          brandName: product.brandName,
          styleName: product.styleName,
          piecePrice: product.piecePrice,
          colorFrontImage: product.colorFrontImage,
          styleImage: product.styleImage,
          variants: [],
        });
      }

      grouped.get(styleID).variants.push({
        colorName: product.colorName,
        colorFrontImage: product.colorFrontImage,
        colorBackImage: product.colorBackImage,
        colorSideImage: product.colorSideImage,
        colorOnModelFrontImage: product.colorOnModelFrontImage,
        colorOnModelSideImage: product.colorOnModelSideImage,
        colorOnModelBackImage: product.colorOnModelBackImage,
        colorSwatchImage: product.colorSwatchImage,
        color1: product.color1,
        sizeName: product.sizeName,
        sizeCode: product.sizeCode,
        piecePrice: product.piecePrice,
        qty: product.qty,
      });
    });

    const finalProducts = Array.from(grouped.values());

    res.json({ categoryId, products: finalProducts });
  } catch (error) {
    console.error("❌ Error fetching category products:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ✅ Keep this legacy route for compatibility
app.get("/styles/category/:category", async (req, res) => {
  try {
    const category = decodeURIComponent(req.params.category);

    console.log(`🔍 Filtering styles for category: ${category}`);

    const styles = await getCachedStyles();

    const filteredStyles = styles.filter(
      (style) => style.baseCategory === category
    );

    console.log(`✅ Found ${filteredStyles.length} styles for category ${category}`);

    res.json({ styles: filteredStyles });
  } catch (error) {
    console.error("❌ Error fetching styles by category:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
// START SERVER
// =====================================================

// =====================================================
// WARM CACHE ON STARTUP
// =====================================================

(async () => {
  try {
    console.log("🔥 Warming cache...");

    await Promise.all([
      getCachedBrands(),
      getCachedProducts(),
      getCachedStyles(),
    ]);

    console.log("✅ Cache warmed successfully");
  } catch (err) {
    console.error("❌ Cache warm-up failed:", err.message);
  }
})();

const PORT = process.env.PORT || 3000;

app.listen(PORT, () =>
  console.log(`🚀 Server running at http://localhost:${PORT}/`)
);