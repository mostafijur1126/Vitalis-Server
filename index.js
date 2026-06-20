const express = require("express");
const cors = require("cors");
const app = express();
app.use(
  cors({
    origin: ["http://localhost:3000"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  }),
);
app.use(express.json());
require("dotenv").config();
const port = process.env.PORT;

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = process.env.MONGODB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// async function run() {
//   try {

// Connect the client to the server	(optional starting in v4.7)
// await client.connect();

client
  .connect(() => {
    console.log("connecting to Mongo db");
  })
  .catch(console.dir);

const db = client.db("vitals");
const classCollection = db.collection("allClasses");
const subscriptionsCollection = db.collection("subscriptions");
const bookClassCollection = db.collection("bookClasses");
const favoriteCollection = db.collection("favorite");
const forumPostCollection = db.collection("forumPost");
const userCollection = db.collection("user");

app.get("/api/all-class", async (req, res) => {
  try {
    const { search = "", category = "" } = req.query;

    const query = {};

    // Search by className
    if (search) {
      query.className = {
        $regex: search,
        $options: "i",
      };
    }

    // Category filter
    if (category && category !== "All Categories") {
      query.category = category;
    }

    const result = await classCollection.find(query).toArray();

    res.send(result);
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: "Server Error" });
  }
});

app.get("/api/all-classes/:id", async (req, res) => {
  const id = req.params.id;
  const query = {
    _id: new ObjectId(id),
  };
  const resust = await classCollection.findOne(query);
  res.send(resust || {});
});

app.post("/api/add-class", async (req, res) => {
  const data = req.body;
  const resust = await classCollection.insertOne(data);
  res.send(resust);
});

app.post("/api/subscription", async (req, res) => {
  const { sessionId, userId, priceId } = req.body;

  const isExist = await subscriptionsCollection.findOne({ sessionId });
  if (isExist) {
    return res.json({ msg: "Already exist!" });
  }
  await subscriptionsCollection.insertOne({
    sessionId,
    userId,
    priceId,
  });

  //update userPlan
  await userCollection.updateOne(
    { _id: new ObjectId(userId) },
    { $set: { plan: "pro" } },
  );

  res.json({ msg: "Payment Successfuly!" });
});

//class booking related
app.get("/api/checkBooking", async (req, res) => {
  const { userId, classId } = req.query;
  const existing = await bookClassCollection.findOne({ userId, classId });
  res.status(200).json({ isBooked: !!existing });
});
app.post("/api/bookClass", async (req, res) => {
  const result = await bookClassCollection.insertOne(req.body);
  res.status(200).json(result);
});

//favorite add/remove
app.post("/api/favorites", async (req, res) => {
  const { userId, classId } = req.body;
  const existing = await favoriteCollection.findOne({ userId, classId });
  if (existing) {
    await favoriteCollection.deleteOne({ userId, classId });
    res
      .status(200)
      .json({ isFavorite: false, message: "Removed from favorites" });
  } else {
    await favoriteCollection.insertOne({
      ...req.body,
      createdAt: new Date(),
    });
    res.status(200).json({ isFavorite: true, message: "Added to favorites" });
  }
});

app.get("/api/favorites/check", async (req, res) => {
  const { userId, classId } = req.query;
  const existing = await favoriteCollection.findOne({ userId, classId });
  res.status(200).json({ isFavorite: !!existing });
});

// User এর সব favorites
// app.get("/api/favorites", async (req, res) => {
//   const { userId } = req.query;
//   const favorites = await favoritesCollection.find({ userId }).toArray();
//   res.status(200).json(favorites);
// });

//trainer related
app.post("/api/forumPost", async (req, res) => {
  const post = req.body;
  const newPost = {
    ...post,
    createdAt: new Date(),
    status: "pending",
  };
  const result = await forumPostCollection.insertOne(newPost);
  res.status(200).json(result);
});

// Send a ping to confirm a successful connection
// await client.db("admin").command({ ping: 1 });
// console.log(
//   "Pinged your deployment. You successfully connected to MongoDB!",
// );
//   } finally {
//     // Ensures that the client will close when you finish/error
//     // await client.close();
//   }
// }
// run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

module.exports = app;
