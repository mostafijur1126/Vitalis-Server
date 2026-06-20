const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://vitalis-client-pi.vercel.app", // ⭐ তোমার Vercel URL দাও
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  }),
);

app.use(express.json());

const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

client.connect().catch(console.dir);

const db = client.db("vitals");
const classCollection = db.collection("allClasses");
const subscriptionsCollection = db.collection("subscriptions");
const bookClassCollection = db.collection("bookClasses");
const favoriteCollection = db.collection("favorite");
const forumPostCollection = db.collection("forumPost");
const userCollection = db.collection("user");

// All Classes
app.get("/api/all-class", async (req, res) => {
  try {
    const { search = "", category = "" } = req.query;
    const query = {};
    if (search) query.className = { $regex: search, $options: "i" };
    if (category && category !== "All Categories") query.category = category;
    const result = await classCollection.find(query).toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Server Error" });
  }
});

app.get("/api/all-classes/:id", async (req, res) => {
  const query = { _id: new ObjectId(req.params.id) };
  const result = await classCollection.findOne(query);
  res.send(result || {});
});

app.post("/api/add-class", async (req, res) => {
  const result = await classCollection.insertOne(req.body);
  res.send(result);
});

// Subscription
app.post("/api/subscription", async (req, res) => {
  const { sessionId, userId, priceId } = req.body;
  const isExist = await subscriptionsCollection.findOne({ sessionId });
  if (isExist) return res.json({ msg: "Already exist!" });
  await subscriptionsCollection.insertOne({ sessionId, userId, priceId });
  await userCollection.updateOne(
    { _id: new ObjectId(userId) },
    { $set: { plan: "pro" } },
  );
  res.json({ msg: "Payment Successfully!" });
});

// Booking
app.get("/api/checkBooking", async (req, res) => {
  const { userId, classId } = req.query;
  const existing = await bookClassCollection.findOne({ userId, classId });
  res.status(200).json({ isBooked: !!existing });
});

app.post("/api/bookClass", async (req, res) => {
  const result = await bookClassCollection.insertOne(req.body);
  res.status(200).json(result);
});

// Favorites
app.post("/api/favorites", async (req, res) => {
  const { userId, classId } = req.body;
  const existing = await favoriteCollection.findOne({ userId, classId });
  if (existing) {
    await favoriteCollection.deleteOne({ userId, classId });
    res
      .status(200)
      .json({ isFavorite: false, message: "Removed from favorites" });
  } else {
    await favoriteCollection.insertOne({ ...req.body, createdAt: new Date() });
    res.status(200).json({ isFavorite: true, message: "Added to favorites" });
  }
});

app.get("/api/favorites/check", async (req, res) => {
  const { userId, classId } = req.query;
  const existing = await favoriteCollection.findOne({ userId, classId });
  res.status(200).json({ isFavorite: !!existing });
});

// ⭐ Uncomment করা হয়েছে
app.get("/api/favorites", async (req, res) => {
  const { userId } = req.query;
  const favorites = await favoriteCollection.find({ userId }).toArray();
  res.status(200).json(favorites);
});

// Forum
app.post("/api/forumPost", async (req, res) => {
  const newPost = { ...req.body, createdAt: new Date(), status: "pending" };
  const result = await forumPostCollection.insertOne(newPost);
  res.status(200).json(result);
});

app.get("/", (req, res) => res.send("Hello World!"));

app.listen(port, () => console.log(`Server running on port ${port}`));

module.exports = app;
