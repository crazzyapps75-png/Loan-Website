require("dotenv").config();

const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");

const app = express();

/* 🔥 MUST USE process.env.PORT on Render */
const PORT = process.env.PORT || 10000;

/* Middleware */
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

/* Upload folder */
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

/* Multer config */
const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname),
});

const upload = multer({ storage });

/* Health check route (VERY IMPORTANT) */
app.get("/", (req, res) => {
  res.send("Server is running ✅");
});

/* Submit route */
app.post(
  "/submit",
  upload.fields([
    { name: "pan", maxCount: 1 },
    { name: "bank", maxCount: 1 },
  ]),
  async (req, res) => {
    let panPath, bankPath;

    try {
      const { name, mobile, dob, employment, income } = req.body;

      panPath = req.files.pan[0].path;
      bankPath = req.files.bank[0].path;

      const data = {
        sender: {
          name: "Hanuman Finance",
          email: process.env.SENDER_EMAIL,
        },
        to: [{ email: process.env.RECEIVER_EMAIL }],
        subject: `New Loan Application - ${name}`,
        htmlContent: `
          <h3>Loan Application</h3>
          <p>Name: ${name}</p>
          <p>Mobile: ${mobile}</p>
          <p>DOB: ${dob}</p>
          <p>Employment: ${employment}</p>
          <p>Income: ₹${income}</p>
        `,
        attachment: [
          {
            name: "pan.pdf",
            content: fs.readFileSync(panPath).toString("base64"),
          },
          {
            name: "bank.pdf",
            content: fs.readFileSync(bankPath).toString("base64"),
          },
        ],
      };

      await axios.post(
        "https://api.brevo.com/v3/smtp/email",
        data,
        {
          headers: {
            "api-key": process.env.BREVO_API_KEY,
            "Content-Type": "application/json",
          },
        }
      );

      res.redirect("/thankyou.html");
    } catch (err) {
      console.error(err.response?.data || err.message);
      res.status(500).send("Email failed");
    } finally {
      if (panPath) fs.unlinkSync(panPath);
      if (bankPath) fs.unlinkSync(bankPath);
    }
  }
);

/* 🔥 THIS LINE FIXES RENDER TIMEOUT */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
