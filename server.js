require("dotenv").config();
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// Helper: delete files
const deleteFile = (filePath) => {
  if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
};

// Main submission route
app.post(
  "/submit",
  upload.fields([
    { name: "pan", maxCount: 1 },
    { name: "bank", maxCount: 1 },
  ]),
  async (req, res) => {
    let panFilePath = null;
    let bankFilePath = null;

    try {
      const { name, mobile, dob, employment, income } = req.body;

      // Validate files
      if (!req.files || !req.files.pan || !req.files.bank) {
        return res.status(400).send("Please upload both PAN and Bank Statement.");
      }

      // Validate form fields
      if (!name || !mobile || !dob || !employment || !income) {
        return res.status(400).send("All fields are required.");
      }

      panFilePath = req.files.pan[0].path;
      bankFilePath = req.files.bank[0].path;

      // Convert files to base64 for Brevo API
      const panBase64 = fs.readFileSync(panFilePath, { encoding: "base64" });
      const bankBase64 = fs.readFileSync(bankFilePath, { encoding: "base64" });

      // Prepare JSON body for Brevo
      const body = {
        sender: { email: process.env.SENDER_EMAIL, name: "Hanuman Finance" },
        to: [{ email: process.env.RECEIVER_EMAIL }],
        subject: `New Loan Application - ${name}`,
        htmlContent: `
          <h2>New Loan Application</h2>
          <ul>
            <li><strong>Name:</strong> ${name}</li>
            <li><strong>Mobile:</strong> ${mobile}</li>
            <li><strong>DOB:</strong> ${dob}</li>
            <li><strong>Employment:</strong> ${employment}</li>
            <li><strong>Income:</strong> ₹${income}</li>
          </ul>
        `,
        attachment: [
          { name: req.files.pan[0].originalname, content: panBase64 },
          { name: req.files.bank[0].originalname, content: bankBase64 },
        ],
      };

      // Send email via Brevo API
      await axios.post("https://api.brevo.com/v3/smtp/email", body, {
        headers: {
          "api-key": process.env.BREVO_API_KEY,
          "Content-Type": "application/json",
        },
      });

      console.log(`Email sent for ${name} (${mobile})`);

      // Send thank-you page
      res.status(200).send(`
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Thank You - Hanuman Finance</title>
<style>
body { margin:0; height:100vh; display:flex; justify-content:center; align-items:center; font-family:Arial, sans-serif; background: linear-gradient(135deg, #7b1f1f, #c0392b); color:white; }
.card { background:white; color:#333; padding:40px 30px; border-radius:16px; text-align:center; max-width:500px; width:90%; box-shadow:0 20px 40px rgba(0,0,0,0.3);}
h1 { color:#7b1f1f; margin-top:0;}
.icon { font-size:70px; color:#27ae60; margin-bottom:20px;}
p { font-size:18px; line-height:1.6; margin:15px 0;}
</style>
</head>
<body>
<div class="card">
  <div class="icon">✓</div>
  <h1>Thank You, ${name}!</h1>
  <p>Your loan application has been successfully submitted.</p>
  <p>We have received your documents and details.</p>
  <p>Our team will contact you soon on <strong>${mobile}</strong>.</p>
  <p><em>Submitted on: ${new Date().toLocaleString("en-IN")}</em></p>
</div>
</body>
</html>
      `);

    } catch (err) {
      console.error("Error sending email:", err.response?.data || err.message);
      res.status(500).send(`
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Error</title></head>
<body style="font-family:Arial; text-align:center; padding:50px; background:#f8d7da; color:#721c24;">
  <div style="display:inline-block; background:white; padding:30px; border-radius:10px;">
    <h1>Oops! Something went wrong</h1>
    <p>We may have still received your application.</p>
    <p>Please try again later or contact support.</p>
  </div>
</body>
</html>
      `);
    } finally {
      deleteFile(panFilePath);
      deleteFile(bankFilePath);
    }
  }
);

// Start server
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
