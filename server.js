import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import path from "path";

const app = express();
app.use(cors()); // Enable CORS

const ACCOUNT_NUMBER = "411878";
const API_KEY = "33692f64-ac67-4514-9695-e79a66955d13";

// ✅ Serve Static Files (index.html)
app.use(express.static(path.join(process.cwd(), "public")));

// ✅ Root Route - Serves `index.html`
app.get("/", (req, res) => {
    res.sendFile(path.join(process.cwd(), "public", "index.html"));
});

// ✅ Fetch Products from S&S API
app.get("/products", async (req, res) => {
    try {
        console.log("Fetching products from S&S API...");

        // ✅ Get pagination parameters from request
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50; // Default 5 products per page

        const authString = `${ACCOUNT_NUMBER}:${API_KEY}`;
        const authHeader = "Basic " + Buffer.from(authString).toString("base64");

        // ✅ Fetch all products from API
        const response = await fetch(`https://api-ca.ssactivewear.com/v2/products`, {
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

        const data = await response.json(); // API returns ALL products
        console.log(`Total Products Fetched: ${data.length}`);

        // ✅ Implement manual pagination
        const startIndex = (page - 1) * limit;
        const paginatedProducts = data.slice(startIndex, startIndex + limit);

        res.json({
            totalProducts: data.length, // Total products available
            page,
            limit,
            totalPages: Math.ceil(data.length / limit),
            products: paginatedProducts // Only return the sliced portion
        });

    } catch (error) {
        console.error("Server Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});





const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}/`));
