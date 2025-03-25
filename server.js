import express from "express";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(cors()); // Enable CORS

// ✅ Load environment variables
const ACCOUNT_NUMBER = process.env.ACCOUNT_NUMBER;
const API_KEY = process.env.API_KEY;

if (!ACCOUNT_NUMBER || !API_KEY) {
    console.error("❌ Missing API credentials. Make sure ACCOUNT_NUMBER and API_KEY are set in Render.");
    process.exit(1); // Stop server if API keys are missing
}

// ✅ Serve Static Files (index.html)
app.use(express.static(path.join(process.cwd(), "public")));

// ✅ Root Route - Serves `index.html`
app.get("/", (req, res) => {
    res.sendFile(path.join(process.cwd(), "public", "index.html"));
});
app.get("/products/:categoryId", async (req, res) => {
    try {
      const { categoryId } = req.params;
      console.log("Fetching all products and filtering for category:", categoryId);
  
      const authString = `${ACCOUNT_NUMBER}:${API_KEY}`;
      const authHeader = "Basic " + Buffer.from(authString).toString("base64");
  
      // ✅ Fetch all products (contains variants)
      const response = await fetch("https://api-ca.ssactivewear.com/v2/products", {
        headers: {
          "Authorization": authHeader,
          "Content-Type": "application/json"
        }
      });
  
      if (!response.ok) {
        throw new Error(`S&S API Error: ${response.status}`);
      }
  
      let allProducts = await response.json();
      console.log("✅ Total Products Fetched:", allProducts.length);
  
      // ✅ Filter products by category, styleID, or brandID
      let matchingProducts = allProducts.filter(product =>
        product.baseCategoryID == categoryId ||
        product.styleID == categoryId ||
        product.brandID == categoryId
      );
  
      if (matchingProducts.length === 0) {
        console.warn(`⚠️ No products found for category ${categoryId}.`);
      } else {
        console.log(`✅ Found ${matchingProducts.length} products in category ${categoryId}.`);
      }
  
      // ✅ Group and map products with all variant details
      const grouped = new Map();
  
      matchingProducts.forEach(product => {
        const { styleID } = product;
  
        if (!grouped.has(styleID)) {
          grouped.set(styleID, {
            styleID: product.styleID,
            brandName: product.brandName,
            styleName: product.styleName,
            piecePrice: product.piecePrice,
            colorFrontImage: product.colorFrontImage,
            styleImage: product.styleImage,
            variants: []
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
          qty: product.qty
        });
      });
  
      // ✅ Send back the formatted response
      const finalProducts = Array.from(grouped.values());
      res.json({ categoryId, products: finalProducts });
  
    } catch (error) {
      console.error("❌ Error fetching products:", error.message);
      res.status(500).json({ error: error.message });
    }
  });
  


app.get("/brands", async (req, res) => {
    try {
        console.log("🔍 Fetching brands from S&S API...");

        const authString = `${ACCOUNT_NUMBER}:${API_KEY}`;
        const authHeader = "Basic " + Buffer.from(authString).toString("base64");

        // ✅ Fetch brands from the API
        const response = await fetch("https://api-ca.ssactivewear.com/v2/Brands", {
            headers: {
                "Authorization": authHeader,
                "Content-Type": "application/json"
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("❌ S&S API Error:", errorText);
            throw new Error(`S&S API Error: ${response.status} - ${errorText}`);
        }

        const brands = await response.json();
        console.log(`✅ Total Brands Fetched: ${brands.length}`);

        res.json({ brands });

    } catch (error) {
        console.error("❌ Error fetching brands:", error.message);
        res.status(500).json({ error: error.message });
    }
});

app.get("/products/:brandId", async (req, res) => {
    try {
        const { brandId } = req.params;
        console.log("🔍 Fetching products for brand:", brandId);

        const authString = `${ACCOUNT_NUMBER}:${API_KEY}`;
        const authHeader = "Basic " + Buffer.from(authString).toString("base64");

        // ✅ Fetch all products
        const response = await fetch("https://api-ca.ssactivewear.com/v2/products", {
            headers: {
                "Authorization": authHeader,
                "Content-Type": "application/json"
            }
        });

        if (!response.ok) {
            throw new Error(`S&S API Error: ${response.status}`);
        }

        let allProducts = await response.json();
        console.log(`✅ Total Products Fetched: ${allProducts.length}`);

        // ✅ Filter products by brand ID
        const matchingProducts = allProducts.filter(product => product.brandID == brandId);

        if (matchingProducts.length === 0) {
            console.warn(`⚠️ No products found for brand ${brandId}.`);
        } else {
            console.log(`✅ Found ${matchingProducts.length} products.`);
        }

        // ✅ Extract Variants (Colors & Sizes) with colorSwatchImage
        const finalProducts = matchingProducts.map(product => {
            const variants = matchingProducts
                .filter(p => p.styleID === product.styleID)
                .map(p => ({
                    colorName: p.colorName,
                    colorFrontImage: p.colorFrontImage,
                    colorSwatchImage: p.colorSwatchImage, // ✅ Added Swatch Image
                    colorHex: p.color1 || "#CCCCCC", // ✅ Fallback solid color if no swatch
                    sizeName: p.sizeName
                }));

            // ✅ Log each product's variants
            console.log(`🎨 Variants for ${product.styleName}:`, JSON.stringify(variants, null, 2));

            return {
                styleID: product.styleID,
                brandName: product.brandName,
                styleName: product.styleName,
                piecePrice: product.piecePrice,
                colorFrontImage: product.colorFrontImage,
                styleImage: product.styleImage,
                sku: product.styleCode || product.productCode || "N/A",
                variants: variants
            };
        });

        console.log("✅ Final Products with Variants:", JSON.stringify(finalProducts, null, 2)); // 🔥 Log the new structure

        res.json({ brandId, products: finalProducts });

    } catch (error) {
        console.error("❌ Error fetching products:", error.message);
        res.status(500).json({ error: error.message });
    }
});






app.get("/styles", async (req, res) => {
    try {
        console.log("Fetching styles from S&S API...");

        const authString = `${ACCOUNT_NUMBER}:${API_KEY}`;
        const authHeader = "Basic " + Buffer.from(authString).toString("base64");

        const response = await fetch("https://api-ca.ssactivewear.com/v2/styles", {
            headers: {
                "Authorization": authHeader,
                "Content-Type": "application/json"
            }
        });

        if (!response.ok) {
            throw new Error(`S&S API Error: ${response.status}`);
        }

        const styles = await response.json();
        console.log("🔍 First Style Response:", styles[0]);

        // ✅ Fetch Product Prices to Include `piecePrice`
        const productResponse = await fetch("https://api-ca.ssactivewear.com/v2/products", {
            headers: {
                "Authorization": authHeader,
                "Content-Type": "application/json"
            }
        });

        if (!productResponse.ok) {
            throw new Error(`S&S API Error: ${productResponse.status}`);
        }

        const products = await productResponse.json();

        // ✅ Merge Price Information
        const stylesWithPrices = styles.map(style => {
            const matchingProduct = products.find(p => p.styleID === style.styleID);
            return {
                ...style,
                description: style.description || "No description available.",
                piecePrice: matchingProduct ? matchingProduct.piecePrice : null
            };
        });

        res.json({ styles: stylesWithPrices });

    } catch (error) {
        console.error("❌ Error fetching styles:", error);
        res.status(500).json({ error: error.message });
    }
});

app.get("/styles/:id", async (req, res) => {
    try {
      const styleID = req.params.id;
      console.log(`📡 Fetching styleID: ${styleID}`);
  
      const authString = `${ACCOUNT_NUMBER}:${API_KEY}`;
      const authHeader = "Basic " + Buffer.from(authString).toString("base64");
      const headers = {
        "Authorization": authHeader,
        "Content-Type": "application/json"
      };
  
      // 1. Get style
      const styleRes = await fetch(`https://api-ca.ssactivewear.com/v2/styles/${styleID}`, { headers });
      if (!styleRes.ok) throw new Error(`❌ Style fetch failed: ${styleRes.status}`);
      const styleRaw = await styleRes.json();
      const style = Array.isArray(styleRaw) ? styleRaw[0] : styleRaw;
      if (!style) throw new Error("❌ Style data is empty");
  
      // 2. Get products (each one is a variant)
      const productRes = await fetch(`https://api-ca.ssactivewear.com/v2/products?style=${styleID}`, { headers });
      if (!productRes.ok) throw new Error(`❌ Product fetch failed: ${productRes.status}`);
      const productData = await productRes.json();
  
      // ✅ Each product in list is a variant
      const variants = productData.filter(p => p.styleID === parseInt(styleID));
      console.log(`✅ Found ${variants.length} raw variant records for style ${styleID}`);
  
      res.json({ ...style, variants });
  
    } catch (error) {
      console.error("❌ /styles/:id error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });
  
  



// ✅ Route to Fetch Unique `baseCategory` Values
app.get("/categories", async (req, res) => {
    try {
        console.log("🔍 Fetching styles from S&S API...");

        const authString = `${ACCOUNT_NUMBER}:${API_KEY}`;
        const authHeader = "Basic " + Buffer.from(authString).toString("base64");

        const response = await fetch("https://api-ca.ssactivewear.com/v2/styles/", {
            headers: {
                "Authorization": authHeader,
                "Content-Type": "application/json"
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("❌ S&S API Error:", errorText);
            throw new Error(`S&S API Error: ${response.status} - ${errorText}`);
        }

        const styles = await response.json();
        console.log(`✅ Total Styles Fetched: ${styles.length}`);
        

        // ✅ Extract unique base categories
        const uniqueCategories = [...new Set(styles.map(style => style.baseCategory))]
            .map(category => ({ name: category }));

        res.json({ categories: uniqueCategories });

    } catch (error) {
        console.error("❌ Error fetching categories:", error.message);
        res.status(500).json({ error: error.message });
    }
});

app.get("/styles/:category", async (req, res) => {
    try {
        const category = decodeURIComponent(req.params.category); // ✅ Decode category
        console.log(`🔍 Fetching styles for category: ${category}`);

        const authString = `${ACCOUNT_NUMBER}:${API_KEY}`;
        const authHeader = "Basic " + Buffer.from(authString).toString("base64");

        const response = await fetch("https://api-ca.ssactivewear.com/v2/styles/", {
            headers: {
                "Authorization": authHeader,
                "Content-Type": "application/json"
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("❌ S&S API Error:", errorText);
            throw new Error(`S&S API Error: ${response.status} - ${errorText}`);
        }

        const styles = await response.json();
        const filteredStyles = styles.filter(style => style.baseCategory === category);

        console.log(`✅ Found ${filteredStyles.length} styles for category ${category}`);
        res.json({ styles: filteredStyles });

    } catch (error) {
        console.error("❌ Error fetching styles:", error.message);
        res.status(500).json({ error: error.message });
    }
});


// ✅ Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}/`));
