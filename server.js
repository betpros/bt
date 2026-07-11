require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const orderRoute = require("./src/routes/order");
const ipnRoute = require("./src/routes/ipn");
const callbackRoute = require("./src/routes/callback");
const statusRoute = require("./src/routes/status");

const app = express();

app.use(helmet());
app.use(morgan("tiny"));
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "*",
  })
);
app.use(express.json());

app.get("/", (_req, res) => res.send("BetPro backend is running."));
app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/pesapal", orderRoute);
app.use("/api/pesapal", ipnRoute);
app.use("/api/pesapal", callbackRoute);
app.use("/api/pesapal", statusRoute);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong." });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`BetPro backend listening on port ${PORT}`));
