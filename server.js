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

        // ✅ Fetch all products
        const response = await fetch("https://api-ca.ssactivewear.com/v2/products", {
            headers: {
                "Authorization": authHeader,
                "Content-Type": "application/json"
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("S&S API Error:", errorText);
            throw new Error(`S&S API Error: ${response.status} - ${errorText}`);
        }

        const allProducts = await response.json();
        console.log("Total Products Fetched:", allProducts.length);

        // ✅ Extract unique categories, brands, and styles from the API
        const uniqueBaseCategoryIDs = [...new Set(allProducts.map(p => p.baseCategoryID))];
        const uniqueStyleIDs = [...new Set(allProducts.map(p => p.styleID))];
        const uniqueBrandIDs = [...new Set(allProducts.map(p => p.brandID))];

        console.log("Unique baseCategoryIDs:", uniqueBaseCategoryIDs);
        console.log("Unique styleIDs:", uniqueStyleIDs);
        console.log("Unique brandIDs:", uniqueBrandIDs);

        // ✅ Try filtering by baseCategoryID, styleID, or brandID
        let matchingProducts = allProducts.filter(product => 
            product.baseCategoryID == categoryId || 
            product.styleID == categoryId ||
            product.brandID == categoryId
        );

        if (matchingProducts.length === 0) {
            console.warn(`⚠️ No products found for category ${categoryId}. Check available category IDs in logs.`);
        } else {
            console.log(`✅ Found ${matchingProducts.length} products in category ${categoryId}.`);
        }

        res.json({ categoryId, products: matchingProducts });

    } catch (error) {
        console.error("Error fetching products:", error.message);
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
        console.log("🔍 Fetching all products and filtering for brand:", brandId);

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
            const errorText = await response.text();
            console.error("❌ S&S API Error:", errorText);
            throw new Error(`S&S API Error: ${response.status} - ${errorText}`);
        }

        const allProducts = await response.json();
        console.log(`✅ Total Products Fetched: ${allProducts.length}`);

        // ✅ Filter products by brand ID
        const matchingProducts = allProducts.filter(product => product.brandID == brandId);

        if (matchingProducts.length === 0) {
            console.warn(`⚠️ No products found for brand ${brandId}.`);
        } else {
            console.log(`✅ Found ${matchingProducts.length} products for brand ${brandId}.`);
        }

        res.json({ brandId, products: matchingProducts });

    } catch (error) {
        console.error("❌ Error fetching products:", error.message);
        res.status(500).json({ error: error.message });
    }
});



// ✅ Fetch Categories from S&S API
app.get("/categories", async (req, res) => {
    try {
        console.log("Fetching categories from S&S API...");

        // ✅ Get pagination parameters from request
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50; 

        const authString = `${ACCOUNT_NUMBER}:${API_KEY}`;
        const authHeader = "Basic " + Buffer.from(authString).toString("base64");

        // ✅ Fetch categories from API (FIXED ENDPOINT)
        const response = await fetch(`https://api-ca.ssactivewear.com/v2/categories`, {
            headers: {
                "Authorization": authHeader,
                "Content-Type": "application/json"
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("S&S API Error:", errorText);
            throw new Error(`S&S API Error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log(`Total Categories Fetched: ${data.length}`);

        // ✅ Implement manual pagination (if needed)
        const startIndex = (page - 1) * limit;
        const paginatedCategories = data.slice(startIndex, startIndex + limit);

        res.json({
            totalCategories: data.length,
            page,
            limit,
            totalPages: Math.ceil(data.length / limit),
            categories: paginatedCategories // ✅ FIXED KEY
        });

    } catch (error) {
        console.error("Server Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// ✅ Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}/`));
